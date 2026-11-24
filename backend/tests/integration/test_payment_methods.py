from __future__ import annotations

import logging
import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.modules.identity.models import User, UserStatus
from app.modules.payment_methods.models import RecipientPaymentMethod
from tests.integration.helpers import (
    auth_headers,
    complete_onboarding,
    complete_setup,
    request_and_verify,
    save_payment_method,
)

pytestmark = pytest.mark.integration


def _set_last_authenticated_at(user_id: str, value: datetime) -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            user = db.get(User, UUID(user_id))
            assert user is not None
            user.last_authenticated_at = value
            db.commit()
    finally:
        engine.dispose()


def _set_user_status(user_id: str, status: UserStatus) -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            user = db.get(User, UUID(user_id))
            assert user is not None
            user.status = status
            db.commit()
    finally:
        engine.dispose()


def test_save_and_get_only_masked_vpa(
    client: TestClient,
    app: FastAPI,
) -> None:
    session, _headers, payment_method = complete_setup(client)
    assert payment_method["maskedVpa"] == "al***@okhdfc"
    assert payment_method["version"] == 1
    assert payment_method["validationStatus"] == "SYNTAX_ONLY"
    assert "vpa" not in payment_method
    assert "alice@okhdfc" not in str(payment_method)

    fetched = client.get(
        "/api/v1/me/payment-method",
        headers=auth_headers(session),
    )
    assert fetched.status_code == 200
    assert fetched.json()["maskedVpa"] == "al***@okhdfc"

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            row = db.scalar(select(RecipientPaymentMethod))
            assert row is not None
            assert "alice" not in row.encrypted_vpa
            assert len(row.vpa_hmac) == 64
            plaintext = app.state.crypto.decrypt(
                row.encrypted_vpa,
                context="payment_method.vpa",
            )
            assert plaintext == "alice@okhdfc"
    finally:
        engine.dispose()


def test_privacy_acknowledgement_is_required(client: TestClient) -> None:
    _, headers = complete_onboarding(client)

    response = client.put(
        "/api/v1/me/payment-method",
        headers=headers,
        json={"vpa": "alice@okhdfc", "privacyAcknowledged": False},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_invalid_vpa_is_rejected(client: TestClient) -> None:
    _, headers = complete_onboarding(client)

    response = client.put(
        "/api/v1/me/payment-method",
        headers=headers,
        json={"vpa": "not-a-vpa", "privacyAcknowledged": True},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_vpa_cannot_be_linked_to_two_accounts(settings: Settings) -> None:
    custom = settings.model_copy(update={"otp_resend_seconds": 0})
    app = create_app(custom)
    with TestClient(app) as first, TestClient(app) as second:
        _, first_headers, _ = complete_setup(
            first,
            phone="9876500101",
            display_name="FirstUser",
        )
        save_payment_method(first, first_headers, vpa="alice@okhdfc")

        _, second_headers = complete_onboarding(
            second,
            phone="9876500102",
            display_name="SecondUser",
        )
        response = second.put(
            "/api/v1/me/payment-method",
            headers=second_headers,
            json={"vpa": "Alice@okhdfc", "privacyAcknowledged": True},
        )

    assert response.status_code == 409
    assert response.json()["code"] == "VPA_ALREADY_IN_USE"


def test_vpa_change_increments_version(client: TestClient) -> None:
    session, headers, _ = complete_setup(client)

    first = save_payment_method(client, headers, vpa="bob@okaxis")
    assert first["version"] == 2

    same = save_payment_method(client, headers, vpa="bob@okaxis")
    assert same["version"] == 2

    fetched = client.get("/api/v1/me/payment-method", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["version"] == 2
    assert session["user"]["id"]


def test_reauth_required_for_old_session_then_succeeds(settings: Settings) -> None:
    custom = settings.model_copy(update={"otp_resend_seconds": 0})
    app = create_app(custom)
    with TestClient(app) as client:
        session, headers, _ = complete_setup(client)
        _set_last_authenticated_at(
            str(session["user"]["id"]),
            datetime.now(UTC) - timedelta(hours=1),
        )

        blocked = client.put(
            "/api/v1/me/payment-method",
            headers=headers,
            json={"vpa": "new@okhdfc", "privacyAcknowledged": True},
        )
        assert blocked.status_code == 403
        assert blocked.json()["code"] == "REAUTHENTICATION_REQUIRED"

        refreshed_session = request_and_verify(client)
        refreshed_headers = auth_headers(refreshed_session)
        saved = save_payment_method(client, refreshed_headers, vpa="new@okhdfc")
        assert saved["maskedVpa"] == "ne***@okhdfc"


def test_authentication_required(client: TestClient) -> None:
    response = client.put(
        "/api/v1/me/payment-method",
        json={"vpa": "alice@okhdfc", "privacyAcknowledged": True},
    )
    assert response.status_code == 401


def test_restricted_user_cannot_change_vpa(client: TestClient) -> None:
    session, headers, _ = complete_setup(client)
    _set_user_status(str(session["user"]["id"]), UserStatus.RESTRICTED)

    response = client.put(
        "/api/v1/me/payment-method",
        headers=headers,
        json={"vpa": "other@okaxis", "privacyAcknowledged": True},
    )

    assert response.status_code == 403
    assert response.json()["code"] == "ACCOUNT_RESTRICTED"


def test_vpa_never_appears_in_logs(
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)
    complete_setup(client, vpa="alice@okhdfc")
    assert "alice@okhdfc" not in caplog.text
