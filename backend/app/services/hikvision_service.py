"""
Paylix - Hikvision ISAPI Attendance Device Integration
Polls access control events and maps them to attendance records.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import AttendanceRecord, AttendanceSource, Employee, HikvisionDevice

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Credential encryption helpers
# ---------------------------------------------------------------------------

def _fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY.encode()
    # Fernet needs a 32-byte URL-safe base64 key
    key32 = hashlib.sha256(key).digest()
    return Fernet(base64.urlsafe_b64encode(key32))


def encrypt_password(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_password(enc: str) -> str:
    return _fernet().decrypt(enc.encode()).decode()


# ---------------------------------------------------------------------------
# Digest auth helper (Hikvision uses HTTP Digest)
# ---------------------------------------------------------------------------

class DigestAuth(httpx.Auth):
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self._nonce: Optional[str] = None
        self._realm: Optional[str] = None

    def auth_flow(self, request: httpx.Request):
        response = yield request
        if response.status_code == 401 and "www-authenticate" in response.headers:
            auth_header = response.headers["www-authenticate"]
            self._parse_challenge(auth_header)
            request.headers["Authorization"] = self._build_digest(
                request.method, str(request.url.path)
            )
            yield request

    def _parse_challenge(self, header: str) -> None:
        import re
        self._realm = re.search(r'realm="([^"]+)"', header)
        self._nonce  = re.search(r'nonce="([^"]+)"', header)
        self._realm  = self._realm.group(1) if self._realm else ""
        self._nonce  = self._nonce.group(1)  if self._nonce  else ""

    def _build_digest(self, method: str, uri: str) -> str:
        def md5(s: str) -> str:
            return hashlib.md5(s.encode()).hexdigest()

        ha1 = md5(f"{self.username}:{self._realm}:{self.password}")
        ha2 = md5(f"{method}:{uri}")
        nc   = "00000001"
        cnonce = hashlib.md5(str(time.time()).encode()).hexdigest()[:8]
        response_hash = md5(f"{ha1}:{self._nonce}:{nc}:{cnonce}:auth:{ha2}")
        return (
            f'Digest username="{self.username}", realm="{self._realm}", '
            f'nonce="{self._nonce}", uri="{uri}", qop=auth, nc={nc}, '
            f'cnonce="{cnonce}", response="{response_hash}"'
        )


# ---------------------------------------------------------------------------
# Hikvision ISAPI client
# ---------------------------------------------------------------------------

class HikvisionClient:
    def __init__(self, device: HikvisionDevice):
        self.device = device
        self._base = f"http://{device.ip_address}:{device.port}"
        self._auth = DigestAuth(device.username, decrypt_password(device.password_enc))

    async def fetch_access_events(
        self, start_time: datetime, end_time: datetime
    ) -> list[dict]:
        """
        Query access control events via ISAPI /ISAPI/AccessControl/AcsEvent.
        Returns list of raw event dicts.
        """
        start_str = start_time.strftime("%Y-%m-%dT%H:%M:%S+05:30")
        end_str   = end_time.strftime("%Y-%m-%dT%H:%M:%S+05:30")

        payload = f"""<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond>
  <searchID>paylix-sync</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>1000</maxResults>
  <startTime>{start_str}</startTime>
  <endTime>{end_str}</endTime>
</AcsEventCond>"""

        url = f"{self._base}/ISAPI/AccessControl/AcsEvent?format=json"
        events = []
        async with httpx.AsyncClient(auth=self._auth, timeout=30) as client:
            resp = await client.post(
                url,
                content=payload,
                headers={"Content-Type": "application/xml"},
            )
            resp.raise_for_status()
            data = resp.json()
            for ev in data.get("AcsEvent", {}).get("InfoList", []):
                events.append({
                    "card_number": ev.get("cardNo", ""),
                    "event_time":  ev.get("time", ""),
                    "event_type":  ev.get("majorEventType", ""),
                    "door_no":     ev.get("doorNo", 1),
                    "device_serial": self.device.device_serial,
                })
        return events

    async def test_connection(self) -> bool:
        try:
            async with httpx.AsyncClient(auth=self._auth, timeout=10) as client:
                resp = await client.get(f"{self._base}/ISAPI/System/deviceInfo")
                return resp.status_code == 200
        except Exception:
            return False


# ---------------------------------------------------------------------------
# Sync service: pull events and write AttendanceRecords
# ---------------------------------------------------------------------------

async def sync_device(
    db: AsyncSession,
    device: HikvisionDevice,
    start_time: datetime,
    end_time: datetime,
    company_id: str,
) -> dict:
    client = HikvisionClient(device)
    events = await client.fetch_access_events(start_time, end_time)

    created = 0
    updated = 0
    skipped = 0

    for ev in events:
        card_no = ev.get("card_number", "").strip()
        if not card_no:
            skipped += 1
            continue

        # Resolve employee by card number
        emp_result = await db.execute(
            select(Employee).where(
                Employee.hikvision_card_number == card_no,
                Employee.company_id == company_id,
                Employee.is_active == True,
            )
        )
        emp = emp_result.scalar_one_or_none()
        if not emp:
            skipped += 1
            continue

        # Parse event time
        try:
            event_dt = datetime.fromisoformat(ev["event_time"].replace("+05:30", "+05:30"))
        except (ValueError, KeyError):
            skipped += 1
            continue

        work_date = event_dt.date()

        # Get or create attendance record for this date
        att_result = await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.employee_id == emp.id,
                AttendanceRecord.work_date == work_date,
            )
        )
        att = att_result.scalar_one_or_none()

        if att is None:
            att = AttendanceRecord(
                employee_id=emp.id,
                company_id=company_id,
                work_date=work_date,
                check_in=event_dt,
                check_in_source=AttendanceSource.HIKVISION,
                device_id=device.id,
            )
            db.add(att)
            created += 1
        else:
            # Update check_out if this event is later than current check_in
            if att.check_in and event_dt > att.check_in:
                att.check_out = event_dt
                att.check_out_source = AttendanceSource.HIKVISION
                updated += 1
            elif att.check_in is None:
                att.check_in = event_dt
                att.check_in_source = AttendanceSource.HIKVISION
                updated += 1

    # Update last sync timestamp
    device.last_sync_at = datetime.now(timezone.utc)
    await db.flush()

    return {"created": created, "updated": updated, "skipped": skipped, "total_events": len(events)}


async def sync_all_devices(db: AsyncSession, company_id: str, start_time: datetime, end_time: datetime) -> list[dict]:
    """Sync all active Hikvision devices for a company."""
    result = await db.execute(
        select(HikvisionDevice).where(
            HikvisionDevice.company_id == company_id,
            HikvisionDevice.is_active == True,
        )
    )
    devices = result.scalars().all()
    results = []
    for device in devices:
        try:
            sync_result = await sync_device(db, device, start_time, end_time, company_id)
            sync_result["device_id"] = device.id
            sync_result["device_name"] = device.device_name
            results.append(sync_result)
        except Exception as exc:
            logger.error("Failed to sync device %s: %s", device.device_serial, exc)
            results.append({
                "device_id": device.id,
                "device_name": device.device_name,
                "error": str(exc),
            })
    return results
