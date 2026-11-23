from __future__ import annotations

import os
from collections.abc import Iterator

# Must be set before importing app.main, which builds a default app at import.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://localhost:5432/kindah_test")
os.environ.setdefault("REDIS_URL", "")
os.environ.setdefault("JWT_SECRET", "test-only-jwt-secret")
os.environ.setdefault("REFRESH_TOKEN_PEPPER", "test-only-refresh-token-pepper")
os.environ.setdefault("CRYPTO_KEY", "test-only-crypto-key")
os.environ.setdefault("PAYMENTS_LIVE_ENABLED", "false")
os.environ.setdefault("HANDOFF_MODE", "test")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app

TEST_DATABASE_URL = os.environ["DATABASE_URL"]


@pytest.fixture
def settings() -> Settings:
    return Settings(
        environment="test",
        database_url=TEST_DATABASE_URL,
        redis_url=None,
        cors_origins="http://localhost:3000",
        jwt_secret="test-only-jwt-secret",
        refresh_token_pepper="test-only-refresh-token-pepper",
        crypto_key="test-only-crypto-key",
        payments_live_enabled=False,
        handoff_mode="test",
        db_connect_timeout_seconds=2,
        redis_timeout_seconds=0.2,
    )


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
