from __future__ import annotations

import logging
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.modules.identity.models import AuthEvent, User
from tests.integration.helpers import (
    auth_headers,
    complete_profile,
    record_consent,
    request_and_verify,
)

pytestmark = pytest.mark.integration


def test_sign_in_creates_pseudonymous_account(client: TestClient) -> None:
    session = request_and_verify(client)
    profile = session["user"]

    assert session["tokenType"] == "Bearer"
    assert profile["onboardingRequired"] is True
    assert profile["displayName"] is None
    assert "phone" not in profile
    assert "mobile" not in profile
    assert "vpa" not in profile

    response = client.get("/api/v1/me", headers=auth_headers(session))
    assert response.status_code == 200
    assert response.json()["id"] == profile["id"]
    assert response.json()["onboardingRequired"] is True


def test_consent_requires_every_confirmation(client: TestClient) -> None:
    session = request_and_verify(client)
    headers = auth_headers(session)

    response = client.post(
        "/api/v1/me/consent",
        headers=headers,
        json={
            "ageConfirmed": False,
            "termsAccepted": True,
            "privacyAccepted": True,
            "guidelinesAccepted": True,
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    me = client.get("/api/v1/me", headers=headers).json()
    assert me["ageConfirmedAt"] is None


def test_profile_requires_consent_then_completes_onboarding(client: TestClient) -> None:
    session = request_and_verify(client)
    headers = auth_headers(session)

    blocked = client.patch(
        "/api/v1/me",
        headers=headers,
        json={"displayName": "ChaiLover", "avatar": "CHAI"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "CONSENT_REQUIRED"

    consent = record_consent(client, headers)
    assert consent["ageConfirmedAt"] is not None
    assert consent["termsAcceptedAt"] is not None
    assert consent["privacyAcceptedAt"] is not None
    assert consent["guidelinesAcceptedAt"] is not None

    profile = complete_profile(client, headers)
    assert profile["displayName"] == "ChaiLover"
    assert profile["avatar"] == "CHAI"
    assert profile["city"] == "Bengaluru"
    assert profile["onboardingRequired"] is False


def test_avatar_is_required_to_finish_onboarding(client: TestClient) -> None:
    session = request_and_verify(client)
    headers = auth_headers(session)
    record_consent(client, headers)

    response = client.patch(
        "/api/v1/me",
        headers=headers,
        json={"displayName": "NoAvatar"},
    )
    assert response.status_code == 200
    assert response.json()["onboardingRequired"] is True

    response = client.patch(
        "/api/v1/me",
        headers=headers,
        json={"avatar": "SUN"},
    )
    assert response.status_code == 200
    assert response.json()["onboardingRequired"] is False


def test_same_phone_reuses_one_account(settings: Settings) -> None:
    custom = settings.model_copy(update={"otp_resend_seconds": 0})
    app = create_app(custom)
    with TestClient(app) as client:
        first = request_and_verify(client, phone="9876500001")
        second = request_and_verify(client, phone="+91 98765 00001")
        assert first["user"]["id"] == second["user"]["id"]

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            count = db.scalar(select(func.count()).select_from(User))
            assert count == 1
    finally:
        engine.dispose()


def test_display_name_validation_and_uniqueness(settings: Settings) -> None:
    custom = settings.model_copy(update={"otp_resend_seconds": 0})
    app = create_app(custom)
    with TestClient(app) as first_client, TestClient(app) as second_client:
        first_session = request_and_verify(first_client, phone="9876500002")
        first_headers = auth_headers(first_session)
        record_consent(first_client, first_headers)

        for bad_name in ("ab", "admin", "9876543210", "has space", "a" * 25):
            response = first_client.patch(
                "/api/v1/me",
                headers=first_headers,
                json={"displayName": bad_name},
            )
            assert response.status_code == 400, bad_name

        complete_profile(first_client, first_headers, display_name="ChaiLover")

        second_session = request_and_verify(second_client, phone="9876500003")
        second_headers = auth_headers(second_session)
        record_consent(second_client, second_headers)

        duplicate = second_client.patch(
            "/api/v1/me",
            headers=second_headers,
            json={"displayName": "chailover"},
        )
        assert duplicate.status_code == 409
        assert duplicate.json()["code"] == "DISPLAY_NAME_TAKEN"

        invalid_avatar = second_client.patch(
            "/api/v1/me",
            headers=second_headers,
            json={"avatar": "NOPE"},
        )
        assert invalid_avatar.status_code == 422

        invalid_city = second_client.patch(
            "/api/v1/me",
            headers=second_headers,
            json={"city": "1"},
        )
        assert invalid_city.status_code == 400


def test_auth_events_contain_no_phone_or_otp(client: TestClient) -> None:
    request_and_verify(client)

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            events = db.scalars(select(AuthEvent)).all()
            event_types = {event.event_type for event in events}
            assert {"OTP_REQUESTED", "ACCOUNT_CREATED"} <= event_types
            metadata = str([event.event_metadata for event in events])
            assert "9876543210" not in metadata
            assert "123456" not in metadata
    finally:
        engine.dispose()


def test_otp_and_phone_do_not_appear_in_logs(
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)
    request_and_verify(client)

    assert "9876543210" not in caplog.text
    assert "123456" not in caplog.text
