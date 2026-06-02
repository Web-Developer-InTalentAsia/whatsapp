"""
AbunthraHR - Database Engine & Session Management
Supports multi-tenant schema isolation per company.
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import asyncpg as _asyncpg
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy import event, text
from sqlalchemy.pool import NullPool

from app.core.config import settings

logger = logging.getLogger(__name__)


async def _connect_no_ssl(*args, **kwargs):
    """Force ssl=False so asyncpg doesn't attempt SSL on local Windows PG."""
    import sys
    kwargs["ssl"] = False
    print(f"[DB] connecting: host={kwargs.get('host')!r} port={kwargs.get('port')!r} db={kwargs.get('database')!r} ssl={kwargs.get('ssl')!r}", file=sys.stderr, flush=True)
    try:
        result = await _asyncpg.connect(*args, **kwargs)
        print("[DB] connection SUCCESS", file=sys.stderr, flush=True)
        return result
    except Exception as e:
        print(f"[DB] connection FAILED: {type(e).__name__}: {e}", file=sys.stderr, flush=True)
        raise


# ---------------------------------------------------------------------------
# Async engine (used by FastAPI)
# ---------------------------------------------------------------------------
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=40,
    connect_args={"async_creator_fn": _connect_no_ssl},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a session, rolls back on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Schema isolation helpers
# ---------------------------------------------------------------------------

async def set_schema(session: AsyncSession, schema: str) -> None:
    """Switch the PostgreSQL search_path for this session to the company schema."""
    await session.execute(text(f"SET search_path TO {schema}, public"))


async def create_company_schema(schema_name: str) -> None:
    """Create an isolated PostgreSQL schema for a new company and run DDL."""
    from app.models.models import Base

    async with engine.begin() as conn:
        await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
        await conn.execute(text(f"SET search_path TO {schema_name}, public"))
        # Create all company-scoped tables inside the new schema
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Created schema: %s", schema_name)


async def ensure_public_schema_tables() -> None:
    """Ensure public-schema tables exist (companies, users, audit_logs, etc.)"""
    from app.models.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Public schema tables verified.")


@asynccontextmanager
async def company_session(schema: str) -> AsyncGenerator[AsyncSession, None]:
    """Context manager that opens a session scoped to a company's schema."""
    async with AsyncSessionLocal() as session:
        await set_schema(session, schema)
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
