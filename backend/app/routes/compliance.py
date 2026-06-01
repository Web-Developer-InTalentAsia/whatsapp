"""
Paylix - Compliance Routes
EPF/ETF schedules, APIT returns, tax tables management, audit log access
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import APCITaxTable, AuditLog, PayrollPeriod, Payslip, UserRole
from app.routes.auth import CurrentUser

router = APIRouter(prefix="/compliance", tags=["compliance"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TaxTableCreate(BaseModel):
    table_code: str
    effective_year: int
    income_from: float
    income_to: Optional[float] = None
    tax_rate: float
    fixed_deduction: float = 0.0


class TaxTableBulkLoad(BaseModel):
    entries: list[TaxTableCreate]


# ---------------------------------------------------------------------------
# APIT Tax Tables management
# ---------------------------------------------------------------------------

@router.get("/tax-tables")
async def list_tax_tables(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    table_code: Optional[str] = Query(None),
    effective_year: Optional[int] = Query(None),
):
    q = select(APCITaxTable).where(APCITaxTable.is_active == True)
    if table_code:
        q = q.where(APCITaxTable.table_code == table_code)
    if effective_year:
        q = q.where(APCITaxTable.effective_year == effective_year)
    q = q.order_by(APCITaxTable.table_code, APCITaxTable.effective_year, APCITaxTable.income_from)

    result = await db.execute(q)
    tables = result.scalars().all()
    return [
        {
            "id": t.id,
            "table_code": t.table_code,
            "effective_year": t.effective_year,
            "income_from": float(t.income_from),
            "income_to": float(t.income_to) if t.income_to else None,
            "tax_rate": float(t.tax_rate),
            "fixed_deduction": float(t.fixed_deduction),
        }
        for t in tables
    ]


@router.post("/tax-tables/bulk", status_code=201)
async def bulk_load_tax_tables(
    body: TaxTableBulkLoad,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN}:
        raise HTTPException(status_code=403, detail="Admin access required")

    created = 0
    for entry in body.entries:
        existing = await db.execute(
            select(APCITaxTable).where(
                APCITaxTable.table_code == entry.table_code,
                APCITaxTable.effective_year == entry.effective_year,
                APCITaxTable.income_from == entry.income_from,
            )
        )
        if existing.scalar_one_or_none():
            continue

        t = APCITaxTable(
            table_code=entry.table_code,
            effective_year=entry.effective_year,
            income_from=entry.income_from,
            income_to=entry.income_to,
            tax_rate=entry.tax_rate,
            fixed_deduction=entry.fixed_deduction,
        )
        db.add(t)
        created += 1

    await db.flush()
    return {"created": created}


# ---------------------------------------------------------------------------
# EPF / ETF Schedules
# ---------------------------------------------------------------------------

@router.get("/epf-schedule/{period_id}")
async def get_epf_schedule(
    period_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.FINANCE_USER}:
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

    from app.models.models import Employee
    slip_result = await db.execute(
        select(Payslip, Employee)
        .join(Employee, Payslip.employee_id == Employee.id)
        .where(
            Payslip.period_id == period_id,
            Payslip.company_id == current_user.company_id,
        )
    )
    rows = slip_result.all()

    schedule = []
    total_employee = 0.0
    total_employer = 0.0
    for slip, emp in rows:
        if not emp.is_epf_applicable:
            continue
        total_employee += float(slip.epf_employee)
        total_employer += float(slip.epf_employer)
        schedule.append({
            "employee_number": emp.employee_number,
            "employee_name": emp.full_name,
            "epf_number": emp.epf_number or "",
            "epf_wages": float(slip.basic_salary - slip.no_pay_deduction),
            "epf_employee_8": float(slip.epf_employee),
            "epf_employer_12": float(slip.epf_employer),
            "epf_total": float(slip.epf_employee + slip.epf_employer),
        })

    return {
        "period_name": period.period_name,
        "schedule": schedule,
        "totals": {
            "employee_contribution": total_employee,
            "employer_contribution": total_employer,
            "total": total_employee + total_employer,
        },
    }


@router.get("/etf-schedule/{period_id}")
async def get_etf_schedule(
    period_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.FINANCE_USER}:
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

    from app.models.models import Employee
    slip_result = await db.execute(
        select(Payslip, Employee)
        .join(Employee, Payslip.employee_id == Employee.id)
        .where(
            Payslip.period_id == period_id,
            Payslip.company_id == current_user.company_id,
        )
    )
    rows = slip_result.all()

    schedule = []
    total_etf = 0.0
    for slip, emp in rows:
        if not emp.is_etf_applicable:
            continue
        total_etf += float(slip.etf_employer)
        schedule.append({
            "employee_number": emp.employee_number,
            "employee_name": emp.full_name,
            "etf_wages": float(slip.basic_salary - slip.no_pay_deduction),
            "etf_3_percent": float(slip.etf_employer),
        })

    return {
        "period_name": period.period_name,
        "schedule": schedule,
        "total_etf": total_etf,
    }


@router.get("/apit-return/{period_id}")
async def get_apit_return(
    period_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.FINANCE_USER}:
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

    from app.models.models import Employee
    slip_result = await db.execute(
        select(Payslip, Employee)
        .join(Employee, Payslip.employee_id == Employee.id)
        .where(
            Payslip.period_id == period_id,
            Payslip.company_id == current_user.company_id,
        )
    )
    rows = slip_result.all()

    entries = []
    total_apit = 0.0
    for slip, emp in rows:
        if float(slip.apit) == 0:
            continue
        total_apit += float(slip.apit)
        entries.append({
            "employee_number": emp.employee_number,
            "employee_name": emp.full_name,
            "nic_number": emp.nic_number or "",
            "tax_file_number": emp.tax_file_number or "",
            "tax_table": slip.tax_table_used or "",
            "gross_taxable": float(slip.gross_salary),
            "apit_deducted": float(slip.apit),
        })

    return {
        "period_name": period.period_name,
        "entries": entries,
        "total_apit": total_apit,
    }


# ---------------------------------------------------------------------------
# Audit Log access
# ---------------------------------------------------------------------------

@router.get("/audit-log")
async def get_audit_log(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.AUDITOR}:
        raise HTTPException(status_code=403, detail="Auditor role required")

    q = select(AuditLog).where(AuditLog.company_id == current_user.company_id)

    if resource_type:
        q = q.where(AuditLog.resource_type == resource_type)
    if resource_id:
        q = q.where(AuditLog.resource_id == resource_id)
    if action:
        q = q.where(AuditLog.action.ilike(f"%{action}%"))
    if start_date:
        q = q.where(AuditLog.created_at >= start_date)
    if end_date:
        q = q.where(AuditLog.created_at <= end_date)

    from sqlalchemy import func as sqlfunc
    total = (await db.execute(select(sqlfunc.count()).select_from(q.subquery()))).scalar()
    q = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    logs = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "items": [
            {
                "id": log.id,
                "user_email": log.user_email,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "payload": log.payload,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
    }
