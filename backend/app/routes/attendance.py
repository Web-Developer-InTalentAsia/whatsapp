"""
Paylix - Attendance Management Routes
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import (
    AttendanceRecord,
    AttendanceSource,
    Employee,
    HikvisionDevice,
    ShiftSchedule,
    UserRole,
)
from app.routes.auth import CurrentUser
from app.services.auth_service import write_audit
from app.services.hikvision_service import encrypt_password, sync_all_devices

router = APIRouter(prefix="/attendance", tags=["attendance"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AttendanceManualEntry(BaseModel):
    employee_id: str
    work_date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    notes: Optional[str] = None


class AttendanceBulkApprove(BaseModel):
    record_ids: list[str]


class HikvisionDeviceCreate(BaseModel):
    device_serial: str
    device_name: str
    ip_address: str
    port: int = 80
    username: str
    password: str
    location: Optional[str] = None
    is_entry: bool = True
    is_exit: bool = True


class SyncRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    device_ids: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check_hr_or_supervisor(user: CurrentUser):
    allowed = {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.HR_USER, UserRole.SUPERVISOR}
    if user.role not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _serialize_record(r: AttendanceRecord) -> dict:
    return {
        "id": r.id,
        "employee_id": r.employee_id,
        "work_date": str(r.work_date),
        "check_in": r.check_in.isoformat() if r.check_in else None,
        "check_out": r.check_out.isoformat() if r.check_out else None,
        "check_in_source": r.check_in_source.value,
        "check_out_source": r.check_out_source.value,
        "raw_minutes": r.raw_minutes,
        "ot_minutes": r.ot_minutes,
        "is_absent": r.is_absent,
        "is_half_day": r.is_half_day,
        "is_holiday": r.is_holiday,
        "is_approved": r.is_approved,
        "notes": r.notes,
    }


# ---------------------------------------------------------------------------
# Routes - Attendance Records
# ---------------------------------------------------------------------------

@router.get("")
async def list_attendance(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    employee_id: Optional[str] = Query(None),
    start_date: date = Query(...),
    end_date: date = Query(...),
    is_approved: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
):
    q = select(AttendanceRecord).where(
        AttendanceRecord.company_id == current_user.company_id,
        AttendanceRecord.work_date >= start_date,
        AttendanceRecord.work_date <= end_date,
    )

    # Employees can only see their own attendance
    if current_user.role == UserRole.EMPLOYEE:
        q = q.where(AttendanceRecord.employee_id == current_user.employee_id)
    elif employee_id:
        q = q.where(AttendanceRecord.employee_id == employee_id)

    if is_approved is not None:
        q = q.where(AttendanceRecord.is_approved == is_approved)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()

    q = q.order_by(AttendanceRecord.work_date.desc(), AttendanceRecord.employee_id)
    q = q.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(q)
    records = result.scalars().all()

    return {"total": total, "page": page, "page_size": page_size, "items": [_serialize_record(r) for r in records]}


@router.post("", status_code=201)
async def create_manual_entry(
    body: AttendanceManualEntry,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    _check_hr_or_supervisor(current_user)

    # Verify employee belongs to company
    emp_result = await db.execute(
        select(Employee).where(
            Employee.id == body.employee_id,
            Employee.company_id == current_user.company_id,
        )
    )
    if not emp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check for existing record
    existing = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == body.employee_id,
            AttendanceRecord.work_date == body.work_date,
        )
    )
    att = existing.scalar_one_or_none()

    if att:
        if body.check_in:
            att.check_in = body.check_in
            att.check_in_source = AttendanceSource.MANUAL
        if body.check_out:
            att.check_out = body.check_out
            att.check_out_source = AttendanceSource.MANUAL
        if body.notes:
            att.notes = body.notes
    else:
        att = AttendanceRecord(
            employee_id=body.employee_id,
            company_id=current_user.company_id,
            work_date=body.work_date,
            check_in=body.check_in,
            check_out=body.check_out,
            check_in_source=AttendanceSource.MANUAL,
            check_out_source=AttendanceSource.MANUAL,
            notes=body.notes,
        )
        db.add(att)

    # Compute raw_minutes
    if att.check_in and att.check_out:
        delta = att.check_out - att.check_in
        att.raw_minutes = max(0, int(delta.total_seconds() / 60))

    await db.flush()
    await write_audit(
        db, action="ATTENDANCE_MANUAL_ENTRY", resource_type="attendance",
        resource_id=att.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"employee_id": body.employee_id, "work_date": str(body.work_date)},
    )
    return _serialize_record(att)


@router.patch("/{record_id}")
async def update_attendance(
    record_id: str,
    body: AttendanceManualEntry,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    _check_hr_or_supervisor(current_user)

    result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.id == record_id,
            AttendanceRecord.company_id == current_user.company_id,
        )
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    if body.check_in:
        att.check_in = body.check_in
    if body.check_out:
        att.check_out = body.check_out
    if body.notes:
        att.notes = body.notes

    if att.check_in and att.check_out:
        delta = att.check_out - att.check_in
        att.raw_minutes = max(0, int(delta.total_seconds() / 60))

    await db.flush()
    return _serialize_record(att)


@router.post("/approve")
async def approve_attendance(
    body: AttendanceBulkApprove,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    _check_hr_or_supervisor(current_user)

    updated = 0
    for record_id in body.record_ids:
        result = await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.id == record_id,
                AttendanceRecord.company_id == current_user.company_id,
            )
        )
        att = result.scalar_one_or_none()
        if att:
            att.is_approved = True
            att.approved_by = current_user.id
            updated += 1

    await db.flush()
    await write_audit(
        db, action="ATTENDANCE_BULK_APPROVED", resource_type="attendance",
        company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"count": updated},
    )
    return {"approved": updated}


# ---------------------------------------------------------------------------
# Routes - Hikvision Devices
# ---------------------------------------------------------------------------

@router.get("/devices")
async def list_devices(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN}:
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(
        select(HikvisionDevice).where(HikvisionDevice.company_id == current_user.company_id)
    )
    devices = result.scalars().all()
    return [
        {
            "id": d.id,
            "device_serial": d.device_serial,
            "device_name": d.device_name,
            "ip_address": d.ip_address,
            "port": d.port,
            "location": d.location,
            "is_entry": d.is_entry,
            "is_exit": d.is_exit,
            "is_active": d.is_active,
            "last_sync_at": d.last_sync_at.isoformat() if d.last_sync_at else None,
        }
        for d in devices
    ]


@router.post("/devices", status_code=201)
async def add_device(
    body: HikvisionDeviceCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN}:
        raise HTTPException(status_code=403, detail="Admin access required")

    device = HikvisionDevice(
        company_id=current_user.company_id,
        device_serial=body.device_serial,
        device_name=body.device_name,
        ip_address=body.ip_address,
        port=body.port,
        username=body.username,
        password_enc=encrypt_password(body.password),
        location=body.location,
        is_entry=body.is_entry,
        is_exit=body.is_exit,
    )
    db.add(device)
    await db.flush()

    await write_audit(
        db, action="DEVICE_ADDED", resource_type="hikvision_device",
        resource_id=device.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
    )
    return {"id": device.id, "device_name": device.device_name}


@router.post("/devices/{device_id}/test")
async def test_device_connection(
    device_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN}:
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(
        select(HikvisionDevice).where(
            HikvisionDevice.id == device_id,
            HikvisionDevice.company_id == current_user.company_id,
        )
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    from app.services.hikvision_service import HikvisionClient
    client = HikvisionClient(device)
    ok = await client.test_connection()
    return {"connected": ok, "device_serial": device.device_serial}


@router.post("/sync")
async def sync_hikvision(
    body: SyncRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.HR_USER}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    results = await sync_all_devices(db, current_user.company_id, body.start_time, body.end_time)
    await write_audit(
        db, action="HIKVISION_SYNC", resource_type="attendance",
        company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"results": results},
    )
    return {"results": results}
