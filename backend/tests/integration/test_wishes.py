from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.identity.models import User, UserStatus
from app.modules.wishes.models import Wish, WishMood, WishStatus
from app.modules.wishes.service import expire_due_wishes
from tests.integration.helpers import (
    auth_headers,
    complete_onboarding,
    complete_setup,
    request_and_verify,
    save_payment_method,
)

pytestmark = pytest.mark.integration

_VALID_WISH: dict[str, Any] = {
    "message": "A warm chai for a long day",
    "mood": "LONG_DAY",
    "suggestedAmountInr": 25,
    "city": "Bengaluru",
}


def _create_wish(
    client: TestClient,
    headers: dict[str, str],
    **overrides: Any,
) -> Any:
    payload = dict(_VALID_WISH)
    payload.update(overrides)
    return client.post("/api/v1/wishes", headers=headers, json=payload)


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


def test_create_wish_and_history(client: TestClient) -> None:
    _, headers, _ = complete_setup(client)

    response = _create_wish(client, headers)
    assert response.status_code == 201, response.text
    wish = response.json()
    assert wish["status"] == "OPEN"
    assert wish["mood"] == "LONG_DAY"
    assert wish["suggestedAmountInr"] == 25
    assert wish["city"] == "Bengaluru"
    assert wish["closedReason"] is None
    assert "vpa" not in wish
    assert "maskedVpa" not in wish

    history = client.get("/api/v1/me/wishes", headers=headers)
    assert history.status_code == 200
    assert len(history.json()["wishes"]) == 1
    assert history.json()["wishes"][0]["id"] == wish["id"]


def test_payment_method_is_required(client: TestClient) -> None:
    _, headers = complete_onboarding(client)

    response = _create_wish(client, headers)

    assert response.status_code == 403
    assert response.json()["code"] == "PAYMENT_METHOD_REQUIRED"


def test_onboarding_is_required(client: TestClient) -> None:
    session = request_and_verify(client)
    headers = auth_headers(session)
    save_payment_method(client, headers, vpa="early@okhdfc")

    response = _create_wish(client, headers)

    assert response.status_code == 403
    assert response.json()["code"] == "ONBOARDING_REQUIRED"


def test_only_one_active_wish(client: TestClient) -> None:
    _, headers, _ = complete_setup(client)
    assert _create_wish(client, headers).status_code == 201

    second = _create_wish(client, headers)

    assert second.status_code == 409
    assert second.json()["code"] == "WISH_ALREADY_ACTIVE"


def test_withdraw_starts_cooldown(client: TestClient) -> None:
    _, headers, _ = complete_setup(client)
    wish = _create_wish(client, headers).json()

    withdrawn = client.delete(f"/api/v1/wishes/{wish['id']}", headers=headers)

    assert withdrawn.status_code == 200
    body = withdrawn.json()
    assert body["status"] == "EXPIRED"
    assert body["closedReason"] == "WITHDRAWN"
    assert body["cooldownUntil"] is not None

    blocked = _create_wish(client, headers)
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "COOLDOWN_ACTIVE"


def test_other_user_cannot_withdraw(settings: Settings) -> None:
    from app.main import create_app

    custom = settings.model_copy(update={"otp_resend_seconds": 0})
    app = create_app(custom)
    with TestClient(app) as owner, TestClient(app) as stranger:
        _, owner_headers, _ = complete_setup(
            owner,
            phone="9876500201",
            display_name="OwnerUser",
        )
        _, stranger_headers, _ = complete_setup(
            stranger,
            phone="9876500202",
            display_name="StrangerUser",
            vpa="stranger@okaxis",
        )
        wish = _create_wish(owner, owner_headers).json()

        response = stranger.delete(
            f"/api/v1/wishes/{wish['id']}",
            headers=stranger_headers,
        )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "message",
    [
        "short",
        "x" * 121,
        "Visit https://example.com for this",
        "Call 9876543210 for this",
        "Pay me at alice@okhdfc",
        "<b>bold wish</b>",
        "Open upi://pay?pa=alice@okhdfc",
    ],
)
def test_invalid_messages_are_rejected(
    client: TestClient,
    message: str,
) -> None:
    _, headers, _ = complete_setup(client)

    response = _create_wish(client, headers, message=message)

    assert response.status_code in {400, 422}, response.text


