from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "database_url": "postgresql+psycopg://localhost:5432/kindah_test",
        "jwt_secret": "test-only-jwt-secret",
        "refresh_token_pepper": "test-only-refresh-token-pepper",
        "crypto_key": "test-only-crypto-key",
    }
    values.update(overrides)
    return Settings.model_validate(values)


def test_cors_origins_are_split_and_trimmed() -> None:
    settings = make_settings(cors_origins="http://localhost:3000, https://example.test")
    assert settings.cors_origin_list == ["http://localhost:3000", "https://example.test"]


def test_invalid_log_level_is_rejected() -> None:
    with pytest.raises(ValidationError):
        make_settings(log_level="LOUD")


def test_non_postgres_database_url_is_rejected() -> None:
    with pytest.raises(ValidationError):
        make_settings(database_url="sqlite:///test.db")


def test_api_prefix_must_start_with_slash() -> None:
    with pytest.raises(ValidationError):
        make_settings(api_v1_prefix="api/v1")


def test_api_prefix_trailing_slash_is_normalized() -> None:
    assert make_settings(api_v1_prefix="/api/v1/").api_v1_prefix == "/api/v1"


def test_payments_live_is_rejected_in_test_environment() -> None:
    with pytest.raises(ValidationError):
        make_settings(payments_live_enabled=True, handoff_mode="live")


def test_live_handoff_requires_payments_live() -> None:
    with pytest.raises(ValidationError):
        make_settings(payments_live_enabled=False, handoff_mode="live")


def test_production_rejects_development_secret_placeholders() -> None:
    with pytest.raises(ValidationError):
        make_settings(environment="production")


def test_production_accepts_non_placeholder_secrets() -> None:
    settings = make_settings(
        environment="production",
        jwt_secret="a-real-production-jwt-secret",
        refresh_token_pepper="a-real-production-refresh-pepper",
        crypto_key="a-real-production-crypto-key",
    )
    assert settings.is_production is True
    assert settings.docs_url is None
