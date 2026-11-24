from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app

pytestmark = pytest.mark.integration


def test_healthz_is_liveness_only(client: TestClient) -> None:
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "kindly-api"


def test_meta_endpoint_exposes_no_sensitive_configuration(client: TestClient) -> None:
    response = client.get("/api/v1/meta")

    assert response.status_code == 200
    body = response.json()
    assert body == {"service": "kindly-api", "version": "0.1.0", "environment": "test"}
    assert "database_url" not in body


def test_readyz_reports_database_and_disabled_redis(client: TestClient) -> None:
    response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"database": "ok", "redis": "disabled"},
    }


def test_readyz_returns_503_when_database_is_unavailable(
    app: FastAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail_check() -> None:
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(app.state.db, "check", fail_check)
    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 503
    body = response.json()
    assert body["code"] == "DEPENDENCY_UNAVAILABLE"
    assert body["checks"]["database"] == "unavailable"


def test_readyz_is_degraded_but_alive_when_redis_is_unreachable(settings: Settings) -> None:
    redis_settings = settings.model_copy(
        update={"redis_url": "redis://localhost:6399/0", "redis_timeout_seconds": 0.1}
    )
    app = create_app(redis_settings)
    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert response.json()["checks"]["redis"] == "degraded"


def test_unknown_route_uses_problem_json(client: TestClient) -> None:
    response = client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["code"] == "NOT_FOUND"
    assert body["type"].endswith("/not-found")
    assert "requestId" in body


def test_validation_error_uses_problem_json_without_input_echo(app: FastAPI) -> None:
    @app.get("/_test/validate")
    def validate(value: int) -> dict[str, int]:
        return {"value": value}

    with TestClient(app) as client:
        response = client.get("/_test/validate", params={"value": "not-an-int"})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["errors"]
    assert "input" not in body["errors"][0]


def test_request_id_is_echoed_and_used_in_problem_payload(client: TestClient) -> None:
    response = client.get("/missing", headers={"X-Request-ID": "test-request-123"})

    assert response.headers["X-Request-ID"] == "test-request-123"
    assert response.json()["requestId"] == "test-request-123"


def test_invalid_request_id_is_replaced(client: TestClient) -> None:
    response = client.get("/healthz", headers={"X-Request-ID": "bad id with spaces"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] != "bad id with spaces"


def test_security_headers_are_present(client: TestClient) -> None:
    response = client.get("/healthz")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"


def test_cors_preflight_allows_configured_origin(client: TestClient) -> None:
    response = client.options(
        "/api/v1/meta",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_preflight_allows_csrf_header(client: TestClient) -> None:
    response = client.options(
        "/api/v1/auth/refresh",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-csrf-token,content-type",
        },
    )

    assert response.status_code == 200
    allowed = response.headers["access-control-allow-headers"].lower()
    assert "x-csrf-token" in allowed


def test_cors_preflight_allows_admin_mfa_header(client: TestClient) -> None:
    response = client.options(
        "/api/v1/admin/reports",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "x-admin-mfa",
        },
    )

    assert response.status_code == 200
    allowed = response.headers["access-control-allow-headers"].lower()
    assert "x-admin-mfa" in allowed
