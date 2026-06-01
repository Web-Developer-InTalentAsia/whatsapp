# Paylix — Multi-Company Payroll BPO SaaS
### Built for InTalent Asia Sri Lanka

---

## Overview

Paylix is a full-stack, multi-tenant payroll BaaS platform designed for payroll outsourcing operations in Sri Lanka.  
Each client company gets an isolated PostgreSQL schema. All statutory computations comply with IRD Sri Lanka regulations.

---

## Architecture

```
Paylix/
├── backend/           FastAPI (Python 3.12)
│   ├── app/
│   │   ├── core/      Config, Database
│   │   ├── models/    SQLAlchemy ORM
│   │   ├── routes/    API endpoints
│   │   └── services/  Business logic
│   └── celery_app.py  Background tasks
├── frontend/          Next.js 14 (dark theme)
│   └── src/
│       ├── pages/
│       ├── components/
│       └── utils/
├── docker-compose.yml
└── .env.example
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Nginx | 80/443 | Reverse proxy |
| Frontend (Next.js) | 3000 | Dark theme SPA |
| Backend (FastAPI) | 8000 | REST API |
| PostgreSQL | 5432 | Relational DB (multi-schema) |
| Redis | 6379 | Cache + Celery broker |
| Celery Worker | — | Background task processor |
| Celery Beat | — | Scheduled jobs |
| Flower | 5555 | Celery monitoring UI |

---

## Sri Lanka Payroll Engine

### APIT (Tables 01–08)
- Annual income converted to monthly APIT using IRD tax slabs
- All 8 tables stored in `apit_tax_tables` — updateable without code changes
- Tax table per employee (configurable)

### Statutory Contributions
| Contribution | Rate | Payer |
|---|---|---|
| EPF | 8% | Employee |
| EPF | 12% | Employer |
| ETF | 3% | Employer |

All rates are sourced from `payroll_rules` table — nothing hardcoded.

### No-Pay Deduction
```
Daily Rate = Basic Salary / Working Days (default: 26)
No-Pay Deduction = Daily Rate × No-Pay Days
```

### Overtime
```
OT Amount = (Basic / (Working Days × 8)) × OT Hours × 1.5
Holiday OT = (Basic / (Working Days × 8)) × OT Hours × 2.0
```
All multipliers are configurable via `payroll_rules`.

---

## Payroll Workflow

```
DRAFT → CALCULATED → HR_REVIEW → CLIENT_APPROVAL → BANK_FILE → PAYSLIP_RELEASE → COMPLETED
```

- **DRAFT** → Create period, set working days
- **CALCULATED** → Engine computes all payslips (Payroll Admin)
- **HR_REVIEW** → HR validates attendance, deductions
- **CLIENT_APPROVAL** → Client Admin reviews and approves
- **BANK_FILE** → ACH bank file generated (requires email OTP)
- **PAYSLIP_RELEASE** → Payslips released to ESS portal (requires email OTP)
- **COMPLETED** → Period locked

---

## Authentication & Security

### JWT + TOTP MFA + Email OTP

1. POST `/api/v1/auth/login` → password check
2. If TOTP enabled → POST `/api/v1/auth/verify-totp`  
   Otherwise → email OTP → POST `/api/v1/auth/verify-otp`
3. Sensitive actions (bank file, payslip release) require additional email OTP

### User Roles

| Role | Description |
|------|-------------|
| `super_admin` | InTalent admin — manages all companies |
| `payroll_admin` | InTalent payroll officer |
| `client_admin` | Client company admin |
| `hr_user` | Client HR team |
| `finance_user` | Finance read + reports |
| `supervisor` | Team lead — approves leave/attendance |
| `employee` | ESS access only |
| `auditor` | Read-only audit log access |

### Brute Force Protection
- 5 failed attempts → account locked for 30 minutes
- All events logged in append-only `audit_logs` table

---

## Multi-Tenant Architecture

Each company gets its own PostgreSQL schema (`company_<code>`).  
Sessions are schema-scoped — no cross-company data leakage possible at the ORM level.

```sql
SET search_path TO company_abc, public;
```

---

## Leave Management (4-Step Approval)

```
Employee Submits → Supervisor → HR Review → Client Admin → Payroll Admin (Final)
```

Each step captures: approver ID, action (approve/reject), note, timestamp.  
Rejecting at any step notifies the employee and releases the pending balance.

---

## Hikvision Integration

- HTTP Digest authentication to Hikvision ISAPI
- Pulls access control events every 15 minutes (Celery Beat)
- Maps card numbers to employees → creates/updates `AttendanceRecord`
- Supports multiple devices per company (entry + exit)
- Device credentials stored encrypted (AES-256 via Fernet)

---

## Quick Start

### 1. Clone and configure
```bash
git clone <repo>
cd Paylix_systems
cp .env.example .env
# Edit .env — set all CHANGE_ME values
```

### 2. Launch all services
```bash
docker compose up -d
```

### 3. Verify
```
http://localhost:8000/health        → {"status": "ok"}
http://localhost:3000               → Frontend (dark theme)
http://localhost:8000/api/docs      → Swagger UI (debug mode only)
http://localhost:5555               → Flower (Celery monitoring)
```

### 4. Load Sri Lanka APIT tax tables
```bash
curl -X POST http://localhost:8000/api/v1/compliance/tax-tables/bulk \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d @data/apit_tables_2024.json
```

---

## API Reference

All endpoints are prefixed with `/api/v1`.

| Module | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Auth | `/auth` | login, verify-totp, verify-otp, refresh, logout, me |
| Employees | `/employees` | CRUD, terminate, departments |
| Attendance | `/attendance` | list, manual entry, approve, devices, sync |
| Leave | `/leave` | types, balances, requests, 4-step actions |
| Payroll | `/payroll` | periods, calculate, transition, payslips, rules |
| Compliance | `/compliance` | tax-tables, EPF/ETF/APIT schedules, audit-log |
| Reports | `/reports` | cost-trend, dept-cost, headcount, CSV, bank-file |

---

## Development

### Backend only
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend only
```bash
cd frontend
npm install
npm run dev
```

### Celery worker (dev)
```bash
cd backend
celery -A app.celery_app worker --loglevel=debug
```

---

## Production Checklist

- [ ] Change all `CHANGE_ME` values in `.env`
- [ ] Set `DEBUG=false`
- [ ] Configure valid SSL certificates in `nginx.conf`
- [ ] Load APIT tax tables for current fiscal year
- [ ] Configure SMTP credentials for OTP emails
- [ ] Set up PostgreSQL backups
- [ ] Configure S3 for file storage (payslip PDFs, bank files)
- [ ] Review CORS origins
- [ ] Enable Flower authentication

---

## License

Proprietary — InTalent Asia (Pvt) Ltd, Sri Lanka. All rights reserved.
