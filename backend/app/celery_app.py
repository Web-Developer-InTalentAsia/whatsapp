"""
Paylix - Celery Background Tasks
"""
import logging
from datetime import datetime, timedelta, timezone

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

logger = logging.getLogger(__name__)

celery_app = Celery(
    "paylix",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.celery_app"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone=settings.CELERY_TIMEZONE,
    enable_utc=True,
    task_track_started=True,
    task_ack_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        # Sync Hikvision devices every 15 minutes during business hours
        "sync-hikvision-devices": {
            "task": "app.celery_app.sync_all_hikvision_devices",
            "schedule": crontab(minute="*/15", hour="6-22"),
        },
        # Auto-lock payroll periods at month end
        "auto-lock-payroll": {
            "task": "app.celery_app.auto_lock_expired_periods",
            "schedule": crontab(hour=23, minute=0),
        },
        # Send leave expiry reminders
        "leave-expiry-reminders": {
            "task": "app.celery_app.send_leave_expiry_reminders",
            "schedule": crontab(hour=8, minute=0, day_of_month="1"),
        },
        # Clean expired OTP codes
        "clean-expired-otps": {
            "task": "app.celery_app.clean_expired_otps",
            "schedule": crontab(hour="*/6"),
        },
    },
)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def sync_all_hikvision_devices(self):
    """Pull attendance events from all active Hikvision devices for all companies."""
    import asyncio
    from sqlalchemy import select

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.models import Company, HikvisionDevice
        from app.services.hikvision_service import sync_device

        now = datetime.now(timezone.utc)
        start = now - timedelta(hours=1)

        async with AsyncSessionLocal() as db:
            companies = (await db.execute(
                select(Company).where(Company.is_active == True)
            )).scalars().all()

            for company in companies:
                devices = (await db.execute(
                    select(HikvisionDevice).where(
                        HikvisionDevice.company_id == company.id,
                        HikvisionDevice.is_active == True,
                    )
                )).scalars().all()

                for device in devices:
                    try:
                        result = await sync_device(db, device, start, now, company.id)
                        logger.info(
                            "Synced device %s: %s", device.device_serial, result
                        )
                    except Exception as exc:
                        logger.error("Sync failed for device %s: %s", device.device_serial, exc)

            await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task
def auto_lock_expired_periods():
    """Move calculated periods past their end date to HR_REVIEW if not already progressed."""
    import asyncio
    from datetime import date

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.models import PayrollPeriod, PayrollStatus
        from sqlalchemy import select

        today = date.today()
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(PayrollPeriod).where(
                    PayrollPeriod.status == PayrollStatus.CALCULATED,
                    PayrollPeriod.end_date < today,
                )
            )
            periods = result.scalars().all()
            for p in periods:
                p.status = PayrollStatus.HR_REVIEW
                logger.info("Auto-advanced period %s to HR_REVIEW", p.period_name)
            await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task
def clean_expired_otps():
    """Delete OTP codes that have expired."""
    import asyncio
    from datetime import datetime, timezone

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.models import OTPCode
        from sqlalchemy import delete

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                delete(OTPCode).where(OTPCode.expires_at < datetime.now(timezone.utc))
            )
            await db.commit()
            logger.info("Deleted %d expired OTP codes", result.rowcount)

    asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task
def send_leave_expiry_reminders():
    """Notify employees about expiring leave balances at month start."""
    logger.info("Leave expiry reminder task executed — email sending not implemented in this stub")


@celery_app.task(bind=True)
def calculate_payroll_async(self, company_id: str, period_id: str, triggered_by: str):
    """Run payroll calculation in background."""
    import asyncio

    async def _run():
        from app.core.database import AsyncSessionLocal
        from app.models.models import PayrollPeriod, PayrollStatus
        from app.services.payroll_engine import calculate_period
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(PayrollPeriod).where(PayrollPeriod.id == period_id)
            )
            period = result.scalar_one_or_none()
            if not period:
                logger.error("Period %s not found", period_id)
                return

            slips = await calculate_period(db, company_id, period)
            period.status = PayrollStatus.CALCULATED
            await db.commit()
            logger.info("Async payroll complete: %d slips for period %s", len(slips), period_id)

    asyncio.get_event_loop().run_until_complete(_run())
