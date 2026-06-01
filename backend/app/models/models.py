"""
Paylix - SQLAlchemy ORM Models
Multi-tenant payroll BPO SaaS for InTalent Asia Sri Lanka
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey, Integer, JSON,
    Numeric, String, Text, UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def gen_uuid():
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    SUPER_ADMIN   = "super_admin"
    PAYROLL_ADMIN = "payroll_admin"
    CLIENT_ADMIN  = "client_admin"
    HR_USER       = "hr_user"
    FINANCE_USER  = "finance_user"
    SUPERVISOR    = "supervisor"
    EMPLOYEE      = "employee"
    AUDITOR       = "auditor"


class PayrollStatus(str, enum.Enum):
    DRAFT           = "draft"
    CALCULATED      = "calculated"
    HR_REVIEW       = "hr_review"
    CLIENT_APPROVAL = "client_approval"
    BANK_FILE       = "bank_file"
    PAYSLIP_RELEASE = "payslip_release"
    COMPLETED       = "completed"
    REJECTED        = "rejected"


class LeaveStatus(str, enum.Enum):
    PENDING            = "pending"
    SUPERVISOR_APPROVED = "supervisor_approved"
    HR_APPROVED        = "hr_approved"
    CLIENT_APPROVED    = "client_approved"
    APPROVED           = "approved"
    REJECTED           = "rejected"
    CANCELLED          = "cancelled"


class EmploymentType(str, enum.Enum):
    PERMANENT    = "permanent"
    CONTRACT     = "contract"
    PROBATION    = "probation"
    PART_TIME    = "part_time"
    INTERN       = "intern"


class AttendanceSource(str, enum.Enum):
    HIKVISION = "hikvision"
    MANUAL    = "manual"
    MOBILE    = "mobile"
    WEB       = "web"


class OvertimeType(str, enum.Enum):
    NORMAL  = "normal"   # 1.5x
    HOLIDAY = "holiday"  # 2.0x
    DOUBLE  = "double"   # 2.0x


class TaxTableCode(str, enum.Enum):
    TABLE_01 = "01"
    TABLE_02 = "02"
    TABLE_03 = "03"
    TABLE_04 = "04"
    TABLE_05 = "05"
    TABLE_06 = "06"
    TABLE_07 = "07"
    TABLE_08 = "08"


# ---------------------------------------------------------------------------
# Core / Master tables (public schema, super-admin scope)
# ---------------------------------------------------------------------------

class Company(Base):
    __tablename__ = "companies"

    id            : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    code          : Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name          : Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name    : Mapped[str] = mapped_column(String(255), nullable=False)
    reg_number    : Mapped[Optional[str]] = mapped_column(String(50))
    epf_reg_number: Mapped[Optional[str]] = mapped_column(String(50))
    etf_reg_number: Mapped[Optional[str]] = mapped_column(String(50))
    address       : Mapped[Optional[str]] = mapped_column(Text)
    phone         : Mapped[Optional[str]] = mapped_column(String(20))
    email         : Mapped[Optional[str]] = mapped_column(String(255))
    db_schema     : Mapped[str] = mapped_column(String(63), unique=True, nullable=False)
    is_active     : Mapped[bool] = mapped_column(Boolean, default=True)
    logo_url      : Mapped[Optional[str]] = mapped_column(String(500))
    settings      : Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at    : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at    : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    users: Mapped[list["User"]] = relationship("User", back_populates="company")


class User(Base):
    __tablename__ = "users"

    id               : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id       : Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    email            : Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password  : Mapped[str] = mapped_column(String(255), nullable=False)
    full_name        : Mapped[str] = mapped_column(String(255), nullable=False)
    role             : Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    employee_id      : Mapped[Optional[str]] = mapped_column(String(36))
    totp_secret      : Mapped[Optional[str]] = mapped_column(String(64))
    totp_enabled     : Mapped[bool] = mapped_column(Boolean, default=False)
    is_active        : Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_pw   : Mapped[bool] = mapped_column(Boolean, default=True)
    last_login       : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until     : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at       : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at       : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company  : Mapped["Company"] = relationship("Company", back_populates="users")
    sessions : Mapped[list["UserSession"]] = relationship("UserSession", back_populates="user")
    otp_codes: Mapped[list["OTPCode"]] = relationship("OTPCode", back_populates="user")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id         : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id    : Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    jti        : Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    ip_address : Mapped[Optional[str]] = mapped_column(String(45))
    user_agent : Mapped[Optional[str]] = mapped_column(String(500))
    is_revoked : Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="sessions")


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id         : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id    : Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    code       : Mapped[str] = mapped_column(String(10), nullable=False)
    purpose    : Mapped[str] = mapped_column(String(50), nullable=False)
    is_used    : Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="otp_codes")


class AuditLog(Base):
    """Append-only audit log — never UPDATE or DELETE rows here."""
    __tablename__ = "audit_logs"

    id           : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id   : Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("companies.id"))
    user_id      : Mapped[Optional[str]] = mapped_column(String(36))
    user_email   : Mapped[Optional[str]] = mapped_column(String(255))
    action       : Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id  : Mapped[Optional[str]] = mapped_column(String(36))
    payload      : Mapped[Optional[dict]] = mapped_column(JSON)
    ip_address   : Mapped[Optional[str]] = mapped_column(String(45))
    user_agent   : Mapped[Optional[str]] = mapped_column(String(500))
    created_at   : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Company-scoped tables (live in company's schema but mapped globally here;
# each model carries a schema_prefix injected at query time via set_schema())
# ---------------------------------------------------------------------------

class Department(Base):
    __tablename__ = "departments"

    id          : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id  : Mapped[str] = mapped_column(String(36), nullable=False)
    code        : Mapped[str] = mapped_column(String(20), nullable=False)
    name        : Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id   : Mapped[Optional[str]] = mapped_column(String(36))
    manager_id  : Mapped[Optional[str]] = mapped_column(String(36))
    cost_center : Mapped[Optional[str]] = mapped_column(String(50))
    is_active   : Mapped[bool] = mapped_column(Boolean, default=True)
    created_at  : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employees: Mapped[list["Employee"]] = relationship("Employee", back_populates="department")


class Designation(Base):
    __tablename__ = "designations"

    id         : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id : Mapped[str] = mapped_column(String(36), nullable=False)
    code       : Mapped[str] = mapped_column(String(20), nullable=False)
    name       : Mapped[str] = mapped_column(String(255), nullable=False)
    grade      : Mapped[Optional[str]] = mapped_column(String(20))
    is_active  : Mapped[bool] = mapped_column(Boolean, default=True)


class Employee(Base):
    __tablename__ = "employees"

    id                   : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id           : Mapped[str] = mapped_column(String(36), nullable=False)
    employee_number      : Mapped[str] = mapped_column(String(30), nullable=False)
    full_name            : Mapped[str] = mapped_column(String(255), nullable=False)
    preferred_name       : Mapped[Optional[str]] = mapped_column(String(100))
    nic_number           : Mapped[Optional[str]] = mapped_column(String(20))
    passport_number      : Mapped[Optional[str]] = mapped_column(String(20))
    date_of_birth        : Mapped[Optional[date]] = mapped_column(Date)
    gender               : Mapped[Optional[str]] = mapped_column(String(10))
    email                : Mapped[Optional[str]] = mapped_column(String(255))
    mobile               : Mapped[Optional[str]] = mapped_column(String(20))
    address              : Mapped[Optional[str]] = mapped_column(Text)
    department_id        : Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("departments.id"))
    designation_id       : Mapped[Optional[str]] = mapped_column(String(36))
    employment_type      : Mapped[EmploymentType] = mapped_column(Enum(EmploymentType), default=EmploymentType.PERMANENT)
    join_date            : Mapped[date] = mapped_column(Date, nullable=False)
    confirmation_date    : Mapped[Optional[date]] = mapped_column(Date)
    resignation_date     : Mapped[Optional[date]] = mapped_column(Date)
    last_working_date    : Mapped[Optional[date]] = mapped_column(Date)
    is_active            : Mapped[bool] = mapped_column(Boolean, default=True)
    # Salary
    basic_salary         : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    # EPF / ETF
    epf_number           : Mapped[Optional[str]] = mapped_column(String(30))
    is_epf_applicable    : Mapped[bool] = mapped_column(Boolean, default=True)
    is_etf_applicable    : Mapped[bool] = mapped_column(Boolean, default=True)
    # Tax
    tax_table_code       : Mapped[TaxTableCode] = mapped_column(Enum(TaxTableCode), default=TaxTableCode.TABLE_01)
    tax_file_number      : Mapped[Optional[str]] = mapped_column(String(30))
    # Bank
    bank_name            : Mapped[Optional[str]] = mapped_column(String(100))
    bank_branch          : Mapped[Optional[str]] = mapped_column(String(100))
    bank_account_number  : Mapped[Optional[str]] = mapped_column(String(50))
    # Hikvision
    hikvision_card_number: Mapped[Optional[str]] = mapped_column(String(50))
    hikvision_device_ids : Mapped[Optional[list]] = mapped_column(JSON, default=list)
    # Supervisor
    supervisor_id        : Mapped[Optional[str]] = mapped_column(String(36))
    # Meta
    profile_photo_url    : Mapped[Optional[str]] = mapped_column(String(500))
    custom_fields        : Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at           : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at           : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    department         : Mapped[Optional["Department"]] = relationship("Department", back_populates="employees")
    salary_components  : Mapped[list["EmployeeSalaryComponent"]] = relationship("EmployeeSalaryComponent", back_populates="employee")
    attendance_records : Mapped[list["AttendanceRecord"]] = relationship("AttendanceRecord", back_populates="employee")
    leave_requests     : Mapped[list["LeaveRequest"]] = relationship("LeaveRequest", back_populates="employee")

    __table_args__ = (UniqueConstraint("company_id", "employee_number"),)


class SalaryComponent(Base):
    """Master salary component definition (allowances, deductions, etc.)"""
    __tablename__ = "salary_components"

    id            : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id    : Mapped[str] = mapped_column(String(36), nullable=False)
    code          : Mapped[str] = mapped_column(String(30), nullable=False)
    name          : Mapped[str] = mapped_column(String(255), nullable=False)
    component_type: Mapped[str] = mapped_column(String(20), nullable=False)  # earning | deduction | statutory
    is_taxable    : Mapped[bool] = mapped_column(Boolean, default=True)
    is_epf_liable : Mapped[bool] = mapped_column(Boolean, default=False)
    is_fixed      : Mapped[bool] = mapped_column(Boolean, default=True)
    formula       : Mapped[Optional[str]] = mapped_column(Text)
    display_order : Mapped[int] = mapped_column(Integer, default=100)
    is_active     : Mapped[bool] = mapped_column(Boolean, default=True)
    created_at    : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EmployeeSalaryComponent(Base):
    __tablename__ = "employee_salary_components"

    id              : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    employee_id     : Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False)
    component_id    : Mapped[str] = mapped_column(String(36), ForeignKey("salary_components.id"), nullable=False)
    amount          : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    effective_from  : Mapped[date] = mapped_column(Date, nullable=False)
    effective_to    : Mapped[Optional[date]] = mapped_column(Date)
    is_active       : Mapped[bool] = mapped_column(Boolean, default=True)

    employee  : Mapped["Employee"] = relationship("Employee", back_populates="salary_components")
    component : Mapped["SalaryComponent"] = relationship("SalaryComponent")


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

class HikvisionDevice(Base):
    __tablename__ = "hikvision_devices"

    id           : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id   : Mapped[str] = mapped_column(String(36), nullable=False)
    device_serial: Mapped[str] = mapped_column(String(100), nullable=False)
    device_name  : Mapped[str] = mapped_column(String(255), nullable=False)
    ip_address   : Mapped[str] = mapped_column(String(45), nullable=False)
    port         : Mapped[int] = mapped_column(Integer, default=80)
    username     : Mapped[str] = mapped_column(String(100), nullable=False)
    password_enc : Mapped[str] = mapped_column(String(255), nullable=False)
    location     : Mapped[Optional[str]] = mapped_column(String(255))
    is_entry     : Mapped[bool] = mapped_column(Boolean, default=True)
    is_exit      : Mapped[bool] = mapped_column(Boolean, default=True)
    is_active    : Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync_at : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at   : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id                : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    employee_id       : Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False)
    company_id        : Mapped[str] = mapped_column(String(36), nullable=False)
    work_date         : Mapped[date] = mapped_column(Date, nullable=False)
    check_in          : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    check_out         : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    check_in_source   : Mapped[AttendanceSource] = mapped_column(Enum(AttendanceSource), default=AttendanceSource.MANUAL)
    check_out_source  : Mapped[AttendanceSource] = mapped_column(Enum(AttendanceSource), default=AttendanceSource.MANUAL)
    device_id         : Mapped[Optional[str]] = mapped_column(String(36))
    raw_minutes       : Mapped[int] = mapped_column(Integer, default=0)
    ot_minutes        : Mapped[int] = mapped_column(Integer, default=0)
    is_absent         : Mapped[bool] = mapped_column(Boolean, default=False)
    is_half_day       : Mapped[bool] = mapped_column(Boolean, default=False)
    is_holiday        : Mapped[bool] = mapped_column(Boolean, default=False)
    is_approved       : Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by       : Mapped[Optional[str]] = mapped_column(String(36))
    notes             : Mapped[Optional[str]] = mapped_column(Text)
    created_at        : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at        : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee: Mapped["Employee"] = relationship("Employee", back_populates="attendance_records")

    __table_args__ = (UniqueConstraint("employee_id", "work_date"),)


class ShiftSchedule(Base):
    __tablename__ = "shift_schedules"

    id              : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id      : Mapped[str] = mapped_column(String(36), nullable=False)
    name            : Mapped[str] = mapped_column(String(100), nullable=False)
    start_time      : Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    end_time        : Mapped[str] = mapped_column(String(5), nullable=False)
    grace_in_min    : Mapped[int] = mapped_column(Integer, default=15)
    grace_out_min   : Mapped[int] = mapped_column(Integer, default=15)
    ot_threshold_min: Mapped[int] = mapped_column(Integer, default=480)  # 8h default
    is_active       : Mapped[bool] = mapped_column(Boolean, default=True)


# ---------------------------------------------------------------------------
# Leave
# ---------------------------------------------------------------------------

class LeaveType(Base):
    __tablename__ = "leave_types"

    id               : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id       : Mapped[str] = mapped_column(String(36), nullable=False)
    code             : Mapped[str] = mapped_column(String(20), nullable=False)
    name             : Mapped[str] = mapped_column(String(100), nullable=False)
    days_entitled    : Mapped[int] = mapped_column(Integer, default=14)
    is_carry_forward : Mapped[bool] = mapped_column(Boolean, default=False)
    max_carry_days   : Mapped[int] = mapped_column(Integer, default=0)
    is_paid          : Mapped[bool] = mapped_column(Boolean, default=True)
    is_medical       : Mapped[bool] = mapped_column(Boolean, default=False)
    requires_document: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active        : Mapped[bool] = mapped_column(Boolean, default=True)


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id             : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    employee_id    : Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False)
    leave_type_id  : Mapped[str] = mapped_column(String(36), ForeignKey("leave_types.id"), nullable=False)
    year           : Mapped[int] = mapped_column(Integer, nullable=False)
    entitled_days  : Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    used_days      : Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    pending_days   : Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    carried_forward: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)

    employee  : Mapped["Employee"] = relationship("Employee")
    leave_type: Mapped["LeaveType"] = relationship("LeaveType")

    __table_args__ = (UniqueConstraint("employee_id", "leave_type_id", "year"),)


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id              : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    employee_id     : Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False)
    leave_type_id   : Mapped[str] = mapped_column(String(36), ForeignKey("leave_types.id"), nullable=False)
    start_date      : Mapped[date] = mapped_column(Date, nullable=False)
    end_date        : Mapped[date] = mapped_column(Date, nullable=False)
    total_days      : Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    reason          : Mapped[Optional[str]] = mapped_column(Text)
    document_url    : Mapped[Optional[str]] = mapped_column(String(500))
    status          : Mapped[LeaveStatus] = mapped_column(Enum(LeaveStatus), default=LeaveStatus.PENDING)
    # Step 1: Supervisor
    supervisor_action : Mapped[Optional[str]] = mapped_column(String(20))
    supervisor_id     : Mapped[Optional[str]] = mapped_column(String(36))
    supervisor_note   : Mapped[Optional[str]] = mapped_column(Text)
    supervisor_at     : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Step 2: HR
    hr_action         : Mapped[Optional[str]] = mapped_column(String(20))
    hr_id             : Mapped[Optional[str]] = mapped_column(String(36))
    hr_note           : Mapped[Optional[str]] = mapped_column(Text)
    hr_at             : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Step 3: Client Admin
    client_action     : Mapped[Optional[str]] = mapped_column(String(20))
    client_id         : Mapped[Optional[str]] = mapped_column(String(36))
    client_note       : Mapped[Optional[str]] = mapped_column(Text)
    client_at         : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Step 4: Final (Payroll Admin)
    final_action      : Mapped[Optional[str]] = mapped_column(String(20))
    final_id          : Mapped[Optional[str]] = mapped_column(String(36))
    final_note        : Mapped[Optional[str]] = mapped_column(Text)
    final_at          : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at        : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employee  : Mapped["Employee"] = relationship("Employee", back_populates="leave_requests")
    leave_type: Mapped["LeaveType"] = relationship("LeaveType")


# ---------------------------------------------------------------------------
# Payroll
# ---------------------------------------------------------------------------

class PayrollPeriod(Base):
    __tablename__ = "payroll_periods"

    id           : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id   : Mapped[str] = mapped_column(String(36), nullable=False)
    period_name  : Mapped[str] = mapped_column(String(50), nullable=False)
    year         : Mapped[int] = mapped_column(Integer, nullable=False)
    month        : Mapped[int] = mapped_column(Integer, nullable=False)
    start_date   : Mapped[date] = mapped_column(Date, nullable=False)
    end_date     : Mapped[date] = mapped_column(Date, nullable=False)
    pay_date     : Mapped[Optional[date]] = mapped_column(Date)
    status       : Mapped[PayrollStatus] = mapped_column(Enum(PayrollStatus), default=PayrollStatus.DRAFT)
    working_days : Mapped[int] = mapped_column(Integer, default=26)
    notes        : Mapped[Optional[str]] = mapped_column(Text)
    # Approval trail
    submitted_by : Mapped[Optional[str]] = mapped_column(String(36))
    submitted_at : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    hr_approved_by: Mapped[Optional[str]] = mapped_column(String(36))
    hr_approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    client_approved_by: Mapped[Optional[str]] = mapped_column(String(36))
    client_approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    bank_file_generated_by: Mapped[Optional[str]] = mapped_column(String(36))
    bank_file_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    payslip_released_by: Mapped[Optional[str]] = mapped_column(String(36))
    payslip_released_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at   : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at   : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    payslips: Mapped[list["Payslip"]] = relationship("Payslip", back_populates="period")

    __table_args__ = (UniqueConstraint("company_id", "year", "month"),)


class Payslip(Base):
    __tablename__ = "payslips"

    id                : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    period_id         : Mapped[str] = mapped_column(String(36), ForeignKey("payroll_periods.id"), nullable=False)
    employee_id       : Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False)
    company_id        : Mapped[str] = mapped_column(String(36), nullable=False)
    # Days
    working_days      : Mapped[int] = mapped_column(Integer, default=26)
    present_days      : Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    absent_days       : Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    no_pay_days       : Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    leave_days        : Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    ot_hours          : Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    # Gross components
    basic_salary      : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    gross_salary      : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total_allowances  : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    ot_amount         : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    no_pay_deduction  : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    # Statutory deductions
    epf_employee      : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)   # 8%
    epf_employer      : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)   # 12%
    etf_employer      : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)   # 3%
    apit              : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    # Other deductions
    total_deductions  : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    # Net
    net_salary        : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    # Line items (JSON for flexible components)
    earnings_detail   : Mapped[Optional[list]] = mapped_column(JSON, default=list)
    deductions_detail : Mapped[Optional[list]] = mapped_column(JSON, default=list)
    # Metadata
    tax_table_used    : Mapped[Optional[str]] = mapped_column(String(5))
    is_released       : Mapped[bool] = mapped_column(Boolean, default=False)
    pdf_url           : Mapped[Optional[str]] = mapped_column(String(500))
    computed_at       : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at        : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at        : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    period  : Mapped["PayrollPeriod"] = relationship("PayrollPeriod", back_populates="payslips")
    employee: Mapped["Employee"] = relationship("Employee")

    __table_args__ = (UniqueConstraint("period_id", "employee_id"),)


class PayrollRule(Base):
    """Configurable rule engine — nothing is hardcoded."""
    __tablename__ = "payroll_rules"

    id            : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id    : Mapped[str] = mapped_column(String(36), nullable=False)
    rule_key      : Mapped[str] = mapped_column(String(100), nullable=False)
    rule_name     : Mapped[str] = mapped_column(String(255), nullable=False)
    rule_value    : Mapped[str] = mapped_column(Text, nullable=False)
    value_type    : Mapped[str] = mapped_column(String(20), default="decimal")  # decimal|integer|boolean|string|json
    description   : Mapped[Optional[str]] = mapped_column(Text)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to  : Mapped[Optional[date]] = mapped_column(Date)
    is_active     : Mapped[bool] = mapped_column(Boolean, default=True)
    created_at    : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("company_id", "rule_key", "effective_from"),)


class APCITaxTable(Base):
    """APIT tax slabs — Tables 01-08 per IRD Sri Lanka."""
    __tablename__ = "apit_tax_tables"

    id             : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    table_code     : Mapped[str] = mapped_column(String(5), nullable=False)
    effective_year : Mapped[int] = mapped_column(Integer, nullable=False)
    income_from    : Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    income_to      : Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))  # None = unlimited
    tax_rate       : Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)
    fixed_deduction: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    is_active      : Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("table_code", "effective_year", "income_from"),)


class PublicHoliday(Base):
    __tablename__ = "public_holidays"

    id           : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id   : Mapped[Optional[str]] = mapped_column(String(36))  # None = applies to all
    holiday_date : Mapped[date] = mapped_column(Date, nullable=False)
    name         : Mapped[str] = mapped_column(String(255), nullable=False)
    is_paid      : Mapped[bool] = mapped_column(Boolean, default=True)
    is_recurring : Mapped[bool] = mapped_column(Boolean, default=False)
    created_at   : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BankFile(Base):
    __tablename__ = "bank_files"

    id           : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    period_id    : Mapped[str] = mapped_column(String(36), ForeignKey("payroll_periods.id"), nullable=False)
    company_id   : Mapped[str] = mapped_column(String(36), nullable=False)
    file_format  : Mapped[str] = mapped_column(String(20), nullable=False)  # COMB|HNB|BOC|etc
    file_url     : Mapped[Optional[str]] = mapped_column(String(500))
    total_amount : Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    record_count : Mapped[int] = mapped_column(Integer, default=0)
    generated_by : Mapped[str] = mapped_column(String(36), nullable=False)
    generated_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id          : Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id     : Mapped[str] = mapped_column(String(36), nullable=False)
    company_id  : Mapped[str] = mapped_column(String(36), nullable=False)
    title       : Mapped[str] = mapped_column(String(255), nullable=False)
    body        : Mapped[str] = mapped_column(Text, nullable=False)
    ntype       : Mapped[str] = mapped_column(String(50), nullable=False)
    ref_id      : Mapped[Optional[str]] = mapped_column(String(36))
    is_read     : Mapped[bool] = mapped_column(Boolean, default=False)
    created_at  : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
