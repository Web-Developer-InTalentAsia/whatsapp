"""
Paylix - Employee Management Routes
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Department, Designation, Employee, EmploymentType, TaxTableCode, UserRole
from app.routes.auth import CurrentUser
from app.services.auth_service import write_audit

router = APIRouter(prefix="/employees", tags=["employees"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class EmployeeCreate(BaseModel):
    employee_number: str
    full_name: str
    preferred_name: Optional[str] = None
    nic_number: Optional[str] = None
    passport_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    department_id: Optional[str] = None
    designation_id: Optional[str] = None
    employment_type: EmploymentType = EmploymentType.PERMANENT
    join_date: date
    basic_salary: float = 0.0
    is_epf_applicable: bool = True
    is_etf_applicable: bool = True
    tax_table_code: TaxTableCode = TaxTableCode.TABLE_01
    tax_file_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account_number: Optional[str] = None
    epf_number: Optional[str] = None
    hikvision_card_number: Optional[str] = None
    supervisor_id: Optional[str] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    preferred_name: Optional[str] = None
    nic_number: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    department_id: Optional[str] = None
    designation_id: Optional[str] = None
    employment_type: Optional[EmploymentType] = None
    basic_salary: Optional[float] = None
    is_epf_applicable: Optional[bool] = None
    is_etf_applicable: Optional[bool] = None
    tax_table_code: Optional[TaxTableCode] = None
    tax_file_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account_number: Optional[str] = None
    epf_number: Optional[str] = None
    hikvision_card_number: Optional[str] = None
    supervisor_id: Optional[str] = None
    confirmation_date: Optional[date] = None
    resignation_date: Optional[date] = None
    last_working_date: Optional[date] = None


def _serialize_employee(e: Employee) -> dict:
    return {
        "id": e.id,
        "employee_number": e.employee_number,
        "full_name": e.full_name,
        "preferred_name": e.preferred_name,
        "nic_number": e.nic_number,
        "email": e.email,
        "mobile": e.mobile,
        "department_id": e.department_id,
        "designation_id": e.designation_id,
        "employment_type": e.employment_type.value,
        "join_date": str(e.join_date),
        "confirmation_date": str(e.confirmation_date) if e.confirmation_date else None,
        "resignation_date": str(e.resignation_date) if e.resignation_date else None,
        "last_working_date": str(e.last_working_date) if e.last_working_date else None,
        "is_active": e.is_active,
        "basic_salary": float(e.basic_salary),
        "is_epf_applicable": e.is_epf_applicable,
        "is_etf_applicable": e.is_etf_applicable,
        "tax_table_code": e.tax_table_code.value if e.tax_table_code else None,
        "bank_name": e.bank_name,
        "bank_branch": e.bank_branch,
        "bank_account_number": e.bank_account_number,
        "epf_number": e.epf_number,
        "supervisor_id": e.supervisor_id,
        "profile_photo_url": e.profile_photo_url,
        "created_at": e.created_at.isoformat(),
    }


def _check_hr_or_above(user: CurrentUser):
    allowed = {UserRole.SUPER_ADMIN, UserRole.PAYROLL_ADMIN, UserRole.CLIENT_ADMIN, UserRole.HR_USER}
    if user.role not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("")
async def list_employees(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    employment_type: Optional[EmploymentType] = Query(None),
    is_active: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    q = select(Employee).where(
        Employee.company_id == current_user.company_id,
        Employee.is_active == is_active,
    )
    if search:
        q = q.where(
            (Employee.full_name.ilike(f"%{search}%"))
            | (Employee.employee_number.ilike(f"%{search}%"))
            | (Employee.email.ilike(f"%{search}%"))
        )
    if department_id:
        q = q.where(Employee.department_id == department_id)
    if employment_type:
        q = q.where(Employee.employment_type == employment_type)

    count_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_result.scalar()

    q = q.order_by(Employee.employee_number).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    employees = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_serialize_employee(e) for e in employees],
    }


@router.post("", status_code=201)
async def create_employee(
    body: EmployeeCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    _check_hr_or_above(current_user)

    # Check duplicate employee number
    existing = await db.execute(
        select(Employee).where(
            Employee.company_id == current_user.company_id,
            Employee.employee_number == body.employee_number,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Employee number already exists")

    emp = Employee(
        company_id=current_user.company_id,
        **body.model_dump(),
    )
    db.add(emp)
    await db.flush()

    await write_audit(
        db, action="EMPLOYEE_CREATED", resource_type="employee",
        resource_id=emp.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"employee_number": emp.employee_number, "full_name": emp.full_name},
    )
    return _serialize_employee(emp)


@router.get("/departments/list")
async def list_departments(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Department).where(
            Department.company_id == current_user.company_id,
            Department.is_active == True,
        ).order_by(Department.name)
    )
    depts = result.scalars().all()
    return [{"id": d.id, "code": d.code, "name": d.name, "parent_id": d.parent_id, "manager_id": d.manager_id} for d in depts]


@router.post("/departments")
async def create_department(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    code: str = Query(...),
    name: str = Query(...),
    parent_id: Optional[str] = Query(None),
):
    _check_hr_or_above(current_user)
    dept = Department(company_id=current_user.company_id, code=code, name=name, parent_id=parent_id)
    db.add(dept)
    await db.flush()
    return {"id": dept.id, "code": dept.code, "name": dept.name}


@router.get("/{employee_id}")
async def get_employee(employee_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.company_id == current_user.company_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Employees can only see their own profile
    if current_user.role == UserRole.EMPLOYEE and current_user.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return _serialize_employee(emp)


@router.patch("/{employee_id}")
async def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    _check_hr_or_above(current_user)

    result = await db.execute(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.company_id == current_user.company_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(emp, key, val)

    await db.flush()
    await write_audit(
        db, action="EMPLOYEE_UPDATED", resource_type="employee",
        resource_id=emp.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload=update_data,
    )
    return _serialize_employee(emp)


@router.post("/{employee_id}/terminate")
async def terminate_employee(
    employee_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    last_working_date: date = Query(...),
    reason: Optional[str] = Query(None),
):
    _check_hr_or_above(current_user)

    result = await db.execute(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.company_id == current_user.company_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp.last_working_date = last_working_date
    emp.is_active = False
    await db.flush()

    await write_audit(
        db, action="EMPLOYEE_TERMINATED", resource_type="employee",
        resource_id=emp.id, company_id=current_user.company_id,
        user_id=current_user.id, user_email=current_user.email,
        payload={"last_working_date": str(last_working_date), "reason": reason},
    )
    return {"message": "Employee terminated", "employee_id": employee_id}
