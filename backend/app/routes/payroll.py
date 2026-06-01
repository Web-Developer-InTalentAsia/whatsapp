"""
Paylix - Payroll Routes
Full workflow: Draft → Calculate → HR Review → Client Approval → Bank File → Payslip Release
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
    BankFile,
    Employee,
    PayrollPeriod,
    PayrollRule,
    PayrollStatus,
    Payslip,
    UserRole,
)
from app.routes.auth import CurrentUser
from app.services.auth_service import verify_email_otp, write_audit
from app.services.payroll_engine import calculate_period

router = APIRouter(prefix="/payroll", tags=["payroll"])
logger = logging.getLogger(__name__)

UTC = timezone.utc

# Status transition rules
VALID_TRANSITIONS: dict[PayrollStatus, list[tuple[PayrollStatus, set[UserRole]]]] = {
    PayrollStatus.DRAFT: [
        (PayrollStatus.CALCULATED, {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}),
    ],
    PayrollStatus.CALCULATED: [
        (PayrollStatus.HR_REVIEW, {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}),
        (PayrollStatus.DRAFT, {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}),
    ],
    PayrollStatus.HR_REVIEW: [
        (PayrollStatus.CLIENT_APPROVAL, {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.HR_USER}),
        (PayrollStatus.CALCULATED, {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.HR_USER}),
    ],
    PayrollStatus.CLIENT_APPROVAL: [
        (PayrollStatus.BANK_FILE, {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN}),
        (PayrollStatus.HR_REVIEW, {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN}),
    ],
    PayrollStatus.BANK_FILE: [
        (PayrollStatus.PAYSLIP_RELEASE, {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}),
    ],
    PayrollStatus.PAYSLIP_RELEASE: [
        (PayrollStatus.COMPLETED, {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}),
    ],
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PeriodCreate(BaseModel):
    year: int
    month: int
    pay_date: Optional[date] = None
    working_days: int = 26
    notes: Optional[str] = None


class StatusTransitionRequest(BaseModel):
    new_status: PayrollStatus
    otp_code: Optional[str] = None  # required for bank_file and payslip_release


class PayrollRuleCreate(BaseModel):
    rule_key: str
    rule_name: str
    rule_value: str
    value_type: str = "decimal"
    description: Optional[str] = None
    effective_from: date


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_period(p: PayrollPeriod) -> dict:
    return {
        "id": p.id,
        "period_name": p.period_name,
        "year": p.year,
        "month": p.month,
        "start_date": str(p.start_date),
        "end_date": str(p.end_date),
        "pay_date": str(p.pay_date) if p.pay_date else None,
        "status": p.status.value,
        "working_days": p.working_days,
        "notes": p.notes,
        "submitted_at": p.submitted_at.isoformat() if p.submitted_at else None,
        "hr_approved_at": p.hr_approved_at.isoformat() if p.hr_approved_at else None,
        "client_approved_at": p.client_approved_at.isoformat() if p.client_approved_at else None,
        "bank_file_generated_at": p.bank_file_generated_at.isoformat() if p.bank_file_generated_at else None,
        "payslip_released_at": p.payslip_released_at.isoformat() if p.payslip_released_at else None,
        "created_at": p.created_at.isoformat(),
    }


def _serialize_payslip(s: Payslip) -> dict:
    return {
        "id": s.id,
        "period_id": s.period_id,
        "employee_id": s.employee_id,
        "working_days": s.working_days,
        "present_days": float(s.present_days),
        "absent_days": float(s.absent_days),
        "no_pay_days": float(s.no_pay_days),
        "leave_days": float(s.leave_days),
        "ot_hours": float(s.ot_hours),
        "basic_salary": float(s.basic_salary),
        "gross_salary": float(s.gross_salary),
        "total_allowances": float(s.total_allowances),
        "ot_amount": float(s.ot_amount),
        "no_pay_deduction": float(s.no_pay_deduction),
        "epf_employee": float(s.epf_employee),
        "epf_employer": float(s.epf_employer),
        "etf_employer": float(s.etf_employer),
        "apit": float(s.apit),
        "total_deductions": float(s.total_deductions),
        "net_salary": float(s.net_salary),
        "earnings_detail": s.earnings_detail,
        "deductions_detail": s.deductions_detail,
        "tax_table_used": s.tax_table_used,
        "is_released": s.is_released,
        "computed_at": s.computed_at.isoformat() if s.computed_at else None,
    }


# ---------------------------------------------------------------------------
# Period routes
# ---------------------------------------------------------------------------

@router.get("/periods")
async def list_periods(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    year: Optional[int] = Query(None),
    status: Optional[PayrollStatus] = Query(None),
):
    q = select(PayrollPeriod).where(PayrollPeriod.company_id == current_user.company_id)
    if year:
        q = q.where(PayrollPeriod.year == year)
    if status:
        q = q.where(PayrollPeriod.status == status)
    q = q.order_by(PayrollPeriod.year.desc(), PayrollPeriod.month.desc())
    result = await db.execute(q)
    return [_serialize_period(p) for p in result.scalars().all()]


@router.post("/periods", status_code=201)
async def create_period(
    body: PeriodCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}:
        raise HTTPException(status_code=403, detail="Payroll Admin role required")

    import calendar
    _, last_day = calendar.monthrange(body.year, body.month)
    start = date(body.year, body.month, 1)
    end   = date(body.year, body.month, last_day)

    # Check duplicate
    existing = await db.execute(
        select(PayrollPeriod).where(
            PayrollPeriod.company_id == current_user.company_id,
            PayrollPeriod.year == body.year,
            PayrollPeriod.month == body.month,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Period already exists for this month")

    import calendar as cal
    period_name = f"{cal.month_name[body.month]} {body.year}"
    period = PayrollPeriod(
        company_id=current_user.company_id,
        period_name=period_name,
        year=body.year,
        month=body.month,
        start_date=start,
        end_date=end,
        pay_date=body.pay_date,
        working_days=body.working_days,
        notes=body.notes,
    )
    db.add(period)
    await db.flush()

    await write_audit(
        db, action="PERIOD_CREATED", resource_type="payroll_period",
        resource_id=period.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"year": body.year, "month": body.month},
    )
    return _serialize_period(period)


@router.post("/periods/{period_id}/calculate")
async def calculate_payroll(
    period_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}:
        raise HTTPException(status_code=403, detail="Payroll Admin role required")

    result = await db.execute(
        select(PayrollPeriod).where(
            PayrollPeriod.id == period_id,
            PayrollPeriod.company_id == current_user.company_id,
        )
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    if period.status not in {PayrollStatus.DRAFT, PayrollStatus.CALCULATED}:
        raise HTTPException(status_code=400, detail=f"Cannot calculate in status: {period.status.value}")

    payslips = await calculate_period(db, current_user.company_id, period)
    period.status = PayrollStatus.CALCULATED
    period.submitted_by = current_user.id
    period.submitted_at = datetime.now(UTC)
    await db.flush()

    await write_audit(
        db, action="PAYROLL_CALCULATED", resource_type="payroll_period",
        resource_id=period.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"payslip_count": len(payslips)},
    )
    return {"period_id": period_id, "payslips_generated": len(payslips), "status": period.status.value}


@router.post("/periods/{period_id}/transition")
async def transition_status(
    period_id: str,
    body: StatusTransitionRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PayrollPeriod).where(
            PayrollPeriod.id == period_id,
            PayrollPeriod.company_id == current_user.company_id,
        )
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    # Validate transition
    allowed = VALID_TRANSITIONS.get(period.status, [])
    transition = next((t for t in allowed if t[0] == body.new_status), None)
    if not transition:
        raise HTTPException(status_code=400, detail=f"Invalid transition: {period.status.value} → {body.new_status.value}")

    _, required_roles = transition
    if current_user.role not in required_roles:
        raise HTTPException(status_code=403, detail="Insufficient role for this transition")

    # Sensitive transitions require email OTP
    sensitive = {PayrollStatus.BANK_FILE, PayrollStatus.PAYSLIP_RELEASE, PayrollStatus.COMPLETED}
    if body.new_status in sensitive:
        if not body.otp_code:
            raise HTTPException(status_code=400, detail="OTP code required for this transition")
        purpose_map = {
            PayrollStatus.BANK_FILE: "bank_file_release",
            PayrollStatus.PAYSLIP_RELEASE: "payslip_release",
            PayrollStatus.COMPLETED: "payslip_release",
        }
        if not await verify_email_otp(db, current_user.id, purpose_map[body.new_status], body.otp_code):
            raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    now = datetime.now(UTC)
    period.status = body.new_status

    # Track approver timestamps
    if body.new_status == PayrollStatus.HR_REVIEW:
        period.hr_approved_by = current_user.id
        period.hr_approved_at = now
    elif body.new_status == PayrollStatus.CLIENT_APPROVAL:
        period.client_approved_by = current_user.id
        period.client_approved_at = now
    elif body.new_status == PayrollStatus.BANK_FILE:
        period.bank_file_generated_by = current_user.id
        period.bank_file_generated_at = now
        await _generate_bank_file(db, period, current_user.id)
    elif body.new_status == PayrollStatus.PAYSLIP_RELEASE:
        period.payslip_released_by = current_user.id
        period.payslip_released_at = now
        await _release_payslips(db, period)

    await db.flush()
    await write_audit(
        db, action=f"PAYROLL_TRANSITION_{body.new_status.value.upper()}",
        resource_type="payroll_period",
        resource_id=period.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
    )
    return _serialize_period(period)


@router.get("/periods/{period_id}/payslips")
async def list_payslips(
    period_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    employee_id: Optional[str] = Query(None),
):
    # Employees can only see own payslip (if released)
    q = select(Payslip).where(
        Payslip.period_id == period_id,
        Payslip.company_id == current_user.company_id,
    )

    if current_user.role == UserRole.EMPLOYEE:
        q = q.where(
            Payslip.employee_id == current_user.employee_id,
            Payslip.is_released == True,
        )
    elif employee_id:
        q = q.where(Payslip.employee_id == employee_id)

    result = await db.execute(q)
    slips = result.scalars().all()
    return [_serialize_payslip(s) for s in slips]


@router.get("/payslips/{payslip_id}")
async def get_payslip(
    payslip_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payslip).where(
            Payslip.id == payslip_id,
            Payslip.company_id == current_user.company_id,
        )
    )
    slip = result.scalar_one_or_none()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    if current_user.role == UserRole.EMPLOYEE:
        if slip.employee_id != current_user.employee_id or not slip.is_released:
            raise HTTPException(status_code=403, detail="Access denied")

    return _serialize_payslip(slip)


# ---------------------------------------------------------------------------
# Payroll Rule management
# ---------------------------------------------------------------------------

@router.get("/rules")
async def list_rules(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN}:
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(
        select(PayrollRule).where(
            PayrollRule.company_id == current_user.company_id,
            PayrollRule.is_active == True,
        ).order_by(PayrollRule.rule_key)
    )
    rules = result.scalars().all()
    return [
        {
            "id": r.id,
            "rule_key": r.rule_key,
            "rule_name": r.rule_name,
            "rule_value": r.rule_value,
            "value_type": r.value_type,
            "description": r.description,
            "effective_from": str(r.effective_from),
            "effective_to": str(r.effective_to) if r.effective_to else None,
        }
        for r in rules
    ]


@router.post("/rules", status_code=201)
async def create_rule(
    body: PayrollRuleCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}:
        raise HTTPException(status_code=403, detail="Payroll Admin role required")

    rule = PayrollRule(
        company_id=current_user.company_id,
        **body.model_dump(),
    )
    db.add(rule)
    await db.flush()
    await write_audit(
        db, action="RULE_CREATED", resource_type="payroll_rule",
        resource_id=rule.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"key": body.rule_key, "value": body.rule_value},
    )
    return {"id": rule.id, "rule_key": rule.rule_key}


class PayrollRuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    rule_value: Optional[str] = None
    value_type: Optional[str] = None
    description: Optional[str] = None
    effective_from: Optional[date] = None


@router.patch("/rules/{rule_id}", status_code=200)
async def update_rule(
    rule_id: str,
    body: PayrollRuleUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}:
        raise HTTPException(status_code=403, detail="Payroll Admin role required")

    result = await db.execute(
        select(PayrollRule).where(
            PayrollRule.id == rule_id,
            PayrollRule.company_id == current_user.company_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(rule, field, value)

    await db.flush()
    await write_audit(
        db, action="RULE_UPDATED", resource_type="payroll_rule",
        resource_id=rule.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"key": rule.rule_key},
    )
    return {
        "id": rule.id, "rule_key": rule.rule_key,
        "rule_name": rule.rule_name, "rule_value": rule.rule_value,
        "value_type": rule.value_type, "description": rule.description,
        "effective_from": str(rule.effective_from),
    }


@router.delete("/rules/{rule_id}", status_code=200)
async def delete_rule(
    rule_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}:
        raise HTTPException(status_code=403, detail="Payroll Admin role required")

    result = await db.execute(
        select(PayrollRule).where(
            PayrollRule.id == rule_id,
            PayrollRule.company_id == current_user.company_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.is_active = False
    await db.flush()
    await write_audit(
        db, action="RULE_DELETED", resource_type="payroll_rule",
        resource_id=rule_id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"key": rule.rule_key},
    )
    return {"message": "Rule deactivated"}


# ---------------------------------------------------------------------------
# Period summary / dashboard stats
# ---------------------------------------------------------------------------

@router.get("/periods/{period_id}/summary")
async def period_summary(
    period_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.FINANCE_USER, UserRole.HR_USER}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(
        select(PayrollPeriod).where(
            PayrollPeriod.id == period_id,
            PayrollPeriod.company_id == current_user.company_id,
        )
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    agg = await db.execute(
        select(
            func.count(Payslip.id).label("employee_count"),
            func.sum(Payslip.gross_salary).label("total_gross"),
            func.sum(Payslip.net_salary).label("total_net"),
            func.sum(Payslip.epf_employee).label("total_epf_employee"),
            func.sum(Payslip.epf_employer).label("total_epf_employer"),
            func.sum(Payslip.etf_employer).label("total_etf"),
            func.sum(Payslip.apit).label("total_apit"),
            func.sum(Payslip.ot_amount).label("total_ot"),
            func.sum(Payslip.no_pay_deduction).label("total_no_pay"),
        ).where(
            Payslip.period_id == period_id,
            Payslip.company_id == current_user.company_id,
        )
    )
    row = agg.one()

    return {
        "period": _serialize_period(period),
        "summary": {
            "employee_count": row.employee_count or 0,
            "total_gross": float(row.total_gross or 0),
            "total_net": float(row.total_net or 0),
            "total_epf_employee": float(row.total_epf_employee or 0),
            "total_epf_employer": float(row.total_epf_employer or 0),
            "total_etf": float(row.total_etf or 0),
            "total_apit": float(row.total_apit or 0),
            "total_ot": float(row.total_ot or 0),
            "total_no_pay": float(row.total_no_pay or 0),
            "total_employer_cost": float(
                (row.total_gross or 0) + (row.total_epf_employer or 0) + (row.total_etf or 0)
            ),
        },
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _generate_bank_file(db: AsyncSession, period: PayrollPeriod, generated_by: str) -> None:
    from app.services.payroll_engine import generate_bank_file_comb

    slip_result = await db.execute(
        select(Payslip).where(Payslip.period_id == period.id)
    )
    slips = slip_result.scalars().all()

    emp_result = await db.execute(
        select(Employee).where(Employee.company_id == period.company_id)
    )
    emp_map = {e.id: e for e in emp_result.scalars().all()}

    content = generate_bank_file_comb(slips, emp_map)
    total = sum(float(s.net_salary) for s in slips)

    bank_file = BankFile(
        period_id=period.id,
        company_id=period.company_id,
        file_format="COMB",
        total_amount=total,
        record_count=len(slips),
        generated_by=generated_by,
    )
    db.add(bank_file)


async def _release_payslips(db: AsyncSession, period: PayrollPeriod) -> None:
    slip_result = await db.execute(
        select(Payslip).where(Payslip.period_id == period.id)
    )
    for slip in slip_result.scalars().all():
        slip.is_released = True
