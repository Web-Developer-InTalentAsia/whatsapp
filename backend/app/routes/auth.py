"""
Paylix - Authentication Routes
POST /auth/login        → password check → TOTP or Email OTP challenge
POST /auth/verify-totp  → finalize login with TOTP code
POST /auth/verify-otp   → finalize login with email OTP
POST /auth/refresh      → exchange refresh token
POST /auth/logout       → revoke session
POST /auth/setup-totp   → enable TOTP MFA (requires email OTP verification)
POST /auth/sensitive-otp → request email OTP for sensitive action
"""
import logging
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import User, UserRole
from app.services.auth_service import (
    attempt_login,
    create_email_otp,
    create_session,
    decode_token,
    generate_totp_secret,
    get_totp_uri,
    is_session_valid,
    revoke_session,
    verify_email_otp,
    verify_totp,
    write_audit,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

UTC = timezone.utc


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    mfa_required: bool
    mfa_method: str  # "totp" | "email_otp"
    temp_token: Optional[str] = None  # short-lived token to carry login state
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    user: Optional[dict] = None


class TOTPVerifyRequest(BaseModel):
    temp_token: str
    totp_code: str


class OTPVerifyRequest(BaseModel):
    temp_token: str
    otp_code: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TOTPSetupRequest(BaseModel):
    otp_code: str  # email OTP confirming intent


class SensitiveOTPRequest(BaseModel):
    purpose: str  # e.g. "bank_file_release", "payslip_release"


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    company_name: str
    password: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")


def _user_agent(request: Request) -> str:
    return request.headers.get("User-Agent", "")


async def _get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    authorization: Annotated[Optional[str], Header()] = None,
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Not an access token")

    jti = payload.get("jti")
    if not await is_session_valid(db, jti):
        raise HTTPException(status_code=401, detail="Session expired or revoked")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Super admin company switching: honour X-Company-ID header when present
    x_company_id = request.headers.get("X-Company-ID")
    if x_company_id and user.role == UserRole.SUPER_ADMIN:
        from app.models.models import Company
        target = await db.get(Company, x_company_id)
        if target and target.is_active:
            # Detach from session so the overwritten company_id is never flushed
            db.expunge(user)
            user.company_id = x_company_id

    return user


CurrentUser = Annotated[User, Depends(_get_current_user)]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = _client_ip(request)
    ua = _user_agent(request)

    try:
        user = await attempt_login(db, body.email, body.password)
    except PermissionError as e:
        raise HTTPException(status_code=423, detail=str(e))

    if not user:
        await write_audit(
            db, action="LOGIN_FAILED", resource_type="user",
            user_email=body.email, ip_address=ip, user_agent=ua,
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await write_audit(
        db, action="LOGIN_ATTEMPT", resource_type="user",
        user_id=user.id, user_email=user.email,
        company_id=user.company_id, ip_address=ip, user_agent=ua,
    )

    # MFA bypass for local dev (MFA_ENABLED=false in .env)
    from app.core.config import settings as _settings
    if not _settings.MFA_ENABLED:
        access_token, refresh_token, _ = await create_session(db, user.id, ip, ua)
        await write_audit(db, action="LOGIN_SUCCESS", resource_type="user", user_id=user.id, user_email=user.email, company_id=user.company_id, ip_address=ip, user_agent=ua)
        return LoginResponse(
            mfa_required=False, mfa_method="none",
            access_token=access_token, refresh_token=refresh_token,
            user={"id": user.id, "email": user.email, "role": user.role.value, "full_name": user.full_name, "company_id": user.company_id},
        )

    # If TOTP is enabled
    if user.totp_enabled and user.totp_secret:
        from app.services.auth_service import create_access_token
        from uuid import uuid4
        temp_jti = str(uuid4())
        from jose import jwt as _jwt
        from app.core.config import settings
        from datetime import timedelta
        temp_payload = {
            "sub": user.id,
            "jti": temp_jti,
            "type": "temp_mfa",
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        }
        temp_token = _jwt.encode(temp_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        return LoginResponse(mfa_required=True, mfa_method="totp", temp_token=temp_token)

    # Email OTP fallback
    code = await create_email_otp(db, user.id, "login_mfa")
    await _send_otp_email(user.email, code)

    from jose import jwt as _jwt
    from app.core.config import settings
    from datetime import timedelta
    from uuid import uuid4
    temp_payload = {
        "sub": user.id,
        "jti": str(uuid4()),
        "type": "temp_mfa",
        "exp": datetime.now(UTC) + timedelta(minutes=10),
    }
    temp_token = _jwt.encode(temp_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return LoginResponse(mfa_required=True, mfa_method="email_otp", temp_token=temp_token)


@router.post("/verify-totp", response_model=LoginResponse)
async def verify_totp_route(body: TOTPVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
    from app.core.config import settings
    from jose import jwt as _jwt

    try:
        payload = _jwt.decode(body.temp_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired temp token")

    if payload.get("type") != "temp_mfa":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not verify_totp(user.totp_secret, body.totp_code):
        raise HTTPException(status_code=401, detail="Invalid TOTP code")

    ip = _client_ip(request)
    ua = _user_agent(request)
    access_token, refresh_token, _ = await create_session(db, user.id, ip, ua)
    await write_audit(db, action="LOGIN_SUCCESS", resource_type="user", user_id=user.id, user_email=user.email, company_id=user.company_id, ip_address=ip, user_agent=ua)
    return LoginResponse(
        mfa_required=False,
        mfa_method="totp",
        access_token=access_token,
        refresh_token=refresh_token,
        user={"id": user.id, "email": user.email, "role": user.role.value, "full_name": user.full_name, "company_id": user.company_id},
    )


@router.post("/verify-otp", response_model=LoginResponse)
async def verify_otp_route(body: OTPVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
    from app.core.config import settings
    from jose import jwt as _jwt

    try:
        payload = _jwt.decode(body.temp_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired temp token")

    if payload.get("type") != "temp_mfa":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not await verify_email_otp(db, user.id, "login_mfa", body.otp_code):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    ip = _client_ip(request)
    ua = _user_agent(request)
    access_token, refresh_token, _ = await create_session(db, user.id, ip, ua)
    await write_audit(db, action="LOGIN_SUCCESS", resource_type="user", user_id=user.id, user_email=user.email, company_id=user.company_id, ip_address=ip, user_agent=ua)
    return LoginResponse(
        mfa_required=False,
        mfa_method="email_otp",
        access_token=access_token,
        refresh_token=refresh_token,
        user={"id": user.id, "email": user.email, "role": user.role.value, "full_name": user.full_name, "company_id": user.company_id},
    )


@router.post("/refresh")
async def refresh_token(body: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    from app.core.config import settings
    from jose import jwt as _jwt

    try:
        payload = _jwt.decode(body.refresh_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")

    jti = payload["jti"]
    if not await is_session_valid(db, jti):
        raise HTTPException(status_code=401, detail="Session expired or revoked")

    # Revoke old session, create new one
    await revoke_session(db, jti)
    user_id = payload["sub"]
    ip = _client_ip(request)
    ua = _user_agent(request)
    access_token, refresh_token_new, _ = await create_session(db, user_id, ip, ua)
    return {"access_token": access_token, "refresh_token": refresh_token_new}


@router.post("/logout")
async def logout(current_user: CurrentUser, request: Request, db: AsyncSession = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    if authorization:
        token = authorization.split(" ", 1)[1]
        try:
            payload = decode_token(token)
            await revoke_session(db, payload["jti"])
        except Exception:
            pass
    await write_audit(db, action="LOGOUT", resource_type="user", user_id=current_user.id, user_email=current_user.email, company_id=current_user.company_id, ip_address=_client_ip(request))
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    from app.models.models import Company
    company = await db.get(Company, current_user.company_id)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "company_id": current_user.company_id,
        "company_name": company.name if company else None,
        "company_logo": company.logo_url if company else None,
        "totp_enabled": current_user.totp_enabled,
        "must_change_pw": current_user.must_change_pw,
    }


@router.post("/setup-totp/initiate")
async def initiate_totp_setup(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """Step 1: generate TOTP secret and return QR URI. Requires email OTP confirmation."""
    code = await create_email_otp(db, current_user.id, "totp_setup")
    await _send_otp_email(current_user.email, code)
    return {"message": "OTP sent to your email. Use /setup-totp/confirm to enable TOTP."}


@router.post("/setup-totp/confirm")
async def confirm_totp_setup(body: TOTPSetupRequest, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """Step 2: verify email OTP, generate new TOTP secret, return provisioning URI."""
    if not await verify_email_otp(db, current_user.id, "totp_setup", body.otp_code):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    secret = generate_totp_secret()
    uri = get_totp_uri(secret, current_user.email)

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    user.totp_secret = secret
    user.totp_enabled = True
    await db.flush()

    await write_audit(db, action="TOTP_ENABLED", resource_type="user", user_id=current_user.id, user_email=current_user.email, company_id=current_user.company_id)
    return {"totp_secret": secret, "totp_uri": uri}


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Self-service account registration — creates a new company + super_admin user."""
    from app.models.models import Company
    from app.services.auth_service import hash_password
    import re

    # Validate password strength
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if not re.search(r"[A-Z]", body.password):
        raise HTTPException(status_code=422, detail="Password must contain at least one uppercase letter")
    if not re.search(r"[0-9]", body.password):
        raise HTTPException(status_code=422, detail="Password must contain at least one number")

    # Check email not already taken
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    # Derive a unique company code and schema from company name
    base = re.sub(r"[^a-z0-9]", "", body.company_name.lower())[:10] or "company"
    from sqlalchemy import text as _text
    suffix_row = await db.execute(_text("SELECT COUNT(*) FROM companies WHERE code LIKE :pat"), {"pat": f"{base}%"})
    suffix = suffix_row.scalar() or 0
    code = base if suffix == 0 else f"{base}{suffix}"
    schema = f"co_{code}"

    company = Company(
        code=code.upper(),
        name=body.company_name,
        legal_name=body.company_name,
        db_schema=schema,
    )
    db.add(company)
    await db.flush()

    user = User(
        company_id=company.id,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.SUPER_ADMIN,
        must_change_pw=False,
    )
    db.add(user)
    await db.flush()

    await write_audit(
        db, action="USER_REGISTERED", resource_type="user",
        user_id=user.id, user_email=user.email, company_id=company.id,
        ip_address=_client_ip(request),
    )

    ip = _client_ip(request)
    ua = _user_agent(request)
    access_token, refresh_token, _ = await create_session(db, user.id, ip, ua)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"id": user.id, "email": user.email, "role": user.role.value, "full_name": user.full_name, "company_id": company.id},
    }


@router.post("/sensitive-otp")
async def request_sensitive_otp(body: SensitiveOTPRequest, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """Request an email OTP for a sensitive action (bank file release, payslip release, etc.)"""
    valid_purposes = {"bank_file_release", "payslip_release", "delete_employee", "mass_update"}
    if body.purpose not in valid_purposes:
        raise HTTPException(status_code=400, detail="Unknown purpose")
    code = await create_email_otp(db, current_user.id, body.purpose)
    await _send_otp_email(current_user.email, code)
    return {"message": f"OTP sent for purpose: {body.purpose}"}


# ---------------------------------------------------------------------------
# Email helper (simple SMTP)
# ---------------------------------------------------------------------------

async def _send_otp_email(to_email: str, code: str) -> None:
    """Send OTP via SMTP. Non-blocking — errors are logged, not raised."""
    import smtplib
    from email.mime.text import MIMEText
    from app.core.config import settings

    try:
        msg = MIMEText(
            f"Your Paylix verification code is: {code}\n\nThis code expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n\nIf you did not request this code, please contact your administrator immediately.",
            "plain",
        )
        msg["Subject"] = "Paylix - Verification Code"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            if settings.SMTP_TLS:
                smtp.starttls()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception as exc:
        logger.error("Failed to send OTP email to %s: %s", to_email, exc)
