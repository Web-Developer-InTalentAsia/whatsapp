"""
Paylix - Company Management Routes
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Company, UserRole
from app.routes.auth import CurrentUser
from app.services.auth_service import write_audit

router = APIRouter(prefix="/companies", tags=["companies"])
logger = logging.getLogger(__name__)


class CompanyCreate(BaseModel):
    name: str
    legal_name: str
    reg_number: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


def _serialize(c: Company) -> dict:
    return {
        "id": c.id,
        "code": c.code,
        "name": c.name,
        "legal_name": c.legal_name,
        "reg_number": c.reg_number,
        "address": c.address,
        "phone": c.phone,
        "email": c.email,
        "is_active": c.is_active,
        "logo_url": c.logo_url,
        "created_at": c.created_at.isoformat(),
    }


@router.get("")
async def list_companies(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if current_user.role == UserRole.SUPER_ADMIN:
        result = await db.execute(
            select(Company).where(Company.is_active == True).order_by(Company.name)
        )
        companies = result.scalars().all()
    else:
        company = await db.get(Company, current_user.company_id)
        companies = [company] if company else []
    return [_serialize(c) for c in companies]


@router.post("", status_code=201)
async def create_company(
    body: CompanyCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super admin only")

    base = re.sub(r"[^a-z0-9]", "", body.name.lower())[:10] or "company"
    row = await db.execute(
        text("SELECT COUNT(*) FROM companies WHERE code LIKE :pat"),
        {"pat": f"{base}%"},
    )
    suffix = row.scalar() or 0
    code = base if suffix == 0 else f"{base}{suffix}"
    schema = f"co_{code}"

    existing = await db.execute(select(Company).where(Company.code == code.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Company code already exists")

    company = Company(
        code=code.upper(),
        name=body.name,
        legal_name=body.legal_name,
        reg_number=body.reg_number,
        address=body.address,
        phone=body.phone,
        email=body.email,
        db_schema=schema,
    )
    db.add(company)
    await db.flush()

    from app.core.database import create_company_schema
    await create_company_schema(schema)

    await write_audit(
        db, action="COMPANY_CREATED", resource_type="company",
        resource_id=company.id, company_id=company.id,
        user_id=current_user.id, user_email=current_user.email,
    )
    return _serialize(company)
