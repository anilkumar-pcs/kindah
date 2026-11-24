from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.modules.identity.models import OtpChallenge


def _custom_app(settings: Settings, **updates: object) -> TestClient:
    custom = settings.model_copy(update=updates)
    return TestClient(create_app(custom))


def test_resend_throttle(client: TestClient) -> None:
    first = client.post("/api/v1/auth/otp/request", json={"phone": "9876500010"})
    second = client.post("/api/v1/auth/otp/request", json={"phone": "9876500010"})

    assert first.status_code == 202
    assert second.status_code == 429
    assert second.json()["code"] == "RATE_LIMITED"


def test_phone_rate_limit(settings: Settings) -> None:
    with _custom_app(
        settings,
        otp_resend_seconds=0,
        otp_phone_limit=2,
        otp_ip_limit=100,
    ) as client:
        results = [
            client.post("/api/v1/auth/otp/request", json={"phone": "9876500011"}).status_code
            for _ in range(3)
        ]

    assert results == [202, 202, 429]


def test_ip_rate_limit(settings: Settings) -> None:
    with _custom_app(
        settings,
        otp_resend_seconds=0,
        otp_phone_limit=10,
        otp_ip_limit=1,
    ) as client:
        first = client.post("/api/v1/auth/otp/request", json={"phone": "9876500012"})
        second = client.post("/api/v1/auth/otp/request", json={"phone": "9876500013"})

    assert first.status_code == 202
    assert second.status_code == 429


def test_wrong_otp_attempt_limit(settings: Settings) -> None:
    with _custom_app(
        settings,
        otp_resend_seconds=0,
        otp_max_attempts=2,
    ) as client:
        assert (
            client.post("/api/v1/auth/otp/request", json={"phone": "9876500014"}).status_code == 202
        )
        for _ in range(2):
            response = client.post(
                "/api/v1/auth/otp/verify",
                json={"phone": "9876500014", "code": "000000"},
            )
            assert response.status_code == 401
            assert response.json()["code"] == "INVALID_OTP"

        exhausted = client.post(
            "/api/v1/auth/otp/verify",
            json={"phone": "9876500014", "code": "123456"},
        )

    assert exhausted.status_code == 429
    assert exhausted.json()["code"] == "RATE_LIMITED"


def test_expired_otp_is_rejected(settings: Settings) -> None:
    with _custom_app(settings, otp_resend_seconds=0) as client:
        assert (
            client.post("/api/v1/auth/otp/request", json={"phone": "9876500015"}).status_code == 202
        )

        engine = create_engine(os.environ["DATABASE_URL"])
        try:
            with Session(engine) as db:
                now = datetime.now(UTC)
                db.execute(
                    update(OtpChallenge).values(
                        created_at=now - timedelta(minutes=10),
                        expires_at=now - timedelta(minutes=5),
                    )
                )
                db.commit()
        finally:
            engine.dispose()

        response = client.post(
            "/api/v1/auth/otp/verify",
            json={"phone": "9876500015", "code": "123456"},
        )

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_OTP"


def test_otp_request_response_does_not_reveal_account_existence(
    settings: Settings,
) -> None:
    with _custom_app(settings, otp_resend_seconds=0, otp_phone_limit=10) as client:
        new_number = client.post(
            "/api/v1/auth/otp/request",
            json={"phone": "9876500016"},
        )
        existing = client.post(
            "/api/v1/auth/otp/verify",
            json={"phone": "9876500016", "code": "123456"},
        )
        assert existing.status_code == 200

        repeated = client.post(
            "/api/v1/auth/otp/request",
            json={"phone": "9876500016"},
        )

    assert new_number.status_code == 202
    assert repeated.status_code == 202
    assert new_number.json() == repeated.json()


def test_invalid_phone_is_rejected_without_echoing_input(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/otp/request",
        json={"phone": "1234567890"},
    )

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert "1234567890" not in body["detail"]