@pytest.mark.parametrize("message", ["a" * 10, "a" * 120])
def test_message_length_boundaries_are_accepted(
    client: TestClient,
    message: str,
) -> None:
    _, headers, _ = complete_setup(client)
    response = _create_wish(client, headers, message=message)
    assert response.status_code == 201, response.text


@pytest.mark.parametrize("amount", [9, 101, 25.5, "25"])
def test_invalid_amounts_are_rejected(client: TestClient, amount: object) -> None:
    _, headers, _ = complete_setup(client)
    response = _create_wish(client, headers, suggestedAmountInr=amount)
    assert response.status_code == 422, response.text


@pytest.mark.parametrize("amount", [10, 100])
def test_amount_boundaries_are_accepted(client: TestClient, amount: int) -> None:
    _, headers, _ = complete_setup(client)
    response = _create_wish(client, headers, suggestedAmountInr=amount)
    assert response.status_code == 201, response.text


def test_invalid_mood_is_rejected(client: TestClient) -> None:
    _, headers, _ = complete_setup(client)
    response = _create_wish(client, headers, mood="ANGRY")
    assert response.status_code == 422


def test_invalid_city_is_rejected(client: TestClient) -> None:
    _, headers, _ = complete_setup(client)
    response = _create_wish(client, headers, city="1")
    assert response.status_code == 400


def test_restricted_user_cannot_create(client: TestClient) -> None:
    session, headers, _ = complete_setup(client)
    _set_user_status(str(session["user"]["id"]), UserStatus.RESTRICTED)

    response = _create_wish(client, headers)

    assert response.status_code == 403
    assert response.json()["code"] == "ACCOUNT_RESTRICTED"


def test_expiry_worker_is_idempotent(client: TestClient, settings: Settings) -> None:
    _, headers, _ = complete_setup(client)
    wish_id = _create_wish(client, headers).json()["id"]
    now = datetime.now(UTC)

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            wish = db.get(Wish, UUID(wish_id))
            assert wish is not None
            wish.created_at = now - timedelta(hours=25)
            wish.expires_at = now - timedelta(hours=1)
            db.commit()

        with Session(engine) as db:
            assert expire_due_wishes(session=db, settings=settings, now=now) == 1

        with Session(engine) as db:
            wish = db.get(Wish, UUID(wish_id))
            assert wish is not None
            assert wish.status == WishStatus.EXPIRED
            assert wish.closed_reason == "EXPIRED"
            assert wish.cooldown_until is not None
            assert wish.cooldown_until > now

        with Session(engine) as db:
            assert expire_due_wishes(session=db, settings=settings, now=now) == 0
    finally:
        engine.dispose()


def test_expiry_worker_ignores_live_wishes(client: TestClient, settings: Settings) -> None:
    _, headers, _ = complete_setup(client)
    _create_wish(client, headers)

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert expire_due_wishes(session=db, settings=settings) == 0
    finally:
        engine.dispose()


def test_partial_index_blocks_two_active_wishes(
    client: TestClient,
    settings: Settings,
) -> None:
    session, _, _ = complete_setup(client)
    user_id = UUID(str(session["user"]["id"]))
    now = datetime.now(UTC)

    def make_wish() -> Wish:
        return Wish(
            id=uuid.uuid4(),
            user_id=user_id,
            message="A valid wish message",
            mood=WishMood.JUST_BECAUSE,
            status=WishStatus.OPEN,
            expires_at=now + timedelta(hours=24),
            created_at=now,
            updated_at=now,
        )

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            db.add(make_wish())
            db.commit()

        with Session(engine) as db:
            db.add(make_wish())
            with pytest.raises(IntegrityError):
                db.commit()
            db.rollback()
    finally:
        engine.dispose()
