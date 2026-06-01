"""
Paylix - Authentication & Authorization Service
JWT + TOTP MFA + Email OTP
"""
import logging
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import bcrypt as _bcrypt
import pyotp
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import OTPCode, User, UserSession, AuditLog

logger = logging.getLogger(__name__)

UTC = timezone.utc


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(
    user_id: str, company_id: str, role: str, jti: str,
    active_company_id: Optional[str] = None,
) -> str:
    exp = datetime.now(UTC) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "company_id": company_id,
        "role": role,
        "jti": jti,
        "type": "access",
        "exp": exp,
        "iat": datetime.now(UTC),
    }
    if active_company_id and active_company_id != company_id:
        payload["active_company_id"] = active_company_id
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str, jti: str) -> str:
    exp = datetime.now(UTC) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "jti": jti,
        "type": "refresh",
        "exp": exp,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}") from e


# ---------------------------------------------------------------------------
# TOTP (Google Authenticator / Authy)
# ---------------------------------------------------------------------------

def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=settings.TOTP_ISSUER)


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


# ---------------------------------------------------------------------------
# Email OTP (6-digit)
# ---------------------------------------------------------------------------

def _generate_otp_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


async def create_email_otp(db: AsyncSession, user_id: str, purpose: str) -> str:
    """Generate and persist an email OTP. Invalidates previous unused codes."""
    # Invalidate existing unused codes for this user+purpose
    from sqlalchemy import update
    await db.execute(
        update(OTPCode)
        .where(OTPCode.user_id == user_id, OTPCode.purpose == purpose, OTPCode.is_used == False)
        .values(is_used=True)
    )
    code = _generate_otp_code()
    expires = datetime.now(UTC) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    otp = OTPCode(
        user_id=user_id,
        code=code,
        purpose=purpose,
        expires_at=expires,
    )
    db.add(otp)
    await db.flush()
    return code


async def verify_email_otp(db: AsyncSession, user_id: str, purpose: str, code: str) -> bool:
    result = await db.execute(
        select(OTPCode).where(
            OTPCode.user_id == user_id,
            OTPCode.purpose == purpose,
            OTPCode.code == code,
            OTPCode.is_used == False,
            OTPCode.expires_at > datetime.now(UTC),
        )
    )
    otp = result.scalar_one_or_none()
    if not otp:
        return False
    otp.is_used = True
    await db.flush()
    return True


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------

async def create_session(
    db: AsyncSession, user_id: str, ip: Optional[str], ua: Optional[str],
    active_company_id: Optional[str] = None,
) -> tuple[str, str, str]:
    """Returns (access_token, refresh_token, jti)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()

    jti = str(uuid4())
    expires = datetime.now(UTC) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    session = UserSession(
        user_id=user_id,
        jti=jti,
        ip_address=ip,
        user_agent=ua,
        expires_at=expires,
    )
    db.add(session)

    access_token = create_access_token(user.id, user.company_id, user.role.value, jti, active_company_id)
    refresh_token = create_refresh_token(user.id, jti)
    return access_token, refresh_token, jti


async def revoke_session(db: AsyncSession, jti: str) -> None:
    result = await db.execute(select(UserSession).where(UserSession.jti == jti))
    session = result.scalar_one_or_none()
    if session:
        session.is_revoked = True
        await db.flush()


async def is_session_valid(db: AsyncSession, jti: str) -> bool:
    result = await db.execute(
        select(UserSession).where(
            UserSession.jti == jti,
            UserSession.is_revoked == False,
            UserSession.expires_at > datetime.now(UTC),
        )
    )
    return result.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# Login logic with brute-force protection
# ---------------------------------------------------------------------------

async def attempt_login(db: AsyncSession, email: str, password: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return None

    now = datetime.now(UTC)
    if user.locked_until and user.locked_until > now:
        raise PermissionError(f"Account locked until {user.locked_until.isoformat()}")

    if not verify_password(password, user.hashed_password):
        user.failed_login_count += 1
        if user.failed_login_count >= settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)
        await db.flush()
        return None

    # Reset on success
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login = now
    await db.flush()
    return user


# ---------------------------------------------------------------------------
# Audit logging
# ---------------------------------------------------------------------------

async def write_audit(
    db: AsyncSession,
    *,
    action: str,
    resource_type: str,
    company_id: Optional[str] = None,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    resource_id: Optional[str] = None,
    payload: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    log = AuditLog(
        company_id=company_id,
        user_id=user_id,
        user_email=user_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        payload=payload,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)
    # Do NOT flush here — caller commits the transaction
