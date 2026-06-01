"""
Paylix - Reports Routes
Payroll summary, headcount, cost centre, EPF/ETF, bank file downloads
"""
from __future__ import annotations

import csv
import io
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import (
    BankFile,
    Department,
    Employee,
    PayrollPeriod,
    Payslip,
    UserRole,
)
from app.routes.auth import CurrentUser

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger(__name__)


def _require_finance_or_above(user: CurrentUser):
    allowed = {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.FINANCE_USER}
    if user.role not in allowed:
        raise HTTPException(status_code=403, detail="Finance role required")


# ---------------------------------------------------------------------------
# Payroll Cost Summary (multi-period trend)
# ---------------------------------------------------------------------------

@router.get("/payroll-cost-trend")
async def payroll_cost_trend(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    year: int = Query(default=date.today().year),
):
    _require_finance_or_above(current_user)

    result = await db.execute(
        select(
            PayrollPeriod.month,
            func.sum(Payslip.gross_salary).label("total_gross"),
            func.sum(Payslip.net_salary).label("total_net"),
            func.sum(Payslip.epf_employee + Payslip.epf_employer).label("total_epf"),
            func.sum(Payslip.etf_employer).label("total_etf"),
            func.sum(Payslip.apit).label("total_apit"),
            func.sum(Payslip.ot_amount).label("total_ot"),
            func.count(Payslip.id).label("headcount"),
        )
        .join(PayrollPeriod, Payslip.period_id == PayrollPeriod.id)
        .where(
            PayrollPeriod.company_id == current_user.company_id,
            PayrollPeriod.year == year,
        )
        .group_by(PayrollPeriod.month)
        .order_by(PayrollPeriod.month)
    )
    rows = result.all()

    return [
        {
            "month": r.month,
            "total_gross": float(r.total_gross or 0),
            "total_net": float(r.total_net or 0),
            "total_epf": float(r.total_epf or 0),
            "total_etf": float(r.total_etf or 0),
            "total_apit": float(r.total_apit or 0),
            "total_ot": float(r.total_ot or 0),
            "employer_cost": float((r.total_gross or 0) + (r.total_epf or 0) + (r.total_etf or 0)),
            "headcount": r.headcount or 0,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Department Cost Report
# ---------------------------------------------------------------------------

@router.get("/department-cost/{period_id}")
async def department_cost_report(
    period_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    _require_finance_or_above(current_user)

    result = await db.execute(
        select(
            Department.name.label("department"),
            func.count(Payslip.id).label("headcount"),
            func.sum(Payslip.gross_salary).label("total_gross"),
            func.sum(Payslip.net_salary).label("total_net"),
            func.sum(Payslip.epf_employer + Payslip.etf_employer).label("employer_statutory"),
        )
        .join(Employee, Payslip.employee_id == Employee.id)
        .join(Department, Employee.department_id == Department.id)
        .where(
            Payslip.period_id == period_id,
            Payslip.company_id == current_user.company_id,
        )
        .group_by(Department.name)
        .order_by(Department.name)
    )
    rows = result.all()

    return [
        {
            "department": r.department,
            "headcount": r.headcount,
            "total_gross": float(r.total_gross or 0),
            "total_net": float(r.total_net or 0),
            "employer_statutory": float(r.employer_statutory or 0),
            "total_employer_cost": float((r.total_gross or 0) + (r.employer_statutory or 0)),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Headcount Report
# ---------------------------------------------------------------------------

@router.get("/headcount")
async def headcount_report(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    as_of_date: date = Query(default=date.today()),
):
    _require_finance_or_above(current_user)

    result = await db.execute(
        select(
            Employee.employment_type,
            Department.name.label("department"),
            func.count(Employee.id).label("count"),
        )
        .outerjoin(Department, Employee.department_id == Department.id)
        .where(
            Employee.company_id == current_user.company_id,
            Employee.is_active == True,
            Employee.join_date <= as_of_date,
        )
        .group_by(Employee.employment_type, Department.name)
        .order_by(Employee.employment_type, Department.name)
    )
    rows = result.all()

    return [
        {
            "employment_type": r.employment_type.value,
            "department": r.department or "Unassigned",
            "count": r.count,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Bank File Download
# ---------------------------------------------------------------------------

@router.get("/bank-files/{period_id}/download")
async def download_bank_file(
    period_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.FINANCE_USER}:
        raise HTTPException(status_code=403, detail="Finance role required")

    bf_result = await db.execute(
        select(BankFile).where(
            BankFile.period_id == period_id,
            BankFile.company_id == current_user.company_id,
        ).order_by(BankFile.generated_at.desc())
    )
    bank_file = bf_result.scalars().first()
    if not bank_file:
        raise HTTPException(status_code=404, detail="Bank file not generated yet")

    # Re-generate content on demand
    slip_result = await db.execute(
        select(Payslip, Employee)
        .join(Employee, Payslip.employee_id == Employee.id)
        .where(Payslip.period_id == period_id)
    )
    rows = slip_result.all()

    content = io.StringIO()
    for slip, emp in rows:
        account = (emp.bank_account_number or "").zfill(12)
        name = (emp.full_name or "")[:35].ljust(35)
        amount = str(int(float(slip.net_salary) * 100)).zfill(12)
        content.write(f"01{account}{name}{amount}LKR\n")

    period_res = await db.execute(select(PayrollPeriod).where(PayrollPeriod.id == period_id))
    period = period_res.scalar_one()

    filename = f"bank_file_{period.period_name.replace(' ', '_')}.txt"
    content.seek(0)
    return StreamingResponse(
        iter([content.read()]),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# Payroll Detail CSV Export
# ---------------------------------------------------------------------------

@router.get("/payroll-detail/{period_id}/csv")
async def payroll_detail_csv(
    period_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    _require_finance_or_above(current_user)

    period_res = await db.execute(
        select(PayrollPeriod).where(
            PayrollPeriod.id == period_id,
            PayrollPeriod.company_id == current_user.company_id,
        )
    )
    period = period_res.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    slip_result = await db.execute(
        select(Payslip, Employee)
        .join(Employee, Payslip.employee_id == Employee.id)
        .where(Payslip.period_id == period_id)
        .order_by(Employee.employee_number)
    )
    rows = slip_result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Emp No", "Name", "Department", "Employment Type",
        "Basic", "Gross", "Allowances", "OT", "No Pay Deduction",
        "EPF Employee 8%", "EPF Employer 12%", "ETF 3%", "APIT",
        "Total Deductions", "Net Pay",
        "Present Days", "Absent Days", "No Pay Days", "OT Hours",
    ])

    for slip, emp in rows:
        dept_result = await db.execute(
            select(Department).where(Department.id == emp.department_id)
        ) if emp.department_id else None
        dept_name = ""
        if dept_result:
            dept = dept_result.scalar_one_or_none()
            dept_name = dept.name if dept else ""

        writer.writerow([
            emp.employee_number,
            emp.full_name,
            dept_name,
            emp.employment_type.value,
            f"{float(slip.basic_salary):.2f}",
            f"{float(slip.gross_salary):.2f}",
            f"{float(slip.total_allowances):.2f}",
            f"{float(slip.ot_amount):.2f}",
            f"{float(slip.no_pay_deduction):.2f}",
            f"{float(slip.epf_employee):.2f}",
            f"{float(slip.epf_employer):.2f}",
            f"{float(slip.etf_employer):.2f}",
            f"{float(slip.apit):.2f}",
            f"{float(slip.total_deductions):.2f}",
            f"{float(slip.net_salary):.2f}",
            f"{float(slip.present_days):.1f}",
            f"{float(slip.absent_days):.1f}",
            f"{float(slip.no_pay_days):.1f}",
            f"{float(slip.ot_hours):.2f}",
        ])

    output.seek(0)
    filename = f"payroll_{period.period_name.replace(' ', '_')}.csv"
    return StreamingResponse(
        iter([output.read()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# Dashboard KPIs
# ---------------------------------------------------------------------------

@router.get("/dashboard-kpis")
async def dashboard_kpis(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Access denied")

    # Latest period
    period_result = await db.execute(
        select(PayrollPeriod)
        .where(PayrollPeriod.company_id == current_user.company_id)
        .order_by(PayrollPeriod.year.desc(), PayrollPeriod.month.desc())
        .limit(1)
    )
    latest_period = period_result.scalar_one_or_none()

    active_employees = (
        await db.execute(
            select(func.count(Employee.id)).where(
                Employee.company_id == current_user.company_id,
                Employee.is_active == True,
            )
        )
    ).scalar() or 0

    kpis = {
        "active_employees": active_employees,
        "latest_period": None,
        "total_net_pay": 0.0,
        "pending_payroll_approvals": 0,
    }

    if latest_period:
        agg = await db.execute(
            select(func.sum(Payslip.net_salary)).where(Payslip.period_id == latest_period.id)
        )
        kpis["latest_period"] = {
            "id": latest_period.id,
            "name": latest_period.period_name,
            "status": latest_period.status.value,
        }
        kpis["total_net_pay"] = float(agg.scalar() or 0)

    pending_result = await db.execute(
        select(func.count(PayrollPeriod.id)).where(
            PayrollPeriod.company_id == current_user.company_id,
            PayrollPeriod.status.in_(["hr_review", "client_approval"]),
        )
    )
    kpis["pending_payroll_approvals"] = pending_result.scalar() or 0

    return kpis
