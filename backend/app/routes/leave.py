"""
Paylix - Leave Management Routes
4-step approval: Employee → Supervisor → HR → Client Admin → (Payroll Admin final)
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import (
    Employee,
    LeaveBalance,
    LeaveRequest,
    LeaveStatus,
    LeaveType,
    PublicHoliday,
    UserRole,
)
from app.routes.auth import CurrentUser
from app.services.auth_service import write_audit

router = APIRouter(prefix="/leave", tags=["leave"])
logger = logging.getLogger(__name__)

UTC = timezone.utc


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LeaveRequestCreate(BaseModel):
    leave_type_id: str
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveActionRequest(BaseModel):
    action: str   # "approve" | "reject"
    note: Optional[str] = None


class LeaveTypeCreate(BaseModel):
    code: str
    name: str
    days_entitled: int = 14
    is_carry_forward: bool = False
    max_carry_days: int = 0
    is_paid: bool = True
    is_medical: bool = False
    requires_document: bool = False


class HolidayCreate(BaseModel):
    name: str
    holiday_date: date
    is_recurring: bool = False
    is_paid: bool = True


class LeaveAllocateCreate(BaseModel):
    employee_id: str
    leave_type_id: str
    year: int
    entitled_days: float
    carried_forward: float = 0.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _working_days_between(start: date, end: date) -> Decimal:
    """Count working days (Mon-Fri) between two dates inclusive."""
    from datetime import timedelta
    count = Decimal("0")
    current = start
    while current <= end:
        if current.weekday() < 5:  # 0-4 = Mon-Fri
            count += Decimal("1")
        current += timedelta(days=1)
    return count


def _serialize_leave_request(lr: LeaveRequest) -> dict:
    return {
        "id": lr.id,
        "employee_id": lr.employee_id,
        "leave_type_id": lr.leave_type_id,
        "start_date": str(lr.start_date),
        "end_date": str(lr.end_date),
        "total_days": float(lr.total_days),
        "reason": lr.reason,
        "status": lr.status.value,
        "supervisor_action": lr.supervisor_action,
        "supervisor_note": lr.supervisor_note,
        "supervisor_at": lr.supervisor_at.isoformat() if lr.supervisor_at else None,
        "hr_action": lr.hr_action,
        "hr_note": lr.hr_note,
        "hr_at": lr.hr_at.isoformat() if lr.hr_at else None,
        "client_action": lr.client_action,
        "client_note": lr.client_note,
        "client_at": lr.client_at.isoformat() if lr.client_at else None,
        "final_action": lr.final_action,
        "final_note": lr.final_note,
        "final_at": lr.final_at.isoformat() if lr.final_at else None,
        "created_at": lr.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Leave Type management
# ---------------------------------------------------------------------------

@router.get("/types")
async def list_leave_types(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LeaveType).where(
            LeaveType.company_id == current_user.company_id,
            LeaveType.is_active == True,
        ).order_by(LeaveType.name)
    )
    types = result.scalars().all()
    return [
        {
            "id": lt.id,
            "code": lt.code,
            "name": lt.name,
            "days_entitled": lt.days_entitled,
            "is_carry_forward": lt.is_carry_forward,
            "is_paid": lt.is_paid,
            "is_medical": lt.is_medical,
            "requires_document": lt.requires_document,
        }
        for lt in types
    ]


@router.post("/types", status_code=201)
async def create_leave_type(body: LeaveTypeCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.HR_USER}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    lt = LeaveType(company_id=current_user.company_id, **body.model_dump())
    db.add(lt)
    await db.flush()
    return {"id": lt.id, "name": lt.name}


# ---------------------------------------------------------------------------
# Leave balance
# ---------------------------------------------------------------------------

@router.get("/balances")
async def get_leave_balances(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    employee_id: Optional[str] = Query(None),
    year: int = Query(default=date.today().year),
):
    target_employee_id = employee_id if employee_id else current_user.employee_id

    if current_user.role == UserRole.EMPLOYEE:
        target_employee_id = current_user.employee_id

    result = await db.execute(
        select(LeaveBalance, LeaveType)
        .join(LeaveType, LeaveBalance.leave_type_id == LeaveType.id)
        .where(
            LeaveBalance.employee_id == target_employee_id,
            LeaveBalance.year == year,
        )
    )
    balances = result.all()
    return [
        {
            "leave_type_id": lb.leave_type_id,
            "leave_type_name": lt.name,
            "year": lb.year,
            "entitled_days": float(lb.entitled_days),
            "used_days": float(lb.used_days),
            "pending_days": float(lb.pending_days),
            "carried_forward": float(lb.carried_forward),
            "remaining": float(lb.entitled_days + lb.carried_forward - lb.used_days - lb.pending_days),
        }
        for lb, lt in balances
    ]


# ---------------------------------------------------------------------------
# Leave requests
# ---------------------------------------------------------------------------

@router.get("/requests")
async def list_leave_requests(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    employee_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),   # accepts single value OR comma-separated e.g. "pending,approved"
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50),
):
    q = select(LeaveRequest).join(Employee, LeaveRequest.employee_id == Employee.id).where(
        Employee.company_id == current_user.company_id
    )

    if current_user.role == UserRole.EMPLOYEE:
        q = q.where(LeaveRequest.employee_id == current_user.employee_id)
    elif current_user.role == UserRole.SUPERVISOR:
        # Supervisors see their team's requests
        team_result = await db.execute(
            select(Employee.id).where(
                Employee.supervisor_id == current_user.employee_id,
                Employee.company_id == current_user.company_id,
            )
        )
        team_ids = [row[0] for row in team_result.all()]
        team_ids.append(current_user.employee_id or "")
        q = q.where(LeaveRequest.employee_id.in_(team_ids))
    elif employee_id:
        q = q.where(LeaveRequest.employee_id == employee_id)

    if status:
        # Support comma-separated status values: "pending,approved" or single "pending"
        status_values = [s.strip() for s in status.split(",") if s.strip()]
        try:
            parsed = [LeaveStatus(s) for s in status_values]
            if len(parsed) == 1:
                q = q.where(LeaveRequest.status == parsed[0])
            else:
                q = q.where(LeaveRequest.status.in_(parsed))
        except ValueError:
            pass  # ignore invalid status values
    if start_date:
        q = q.where(LeaveRequest.start_date >= start_date)
    if end_date:
        q = q.where(LeaveRequest.end_date <= end_date)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    q = q.order_by(LeaveRequest.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    requests = result.scalars().all()

    return {"total": total, "page": page, "items": [_serialize_leave_request(r) for r in requests]}


@router.post("/requests", status_code=201)
async def submit_leave_request(
    body: LeaveRequestCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    # Employees submit for themselves; HR/admin can submit for any employee
    if current_user.role == UserRole.EMPLOYEE:
        employee_id = current_user.employee_id
    else:
        raise HTTPException(status_code=403, detail="Use employee-specific endpoint")

    if not employee_id:
        raise HTTPException(status_code=400, detail="No employee profile linked to this user")

    # Validate leave type
    lt_result = await db.execute(
        select(LeaveType).where(
            LeaveType.id == body.leave_type_id,
            LeaveType.company_id == current_user.company_id,
            LeaveType.is_active == True,
        )
    )
    lt = lt_result.scalar_one_or_none()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")

    total_days = _working_days_between(body.start_date, body.end_date)
    if total_days <= 0:
        raise HTTPException(status_code=400, detail="No working days in requested period")

    # Check balance
    bal_result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == body.leave_type_id,
            LeaveBalance.year == body.start_date.year,
        )
    )
    balance = bal_result.scalar_one_or_none()
    if balance:
        available = balance.entitled_days + balance.carried_forward - balance.used_days - balance.pending_days
        if total_days > available:
            raise HTTPException(status_code=400, detail=f"Insufficient leave balance. Available: {float(available)} days")

    lr = LeaveRequest(
        employee_id=employee_id,
        leave_type_id=body.leave_type_id,
        start_date=body.start_date,
        end_date=body.end_date,
        total_days=total_days,
        reason=body.reason,
        status=LeaveStatus.PENDING,
    )
    db.add(lr)

    # Update pending balance
    if balance:
        balance.pending_days += total_days

    await db.flush()
    await write_audit(
        db, action="LEAVE_REQUESTED", resource_type="leave_request",
        resource_id=lr.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"employee_id": employee_id, "days": float(total_days)},
    )

    # Send email notification (non-blocking)
    try:
        emp_result = await db.execute(select(Employee).where(Employee.id == employee_id))
        emp = emp_result.scalar_one_or_none()
        if emp and emp.email:
            await _send_leave_email(
                to_email=emp.email,
                subject=f"Leave Request Submitted — {lt.name}",
                body=(
                    f"Hi {emp.full_name},\n\n"
                    f"Your leave request has been submitted successfully.\n\n"
                    f"Leave Type : {lt.name}\n"
                    f"From       : {body.start_date}\n"
                    f"To         : {body.end_date}\n"
                    f"Total Days : {float(total_days)}\n"
                    f"Status     : Pending Approval\n\n"
                    f"You will be notified once your request is reviewed.\n\n"
                    f"— Paylix HR System"
                )
            )
    except Exception:
        pass  # Email failure must never break the request

    return _serialize_leave_request(lr)


@router.post("/requests/{request_id}/supervisor-action")
async def supervisor_action(
    request_id: str,
    body: LeaveActionRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPERVISOR, UserRole.HR_USER, UserRole.CLIENT_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Supervisor role required")

    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id))
    lr = result.scalar_one_or_none()
    if not lr:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if lr.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot action a request in status: {lr.status.value}")

    lr.supervisor_action = body.action
    lr.supervisor_id = current_user.id
    lr.supervisor_note = body.note
    lr.supervisor_at = datetime.now(UTC)

    if body.action == "approve":
        lr.status = LeaveStatus.SUPERVISOR_APPROVED
    else:
        lr.status = LeaveStatus.REJECTED
        await _release_pending_balance(db, lr)

    await db.flush()
    await write_audit(db, action=f"LEAVE_SUPERVISOR_{body.action.upper()}", resource_type="leave_request", resource_id=lr.id, company_id=current_user.company_id, user_id=current_user.id, user_email=current_user.email)
    return _serialize_leave_request(lr)


@router.post("/requests/{request_id}/hr-action")
async def hr_action(
    request_id: str,
    body: LeaveActionRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.HR_USER, UserRole.CLIENT_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="HR role required")

    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id))
    lr = result.scalar_one_or_none()
    if not lr or lr.status != LeaveStatus.SUPERVISOR_APPROVED:
        raise HTTPException(status_code=400, detail="Request not at HR review stage")

    lr.hr_action = body.action
    lr.hr_id = current_user.id
    lr.hr_note = body.note
    lr.hr_at = datetime.now(UTC)

    if body.action == "approve":
        lr.status = LeaveStatus.HR_APPROVED
    else:
        lr.status = LeaveStatus.REJECTED
        await _release_pending_balance(db, lr)

    await db.flush()
    await write_audit(db, action=f"LEAVE_HR_{body.action.upper()}", resource_type="leave_request", resource_id=lr.id, company_id=current_user.company_id, user_id=current_user.id, user_email=current_user.email)
    return _serialize_leave_request(lr)


@router.post("/requests/{request_id}/client-action")
async def client_action(
    request_id: str,
    body: LeaveActionRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.CLIENT_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Client Admin role required")

    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id))
    lr = result.scalar_one_or_none()
    if not lr or lr.status != LeaveStatus.HR_APPROVED:
        raise HTTPException(status_code=400, detail="Request not at Client Approval stage")

    lr.client_action = body.action
    lr.client_id = current_user.id
    lr.client_note = body.note
    lr.client_at = datetime.now(UTC)

    if body.action == "approve":
        lr.status = LeaveStatus.CLIENT_APPROVED
    else:
        lr.status = LeaveStatus.REJECTED
        await _release_pending_balance(db, lr)

    await db.flush()
    await write_audit(db, action=f"LEAVE_CLIENT_{body.action.upper()}", resource_type="leave_request", resource_id=lr.id, company_id=current_user.company_id, user_id=current_user.id, user_email=current_user.email)
    return _serialize_leave_request(lr)


@router.post("/requests/{request_id}/final-action")
async def final_action(
    request_id: str,
    body: LeaveActionRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.PAYROLL_ADMIN, UserRole.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Payroll Admin role required")

    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id))
    lr = result.scalar_one_or_none()
    if not lr or lr.status != LeaveStatus.CLIENT_APPROVED:
        raise HTTPException(status_code=400, detail="Request not at final approval stage")

    lr.final_action = body.action
    lr.final_id = current_user.id
    lr.final_note = body.note
    lr.final_at = datetime.now(UTC)

    if body.action == "approve":
        lr.status = LeaveStatus.APPROVED
        # Move from pending to used
        bal_result = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == lr.employee_id,
                LeaveBalance.leave_type_id == lr.leave_type_id,
                LeaveBalance.year == lr.start_date.year,
            )
        )
        balance = bal_result.scalar_one_or_none()
        if balance:
            balance.pending_days = max(Decimal("0"), balance.pending_days - lr.total_days)
            balance.used_days += lr.total_days
    else:
        lr.status = LeaveStatus.REJECTED
        await _release_pending_balance(db, lr)

    await db.flush()
    await write_audit(db, action=f"LEAVE_FINAL_{body.action.upper()}", resource_type="leave_request", resource_id=lr.id, company_id=current_user.company_id, user_id=current_user.id, user_email=current_user.email)
    return _serialize_leave_request(lr)


@router.post("/requests/{request_id}/cancel")
async def cancel_leave_request(
    request_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id))
    lr = result.scalar_one_or_none()
    if not lr:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if current_user.role == UserRole.EMPLOYEE and lr.employee_id != current_user.employee_id:
        raise HTTPException(status_code=403, detail="Cannot cancel other employees' leave")

    if lr.status == LeaveStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Cannot cancel an approved leave — contact HR")

    if lr.status == LeaveStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Already cancelled")

    lr.status = LeaveStatus.CANCELLED
    await _release_pending_balance(db, lr)
    await db.flush()

    await write_audit(db, action="LEAVE_CANCELLED", resource_type="leave_request", resource_id=lr.id, company_id=current_user.company_id, user_id=current_user.id, user_email=current_user.email)
    return {"message": "Leave request cancelled"}


async def _release_pending_balance(db: AsyncSession, lr: LeaveRequest) -> None:
    bal_result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == lr.employee_id,
            LeaveBalance.leave_type_id == lr.leave_type_id,
            LeaveBalance.year == lr.start_date.year,
        )
    )
    balance = bal_result.scalar_one_or_none()
    if balance:
        balance.pending_days = max(Decimal("0"), balance.pending_days - lr.total_days)


@router.post("/requests/{request_id}/admin-action")
async def admin_action(
    request_id: str,
    body: LeaveActionRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Single-step approve/reject for HR/admin — bypasses multi-step flow."""
    allowed = {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.HR_USER}
    if current_user.role not in allowed:
        raise HTTPException(status_code=403, detail="HR or Admin role required")
    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    result = await db.execute(
        select(LeaveRequest).join(Employee, LeaveRequest.employee_id == Employee.id).where(
            LeaveRequest.id == request_id,
            Employee.company_id == current_user.company_id,
        )
    )
    lr = result.scalar_one_or_none()
    if not lr:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if lr.status in (LeaveStatus.APPROVED, LeaveStatus.REJECTED, LeaveStatus.CANCELLED):
        raise HTTPException(status_code=400, detail=f"Request already {lr.status.value}")

    if body.action == "approve":
        lr.status = LeaveStatus.APPROVED
        bal_result = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == lr.employee_id,
                LeaveBalance.leave_type_id == lr.leave_type_id,
                LeaveBalance.year == lr.start_date.year,
            )
        )
        balance = bal_result.scalar_one_or_none()
        if balance:
            balance.pending_days = max(Decimal("0"), balance.pending_days - lr.total_days)
            balance.used_days += lr.total_days
    else:
        lr.status = LeaveStatus.REJECTED
        await _release_pending_balance(db, lr)

    lr.supervisor_action = body.action
    lr.supervisor_id = current_user.id
    lr.supervisor_note = body.note
    lr.supervisor_at = datetime.now(UTC)
    await db.flush()

    # Notify employee by email
    try:
        emp_result = await db.execute(select(Employee).where(Employee.id == lr.employee_id))
        emp = emp_result.scalar_one_or_none()
        lt_result = await db.execute(select(LeaveType).where(LeaveType.id == lr.leave_type_id))
        lt = lt_result.scalar_one_or_none()
        if emp and emp.email and lt:
            action_word = "Approved ✅" if body.action == "approve" else "Rejected ❌"
            await _send_leave_email(
                to_email=emp.email,
                subject=f"Leave Request {action_word} — {lt.name}",
                body=(
                    f"Hi {emp.full_name},\n\n"
                    f"Your leave request has been {body.action}d by HR.\n\n"
                    f"Leave Type : {lt.name}\n"
                    f"From       : {lr.start_date}\n"
                    f"To         : {lr.end_date}\n"
                    f"Total Days : {float(lr.total_days)}\n"
                    f"Status     : {body.action.capitalize()}d\n"
                    + (f"Note       : {body.note}\n" if body.note else "")
                    + f"\n— Paylix HR System"
                )
            )
    except Exception:
        pass

    await write_audit(db, action=f"LEAVE_ADMIN_{body.action.upper()}", resource_type="leave_request",
                      resource_id=lr.id, company_id=current_user.company_id,
                      user_id=current_user.id, user_email=current_user.email,
                      payload={"action": body.action, "note": body.note})
    return _serialize_leave_request(lr)


