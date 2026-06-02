"""
AbunthraHR - Application Configuration
"""
from functools import lru_cache
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "AbunthraHR"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # API
    API_V1_PREFIX: str = "/api/v1"
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8000"]

    # Database
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "abunthrahr"
    POSTGRES_PASSWORD: str = "changeme"
    POSTGRES_DB: str = "abunthrahr"

    @property
    def DATABASE_URL(self) -> str:
        from urllib.parse import quote_plus
        password = quote_plus(self.POSTGRES_PASSWORD)
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def SYNC_DATABASE_URL(self) -> str:
        from urllib.parse import quote_plus
        password = quote_plus(self.POSTGRES_PASSWORD)
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # JWT
    JWT_SECRET_KEY: str = "CHANGE-ME-super-secret-jwt-key-at-least-32-chars"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Security
    BCRYPT_ROUNDS: int = 12
    MAX_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 30

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@abunthrahr.lk"
    SMTP_FROM_NAME: str = "AbunthraHR"
    SMTP_TLS: bool = True

    # OTP / MFA
    OTP_EXPIRE_MINUTES: int = 10
    TOTP_ISSUER: str = "AbunthraHR"
    MFA_ENABLED: bool = False  # set True in .env when SMTP is configured

    # File Storage
    STORAGE_TYPE: str = "local"  # local | s3
    STORAGE_LOCAL_PATH: str = "/app/uploads"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_S3_BUCKET: Optional[str] = None
    AWS_REGION: str = "ap-south-1"

    # Encryption (for Hikvision device passwords)
    ENCRYPTION_KEY: str = "CHANGE-ME-32-byte-encryption-key!!"

    # Payroll defaults (overridable per company via PayrollRule)
    DEFAULT_EPF_EMPLOYEE_RATE: float = 0.08
    DEFAULT_EPF_EMPLOYER_RATE: float = 0.12
    DEFAULT_ETF_EMPLOYER_RATE: float = 0.03
    DEFAULT_OT_MULTIPLIER: float = 1.5
    DEFAULT_HOLIDAY_OT_MULTIPLIER: float = 2.0
    DEFAULT_WORKING_DAYS_PER_MONTH: int = 26

    # Celery
    CELERY_TIMEZONE: str = "Asia/Colombo"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
