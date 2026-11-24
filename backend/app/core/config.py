from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["local", "development", "staging", "production", "test"]

_INSECURE_SECRET_PLACEHOLDERS = ("dev-only", "test-only", "change-me")


class Settings(BaseSettings):
    """Typed application settings loaded from the environment.

    Local development loads ``../.env`` (the repository root) and then ``.env``
    (the backend directory), so backend-specific values win. Tests construct
    Settings directly and never depend on a committed secret.
    """

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Chillar / Kindly"
    service_name: str = "kindly-api"
    version: str = "0.1.0"
    environment: Environment = Field(
        default="local",
        validation_alias=AliasChoices("APP_ENV", "ENVIRONMENT"),
    )

    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://localhost:5432/kindah_dev"
    redis_url: str | None = None
    cors_origins: str = "http://localhost:3000"
    log_level: str = "INFO"

    jwt_secret: SecretStr = Field(
        default=SecretStr("dev-only-jwt-secret-change-me-minimum-32-characters")
    )
    refresh_token_pepper: SecretStr = Field(
        default=SecretStr("dev-only-refresh-token-pepper-minimum-32-characters")
    )
    crypto_key: SecretStr = Field(default=SecretStr("dev-only-crypto-key-minimum-32-characters"))
    lookup_hmac_key: SecretStr = Field(
        default=SecretStr("dev-only-lookup-hmac-key-minimum-32-characters")
    )
    otp_hmac_key: SecretStr = Field(
        default=SecretStr("dev-only-otp-hmac-key-minimum-32-characters")
    )

    payments_live_enabled: bool = False
    handoff_mode: Literal["test", "live"] = "test"

    sms_provider: str = "test"
    crypto_provider: str = "local"

    access_token_ttl_minutes: int = Field(default=15, gt=0, le=120)
    refresh_token_ttl_days: int = Field(default=30, gt=0, le=365)
    otp_ttl_seconds: int = Field(default=300, gt=0, le=900)
    otp_max_attempts: int = Field(default=5, gt=0, le=10)
    otp_resend_seconds: int = Field(default=30, ge=0, le=300)
    otp_phone_limit: int = Field(default=3, gt=0, le=20)
    otp_ip_limit: int = Field(default=20, gt=0, le=200)
    otp_window_minutes: int = Field(default=15, gt=0, le=60)
    otp_test_code: str = "123456"
    legal_policy_version: str = "draft-2026-11-23"

    reauth_window_minutes: int = Field(default=10, gt=0, le=60)
    wish_lifetime_hours: int = Field(default=24, gt=0, le=168)
    wish_cooldown_hours: int = Field(default=72, gt=0, le=720)
    wish_message_min: int = Field(default=10, gt=0, le=120)
    wish_message_max: int = Field(default=120, gt=0, le=500)
    min_gift_inr: int = Field(default=10, ge=1)
    max_gift_inr: int = Field(default=100, ge=10)
    prohibited_wish_terms: str = ""

    reservation_minutes: int = Field(default=10, gt=0, le=60)
    reservation_extension_minutes: int = Field(default=20, gt=0, le=60)
    recipient_response_hours: int = Field(default=24, gt=0, le=72)
    unresolved_claim_limit: int = Field(default=2, gt=0, le=10)
    cheer_max_chars: int = Field(default=80, gt=0, le=120)
    report_rate_limit_per_hour: int = Field(default=10, gt=0, le=100)
    auto_hide_report_threshold: int = Field(default=3, ge=2, le=20)
    admin_mfa_required: bool = False
    admin_mfa_ttl_minutes: int = Field(default=15, gt=0, le=60)
    admin_mfa_issuer: str = "Kindly Admin"
    outbox_max_attempts: int = Field(default=5, ge=1, le=20)
    outbox_retry_base_seconds: int = Field(default=30, ge=1, le=3600)
    outbox_batch_size: int = Field(default=100, ge=1, le=1000)
    handoff_provider: str = "test"

    db_connect_timeout_seconds: int = 3
    redis_timeout_seconds: float = 1.0

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, value: str) -> str:
        allowed = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}
        normalized = value.upper()
        if normalized not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {sorted(allowed)}")
        return normalized

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        if not value.startswith("postgresql"):
            raise ValueError("DATABASE_URL must be a PostgreSQL connection URL")
        return value

    @field_validator("api_v1_prefix")
    @classmethod
    def validate_api_prefix(cls, value: str) -> str:
        if not value.startswith("/"):
            raise ValueError("API_V1_PREFIX must start with '/'")
        return value.rstrip("/")

    @field_validator("otp_test_code")
    @classmethod
    def validate_otp_test_code(cls, value: str) -> str:
        if len(value) != 6 or not value.isdigit():
            raise ValueError("OTP_TEST_CODE must be exactly six digits")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def prohibited_wish_term_list(self) -> list[str]:
        return [
            term.strip().casefold()
            for term in self.prohibited_wish_terms.split(",")
            if term.strip()
        ]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def docs_url(self) -> str | None:
        return None if self.is_production else "/docs"

    @property
    def redoc_url(self) -> str | None:
        return None if self.is_production else "/redoc"

    @property
    def cookie_secure(self) -> bool:
        return self.is_production

    @model_validator(mode="after")
    def enforce_safety(self) -> Settings:
        for name, secret in {
            "JWT_SECRET": self.jwt_secret,
            "REFRESH_TOKEN_PEPPER": self.refresh_token_pepper,
            "CRYPTO_KEY": self.crypto_key,
            "LOOKUP_HMAC_KEY": self.lookup_hmac_key,
            "OTP_HMAC_KEY": self.otp_hmac_key,
        }.items():
            if len(secret.get_secret_value()) < 32:
                raise ValueError(f"{name} must be at least 32 characters")
        if self.min_gift_inr > self.max_gift_inr:
            raise ValueError("MIN_GIFT_INR must be less than or equal to MAX_GIFT_INR")
        if self.wish_message_min > self.wish_message_max:
            raise ValueError("WISH_MESSAGE_MIN must be less than or equal to WISH_MESSAGE_MAX")
        if self.environment in {"local", "test"} and self.payments_live_enabled:
            raise ValueError("PAYMENTS_LIVE_ENABLED must be false in local and test environments")
        if self.payments_live_enabled and self.handoff_mode != "live":
            raise ValueError("PAYMENTS_LIVE_ENABLED=true requires HANDOFF_MODE=live")
        if not self.payments_live_enabled and self.handoff_mode == "live":
            raise ValueError("HANDOFF_MODE=live requires PAYMENTS_LIVE_ENABLED=true")
        if self.environment == "production":
            for name, secret in {
                "JWT_SECRET": self.jwt_secret,
                "REFRESH_TOKEN_PEPPER": self.refresh_token_pepper,
                "CRYPTO_KEY": self.crypto_key,
                "LOOKUP_HMAC_KEY": self.lookup_hmac_key,
                "OTP_HMAC_KEY": self.otp_hmac_key,
            }.items():
                value = secret.get_secret_value()
                if any(marker in value for marker in _INSECURE_SECRET_PLACEHOLDERS):
                    raise ValueError(f"{name} must not use a development placeholder in production")
            if self.sms_provider == "test":
                raise ValueError("SMS_PROVIDER must not be the test adapter in production")
            if self.crypto_provider == "local":
                raise ValueError("CRYPTO_PROVIDER must not be the local adapter in production")
            if self.handoff_provider == "test":
                raise ValueError("HANDOFF_PROVIDER must not be the test adapter in production")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