async def _send_leave_email(to_email: str, subject: str, body: str) -> None:
    """Send leave notification email. Non-blocking — errors are logged silently."""
    import smtplib
    from email.mime.text import MIMEText
    from app.core.config import settings

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.debug("SMTP not configured — skipping leave email to %s", to_email)
        return

    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"]    = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"]      = to_email

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_TLS:
                smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        logger.info("Leave email sent to %s: %s", to_email, subject)
    except Exception as exc:
        logger.warning("Leave email failed to %s: %s", to_email, exc)


# ---------------------------------------------------------------------------
# Public Holidays
# ---------------------------------------------------------------------------

@router.get("/holidays")
async def list_holidays(
    year: Optional[int] = None,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(PublicHoliday).where(
        (PublicHoliday.company_id == current_user.company_id) |
        (PublicHoliday.company_id == None)
    )
    if year:
        q = q.where(func.extract("year", PublicHoliday.holiday_date) == year)
    q = q.order_by(PublicHoliday.holiday_date)
    result = await db.execute(q)
    holidays = result.scalars().all()
    return [
        {
            "id": h.id,
            "name": h.name,
            "holiday_date": str(h.holiday_date),
            "is_paid": h.is_paid,
            "is_recurring": h.is_recurring,
        }
        for h in holidays
    ]


@router.post("/holidays", status_code=201)
async def create_holiday(
    body: HolidayCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.HR_USER}:
        raise HTTPException(status_code=403, detail="Admin role required")
    h = PublicHoliday(
        company_id=current_user.company_id,
        name=body.name,
        holiday_date=body.holiday_date,
        is_recurring=body.is_recurring,
        is_paid=body.is_paid,
    )
    db.add(h)
    await db.flush()
    await write_audit(db, action="HOLIDAY_CREATE", resource_type="public_holiday", resource_id=h.id,
                      company_id=current_user.company_id, user_id=current_user.id, user_email=current_user.email)
    return {"id": h.id, "name": h.name, "holiday_date": str(h.holiday_date), "is_recurring": h.is_recurring, "is_paid": h.is_paid}


@router.delete("/holidays/{holiday_id}", status_code=200)
async def delete_holiday(
    holiday_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.HR_USER}:
        raise HTTPException(status_code=403, detail="Admin role required")
    result = await db.execute(select(PublicHoliday).where(PublicHoliday.id == holiday_id))
    h = result.scalar_one_or_none()
    if not h:
        raise HTTPException(status_code=404, detail="Holiday not found")
    await db.delete(h)
    return {"message": "Holiday deleted"}


# ---------------------------------------------------------------------------
# Leave Allocation (manual balance creation)
# ---------------------------------------------------------------------------

@router.get("/allocations")
async def list_allocations(
    employee_id: Optional[str] = None,
    year: Optional[int] = None,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(LeaveBalance, LeaveType, Employee)
        .join(LeaveType, LeaveBalance.leave_type_id == LeaveType.id)
        .join(Employee, LeaveBalance.employee_id == Employee.id)
        .where(Employee.company_id == current_user.company_id)
    )
    if employee_id:
        q = q.where(LeaveBalance.employee_id == employee_id)
    if year:
        q = q.where(LeaveBalance.year == year)
    q = q.order_by(Employee.full_name, LeaveBalance.year)
    result = await db.execute(q)
    rows = result.all()
    return [
        {
            "id": b.id,
            "employee_id": b.employee_id,
            "employee_name": e.full_name,
            "leave_type_id": b.leave_type_id,
            "leave_type_name": lt.name,
            "year": b.year,
            "entitled_days": float(b.entitled_days),
            "carried_forward": float(b.carried_forward),
            "used_days": float(b.used_days),
            "pending_days": float(b.pending_days),
            "remaining": float(b.entitled_days + b.carried_forward - b.used_days - b.pending_days),
        }
        for b, lt, e in rows
    ]


@router.post("/allocate", status_code=201)
async def allocate_leave(
    body: LeaveAllocateCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.HR_USER}:
        raise HTTPException(status_code=403, detail="HR role required")

    # Validate employee & leave type belong to company
    emp_res = await db.execute(select(Employee).where(Employee.id == body.employee_id, Employee.company_id == current_user.company_id))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    lt_res = await db.execute(select(LeaveType).where(LeaveType.id == body.leave_type_id, LeaveType.company_id == current_user.company_id))
    lt = lt_res.scalar_one_or_none()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")

    # Upsert balance
    bal_res = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == body.employee_id,
            LeaveBalance.leave_type_id == body.leave_type_id,
            LeaveBalance.year == body.year,
        )
    )
    balance = bal_res.scalar_one_or_none()
    if balance:
        balance.entitled_days = Decimal(str(body.entitled_days))
        balance.carried_forward = Decimal(str(body.carried_forward))
    else:
        balance = LeaveBalance(
            employee_id=body.employee_id,
            leave_type_id=body.leave_type_id,
            year=body.year,
            entitled_days=Decimal(str(body.entitled_days)),
            carried_forward=Decimal(str(body.carried_forward)),
        )
        db.add(balance)

    await db.flush()
    await write_audit(db, action="LEAVE_ALLOCATE", resource_type="leave_balance", resource_id=balance.id,
                      company_id=current_user.company_id, user_id=current_user.id, user_email=current_user.email,
                      payload={"employee_id": body.employee_id, "leave_type_id": body.leave_type_id,
                               "year": body.year, "entitled_days": body.entitled_days})
    return {
        "id": balance.id,
        "employee_name": emp.full_name,
        "leave_type_name": lt.name,
        "entitled_days": float(balance.entitled_days),
        "carried_forward": float(balance.carried_forward),
        "year": body.year,
    }
