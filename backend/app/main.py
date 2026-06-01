"""
Paylix - FastAPI Application Entry Point
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import ensure_public_schema_tables
from app.routes import auth, attendance, compliance, companies, employees, leave, payroll, reports

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Paylix starting — environment: %s", settings.ENVIRONMENT)
    await ensure_public_schema_tables()
    logger.info("Database schema verified.")
    yield
    logger.info("Paylix shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-company payroll BPO SaaS for InTalent Asia Sri Lanka",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    openapi_url="/api/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."},
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

PREFIX = settings.API_V1_PREFIX

app.include_router(auth.router,       prefix=PREFIX)
app.include_router(companies.router,  prefix=PREFIX)
app.include_router(employees.router,  prefix=PREFIX)
app.include_router(attendance.router, prefix=PREFIX)
app.include_router(leave.router,      prefix=PREFIX)
app.include_router(payroll.router,    prefix=PREFIX)
app.include_router(compliance.router, prefix=PREFIX)
app.include_router(reports.router,    prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}


@app.get("/api/v1/ping")
async def ping():
    return {"pong": True}
