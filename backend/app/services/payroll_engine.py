"""
Paylix - Sri Lanka Payroll Engine
Implements:
  - APIT Tables 01–08 (IRD Sri Lanka)
  - EPF 8% employee / 12% employer
  - ETF 3% employer
  - OT @ 1.5x (configurable)
  - No-pay = basic / 26 (configurable working days)
  - Rule engine: all rates sourced from PayrollRule table
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    APCITaxTable,
    AttendanceRecord,
    Employee,
    EmployeeSalaryComponent,
    LeaveRequest,
    LeaveStatus,
    PayrollPeriod,
    PayrollRule,
    Payslip,
    SalaryComponent,
)

logger = logging.getLogger(__name__)

TWO = Decimal("0.01")
ZERO = Decimal("0")


# ---------------------------------------------------------------------------
# Rule engine helpers
# ---------------------------------------------------------------------------

class RuleEngine:
    """Load and cache payroll rules for a given company + period."""

    def __init__(self, rules: list[PayrollRule]):
        self._rules: dict[str, str] = {r.rule_key: r.rule_value for r in rules}

    def decimal(self, key: str, default: str) -> Decimal:
        return Decimal(self._rules.get(key, default))

    def integer(self, key: str, default: int) -> int:
        return int(self._rules.get(key, str(default)))

    def boolean(self, key: str, default: bool) -> bool:
        val = self._rules.get(key, str(default)).lower()
        return val in ("true", "1", "yes")


async def load_rules(db: AsyncSession, company_id: str, as_of: date) -> RuleEngine:
    result = await db.execute(
        select(PayrollRule).where(
            PayrollRule.company_id == company_id,
            PayrollRule.is_active == True,
            PayrollRule.effective_from <= as_of,
        ).order_by(PayrollRule.effective_from.desc())
    )
    # Take latest effective rule per key
    seen: dict[str, PayrollRule] = {}
    for rule in result.scalars():
        if rule.rule_key not in seen:
            seen[rule.rule_key] = rule
    return RuleEngine(list(seen.values()))


# ---------------------------------------------------------------------------
# APIT computation
# ---------------------------------------------------------------------------

async def compute_apit(
    db: AsyncSession,
    table_code: str,
    monthly_taxable_income: Decimal,
    effective_year: int,
) -> Decimal:
    """
    Compute APIT using the IRD Sri Lanka tax slabs for the given table.
    Monthly income is multiplied to annual equivalent, tax calculated, then divided by 12.
    """
    annual_income = monthly_taxable_income * 12

    result = await db.execute(
        select(APCITaxTable).where(
            APCITaxTable.table_code == table_code,
            APCITaxTable.effective_year == effective_year,
            APCITaxTable.is_active == True,
            APCITaxTable.income_from <= annual_income,
        ).order_by(APCITaxTable.income_from.desc())
    )
    slab = result.scalars().first()

    if not slab:
        return ZERO

    # APIT formula: (annual_income * rate) - fixed_deduction, divided by 12
    annual_tax = (annual_income * slab.tax_rate) - slab.fixed_deduction
    if annual_tax < ZERO:
        annual_tax = ZERO

    monthly_tax = (annual_tax / 12).quantize(TWO, rounding=ROUND_HALF_UP)
    return monthly_tax


# ---------------------------------------------------------------------------
# Attendance summary helpers
# ---------------------------------------------------------------------------

@dataclass
class AttendanceSummary:
    present_days: Decimal = ZERO
    absent_days: Decimal = ZERO
    no_pay_days: Decimal = ZERO
    leave_days: Decimal = ZERO
    ot_hours: Decimal = ZERO
    holiday_ot_hours: Decimal = ZERO


async def get_attendance_summary(
    db: AsyncSession,
    employee_id: str,
    start_date: date,
    end_date: date,
    working_days: int,
) -> AttendanceSummary:
    result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.work_date >= start_date,
            AttendanceRecord.work_date <= end_date,
        )
    )
    records = result.scalars().all()

    summary = AttendanceSummary()
    for rec in records:
        if rec.is_absent:
            summary.absent_days += Decimal("1")
        elif rec.is_half_day:
            summary.present_days += Decimal("0.5")
        else:
            summary.present_days += Decimal("1")

        ot_hrs = Decimal(rec.ot_minutes) / 60
        if rec.is_holiday:
            summary.holiday_ot_hours += ot_hrs
        else:
            summary.ot_hours += ot_hrs

    # Approved leave days
    leave_result = await db.execute(
        select(LeaveRequest).where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.start_date >= start_date,
            LeaveRequest.end_date <= end_date,
        )
    )
    leave_requests = leave_result.scalars().all()
    for lr in leave_requests:
        summary.leave_days += lr.total_days

    # No-pay = absent not covered by approved leave
    # (present + leave + no_pay = working_days)
    accounted = summary.present_days + summary.leave_days
    no_pay_raw = Decimal(working_days) - accounted
    summary.no_pay_days = max(ZERO, no_pay_raw)

    return summary


# ---------------------------------------------------------------------------
# Salary component loading
# ---------------------------------------------------------------------------

@dataclass
class ComponentLine:
    code: str
    name: str
    component_type: str
    is_taxable: bool
    is_epf_liable: bool
    amount: Decimal


async def get_active_components(
    db: AsyncSession,
    employee_id: str,
    as_of: date,
) -> list[ComponentLine]:
    result = await db.execute(
        select(EmployeeSalaryComponent, SalaryComponent)
        .join(SalaryComponent, EmployeeSalaryComponent.component_id == SalaryComponent.id)
        .where(
            EmployeeSalaryComponent.employee_id == employee_id,
            EmployeeSalaryComponent.is_active == True,
            EmployeeSalaryComponent.effective_from <= as_of,
            (EmployeeSalaryComponent.effective_to == None) | (EmployeeSalaryComponent.effective_to >= as_of),
        )
    )
    lines = []
    for esc, sc in result:
        lines.append(ComponentLine(
            code=sc.code,
            name=sc.name,
            component_type=sc.component_type,
            is_taxable=sc.is_taxable,
            is_epf_liable=sc.is_epf_liable,
            amount=esc.amount,
        ))
    return lines


# ---------------------------------------------------------------------------
# Core payslip calculation
# ---------------------------------------------------------------------------

@dataclass
class PayslipResult:
    employee_id: str
    # Days
    working_days: int = 26
    present_days: Decimal = ZERO
    absent_days: Decimal = ZERO
    no_pay_days: Decimal = ZERO
    leave_days: Decimal = ZERO
    ot_hours: Decimal = ZERO
    # Amounts
    basic_salary: Decimal = ZERO
    no_pay_deduction: Decimal = ZERO
    ot_amount: Decimal = ZERO
    holiday_ot_amount: Decimal = ZERO
    total_allowances: Decimal = ZERO
    gross_salary: Decimal = ZERO
    epf_employee: Decimal = ZERO
    epf_employer: Decimal = ZERO
    etf_employer: Decimal = ZERO
    apit: Decimal = ZERO
    other_deductions: Decimal = ZERO
    total_deductions: Decimal = ZERO
    net_salary: Decimal = ZERO
    # Detail lines
    earnings_detail: list[dict] = field(default_factory=list)
    deductions_detail: list[dict] = field(default_factory=list)
    tax_table_used: str = ""


async def calculate_payslip(
    db: AsyncSession,
    employee: Employee,
    period: PayrollPeriod,
    rules: RuleEngine,
) -> PayslipResult:
    r = PayslipResult(employee_id=employee.id)
    as_of = period.end_date

    # ---- Rules ----
    epf_emp_rate = rules.decimal("EPF_EMPLOYEE_RATE", "0.08")
    epf_er_rate  = rules.decimal("EPF_EMPLOYER_RATE", "0.12")
    etf_rate     = rules.decimal("ETF_EMPLOYER_RATE", "0.03")
    ot_mult      = rules.decimal("OT_MULTIPLIER", "1.5")
    hol_ot_mult  = rules.decimal("HOLIDAY_OT_MULTIPLIER", "2.0")
    working_days = rules.integer("WORKING_DAYS_PER_MONTH", period.working_days)

    r.working_days = working_days

    # ---- Attendance ----
    att = await get_attendance_summary(
        db, employee.id, period.start_date, period.end_date, working_days
    )
    r.present_days    = att.present_days.quantize(TWO)
    r.absent_days     = att.absent_days.quantize(TWO)
    r.no_pay_days     = att.no_pay_days.quantize(TWO)
    r.leave_days      = att.leave_days.quantize(TWO)
    r.ot_hours        = att.ot_hours.quantize(TWO)

    # ---- Basic Salary ----
    r.basic_salary = employee.basic_salary.quantize(TWO)

    # ---- No-pay deduction ----
    daily_rate = (r.basic_salary / working_days).quantize(TWO, ROUND_HALF_UP)
    r.no_pay_deduction = (daily_rate * r.no_pay_days).quantize(TWO, ROUND_HALF_UP)

    # ---- OT ----
    hourly_rate = (r.basic_salary / (working_days * 8)).quantize(TWO, ROUND_HALF_UP)
    r.ot_amount = (hourly_rate * ot_mult * r.ot_hours).quantize(TWO, ROUND_HALF_UP)
    r.holiday_ot_amount = (hourly_rate * hol_ot_mult * att.holiday_ot_hours).quantize(TWO, ROUND_HALF_UP)

    # ---- Allowances & deductions from components ----
    components = await get_active_components(db, employee.id, as_of)
    taxable_additions = ZERO
    epf_liable_additions = ZERO
    other_deductions = ZERO

    for comp in components:
        if comp.component_type == "earning":
            r.earnings_detail.append({"code": comp.code, "name": comp.name, "amount": float(comp.amount)})
            r.total_allowances += comp.amount
            if comp.is_taxable:
                taxable_additions += comp.amount
            if comp.is_epf_liable:
                epf_liable_additions += comp.amount

        elif comp.component_type == "deduction":
            r.deductions_detail.append({"code": comp.code, "name": comp.name, "amount": float(comp.amount)})
            other_deductions += comp.amount

    r.other_deductions = other_deductions.quantize(TWO)

    # ---- Gross ----
    r.gross_salary = (
        r.basic_salary - r.no_pay_deduction + r.total_allowances + r.ot_amount + r.holiday_ot_amount
    ).quantize(TWO, ROUND_HALF_UP)

    # ---- EPF/ETF base (basic + EPF-liable allowances) ----
    epf_base = (r.basic_salary - r.no_pay_deduction + epf_liable_additions).quantize(TWO, ROUND_HALF_UP)

    if employee.is_epf_applicable:
        r.epf_employee = (epf_base * epf_emp_rate).quantize(TWO, ROUND_HALF_UP)
        r.epf_employer = (epf_base * epf_er_rate).quantize(TWO, ROUND_HALF_UP)

    if employee.is_etf_applicable:
        r.etf_employer = (epf_base * etf_rate).quantize(TWO, ROUND_HALF_UP)

    # ---- APIT ----
    taxable_income = (r.basic_salary - r.no_pay_deduction + taxable_additions).quantize(TWO, ROUND_HALF_UP)
    table_code = employee.tax_table_code.value if employee.tax_table_code else "01"
    r.tax_table_used = table_code
    r.apit = await compute_apit(db, table_code, taxable_income, period.year)

    # ---- Totals ----
    r.total_deductions = (r.epf_employee + r.apit + r.other_deductions).quantize(TWO, ROUND_HALF_UP)
    r.net_salary = (r.gross_salary - r.total_deductions).quantize(TWO, ROUND_HALF_UP)

    return r


# ---------------------------------------------------------------------------
# Bulk period calculation
# ---------------------------------------------------------------------------

async def calculate_period(
    db: AsyncSession,
    company_id: str,
    period: PayrollPeriod,
) -> list[Payslip]:
    """Calculate all payslips for a payroll period. Returns upserted Payslip objects."""
    rules = await load_rules(db, company_id, period.end_date)

    # Load all active employees
    result = await db.execute(
        select(Employee).where(
            Employee.company_id == company_id,
            Employee.is_active == True,
            Employee.join_date <= period.end_date,
        )
    )
    employees = result.scalars().all()

    payslips = []
    for emp in employees:
        try:
            calc = await calculate_payslip(db, emp, period, rules)

            # Upsert payslip
            existing = await db.execute(
                select(Payslip).where(
                    Payslip.period_id == period.id,
                    Payslip.employee_id == emp.id,
                )
            )
            slip = existing.scalar_one_or_none()
            if not slip:
                slip = Payslip(period_id=period.id, employee_id=emp.id, company_id=company_id)
                db.add(slip)

            slip.working_days     = calc.working_days
            slip.present_days     = calc.present_days
            slip.absent_days      = calc.absent_days
            slip.no_pay_days      = calc.no_pay_days
            slip.leave_days       = calc.leave_days
            slip.ot_hours         = calc.ot_hours
            slip.basic_salary     = calc.basic_salary
            slip.gross_salary     = calc.gross_salary
            slip.total_allowances = calc.total_allowances
            slip.ot_amount        = calc.ot_amount + calc.holiday_ot_amount
            slip.no_pay_deduction = calc.no_pay_deduction
            slip.epf_employee     = calc.epf_employee
            slip.epf_employer     = calc.epf_employer
            slip.etf_employer     = calc.etf_employer
            slip.apit             = calc.apit
            slip.total_deductions = calc.total_deductions
            slip.net_salary       = calc.net_salary
            slip.earnings_detail  = calc.earnings_detail
            slip.deductions_detail= calc.deductions_detail
            slip.tax_table_used   = calc.tax_table_used

            from datetime import datetime, timezone
            slip.computed_at = datetime.now(timezone.utc)

            payslips.append(slip)
        except Exception as exc:
            logger.error("Failed to calculate payslip for employee %s: %s", emp.id, exc)

    await db.flush()
    return payslips


# ---------------------------------------------------------------------------
# Bank file generation (Peoples Bank / Commercial Bank format)
# ---------------------------------------------------------------------------

def generate_bank_file_comb(payslips: list[Payslip], employees: dict[str, Employee]) -> str:
    """Generate COMB (Bank of Ceylon) ACH text file."""
    lines = []
    for slip in payslips:
        emp = employees.get(slip.employee_id)
        if not emp:
            continue
        account = (emp.bank_account_number or "").zfill(12)
        name = (emp.full_name or "")[:35].ljust(35)
        amount = str(int(slip.net_salary * 100)).zfill(12)
        lines.append(f"01{account}{name}{amount}LKR")
    return "\n".join(lines)
