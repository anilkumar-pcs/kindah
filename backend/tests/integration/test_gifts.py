from __future__ import annotations

import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.gifts.models import (
    Gift,
    GiftStatus,
    KarmaEvent,
    ReservationStatus,
    WishReservation,
)
from app.modules.wishes.models import Wish, WishStatus
from app.workers.reservation_expiry import expire_reservations
from app.workers.unverified_timeout import mark_unverified
from tests.integration.helpers import complete_setup

pytestmark = pytest.mark.integration

_WISH = {
    "message": "A warm chai for a long day",
    "mood": "LONG_DAY",
    "suggestedAmountInr": 25,
    "city": "Bengaluru",
}


def _idem() -> str:
    return str(uuid.uuid4())


def _setup(
    client: TestClient,
) -> tuple[
    dict[str, Any],
    dict[str, str],
    dict[str, Any],
    dict[str, str],
    dict[str, Any],
]:
    donor_session, donor_headers, _ = complete_setup(
        client,
        phone="9876500701",
        display_name="DonorOne",
        vpa="donor1@okhdfc",
    )
    recipient_session, recipient_headers, _ = complete_setup(
        client,
        phone="9876500702",
        display_name="RecipientOne",
        vpa="recipient1@okaxis",
    )
    wish_response = client.post(
        "/api/v1/wishes",
        headers=recipient_headers,
        json=_WISH,
    )
    assert wish_response.status_code == 201, wish_response.text
    return (
        donor_session,
        donor_headers,
        recipient_session,
        recipient_headers,
        cast(dict[str, Any], wish_response.json()),
    )


def _create_gift(
    client: TestClient,
    headers: dict[str, str],
    wish_id: str,
    *,
    amount: int = 25,
    key: str | None = None,
) -> Any:
    return client.post(
        "/api/v1/gifts",
        headers={**headers, "Idempotency-Key": key or _idem()},
        json={"wishId": wish_id, "amountInr": amount, "cheerNote": "Enjoy!"},
    )


def _outcome(
    client: TestClient,
    headers: dict[str, str],
    gift_id: str,
    outcome: str,
    *,
    key: str | None = None,
) -> Any:
    return client.post(
        f"/api/v1/gifts/{gift_id}/donor-outcome",
        headers={**headers, "Idempotency-Key": key or _idem()},
        json={"outcome": outcome},
    )


def _confirm(
    client: TestClient,
    headers: dict[str, str],
    gift_id: str,
    outcome: str = "RECEIVED",
    *,
    key: str | None = None,
) -> Any:
    return client.post(
        f"/api/v1/gifts/{gift_id}/recipient-confirmation",
        headers={**headers, "Idempotency-Key": key or _idem()},
        json={"outcome": outcome, "reaction": "HEART", "message": "Thank you!"},
    )


def _set_reservation_expired(gift_id: str) -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            reservation = db.scalar(
                select(WishReservation).where(WishReservation.gift_id == UUID(gift_id))
            )
            assert reservation is not None
            now = datetime.now(UTC)
            reservation.reserved_at = now - timedelta(minutes=20)
            reservation.expires_at = now - timedelta(minutes=1)
            db.commit()
    finally:
        engine.dispose()


def _set_recipient_deadline_past(gift_id: str) -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            gift = db.get(Gift, UUID(gift_id))
            assert gift is not None
            gift.recipient_response_deadline = datetime.now(UTC) - timedelta(minutes=1)
            db.commit()
    finally:
        engine.dispose()


def test_create_gift_handoff_and_participant_views(
    client: TestClient,
    settings: Settings,
    app: FastAPI,
) -> None:
    donor_session, donor_headers, recipient_session, recipient_headers, wish = _setup(client)

    response = _create_gift(client, donor_headers, wish["id"])

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["giftStatus"] == "HANDOFF_ISSUED"
    assert body["wishStatus"] == "LOCKED"
    assert body["amountInr"] == 25
    assert body["upiIntentUri"].startswith("upi://pay?")
    assert body["qrPayload"] == body["upiIntentUri"]
    assert body["recipientDisplayName"] == "RecipientOne"
    assert body["viewerRole"] == "DONOR"

    donor_view = client.get(f"/api/v1/gifts/{body['giftId']}", headers=donor_headers)
    assert donor_view.status_code == 200
    assert donor_view.json()["upiIntentUri"].startswith("upi://pay?")
    assert donor_view.json()["viewerRole"] == "DONOR"

    recipient_view = client.get(
        f"/api/v1/gifts/{body['giftId']}",
        headers=recipient_headers,
    )
    assert recipient_view.status_code == 200
    assert recipient_view.json()["upiIntentUri"] is None
    assert recipient_view.json()["recipientDisplayName"] is None
    assert recipient_view.json()["viewerRole"] == "RECIPIENT"

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            gift = db.get(Gift, UUID(body["giftId"]))
            assert gift is not None
            assert "upi://" not in gift.handoff_payload_encrypted
            reservation = db.scalar(
                select(WishReservation).where(WishReservation.gift_id == gift.id)
            )
            assert reservation is not None
            assert reservation.status == ReservationStatus.ACTIVE
            wish_row = db.get(Wish, UUID(wish["id"]))
            assert wish_row is not None
            assert wish_row.status == WishStatus.LOCKED
            assert donor_session["user"]["id"] and recipient_session["user"]["id"]
    finally:
        engine.dispose()


def test_idempotency_replay_and_payload_conflict(client: TestClient) -> None:
    _, donor_headers, _, _, wish = _setup(client)
    key = _idem()

    first = _create_gift(client, donor_headers, wish["id"], key=key)
    second = _create_gift(client, donor_headers, wish["id"], key=key)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["giftId"] == second.json()["giftId"]

    conflict = _create_gift(client, donor_headers, wish["id"], amount=30, key=key)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert db.scalar(select(func.count(Gift.id))) == 1
    finally:
        engine.dispose()


def test_two_concurrent_donors_only_one_reserves(
    client: TestClient,
    settings: Settings,
    app: FastAPI,
) -> None:
    _, donor_one_headers, _, _, wish = _setup(client)
    _, donor_two_headers, _ = complete_setup(
        client,
        phone="9876500703",
        display_name="DonorTwo",
        vpa="donor2@okhdfc",
    )

    def attempt(headers: dict[str, str]) -> int:
        with TestClient(app) as thread_client:
            response = _create_gift(thread_client, headers, wish["id"])
            return int(response.status_code)

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = sorted(pool.map(attempt, [donor_one_headers, donor_two_headers]))

    assert statuses == [201, 409], statuses
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert db.scalar(select(func.count(Gift.id))) == 1
            assert db.scalar(select(func.count(WishReservation.id))) == 1
    finally:
        engine.dispose()
    assert settings.reservation_minutes == 10


def test_paid_path_consumes_reservation_and_blocks_failed(client: TestClient) -> None:
    _, donor_headers, _, _, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()

    paid = _outcome(client, donor_headers, gift["giftId"], "PAID")
    assert paid.status_code == 200, paid.text
    assert paid.json()["giftStatus"] == "DONOR_CLAIMED_PAID"
    assert paid.json()["wishStatus"] == "PAYMENT_CLAIMED"

    failed = _outcome(client, donor_headers, gift["giftId"], "FAILED")
    assert failed.status_code == 422
    assert failed.json()["code"] == "INVALID_STATE_TRANSITION"

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            reservation = db.scalar(
                select(WishReservation).where(WishReservation.gift_id == UUID(gift["giftId"]))
            )
            assert reservation is not None
            assert reservation.status == ReservationStatus.CONSUMED
            assert db.scalar(select(func.count(KarmaEvent.id))) == 0
    finally:
        engine.dispose()


def test_still_processing_extends_once_and_can_then_pay(client: TestClient) -> None:
    _, donor_headers, _, _, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()

    pending = _outcome(client, donor_headers, gift["giftId"], "STILL_PROCESSING")
    assert pending.status_code == 200
    assert pending.json()["giftStatus"] == "DONOR_PENDING"

    assert _outcome(client, donor_headers, gift["giftId"], "STILL_PROCESSING").status_code == 422

    paid = _outcome(client, donor_headers, gift["giftId"], "PAID")
    assert paid.status_code == 200
    assert paid.json()["giftStatus"] == "DONOR_CLAIMED_PAID"


def test_failed_releases_wish_for_another_donor(client: TestClient) -> None:
    _, donor_headers, _, _, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    failed = _outcome(client, donor_headers, gift["giftId"], "FAILED")
    assert failed.status_code == 200
    assert failed.json()["giftStatus"] == "FAILED"
    assert failed.json()["wishStatus"] == "OPEN"

    _, donor_two_headers, _ = complete_setup(
        client,
        phone="9876500704",
        display_name="DonorThree",
        vpa="donor3@okhdfc",
    )
    assert _create_gift(client, donor_two_headers, wish["id"]).status_code == 201


def test_recipient_confirmation_grants_and_awards_karma_once(client: TestClient) -> None:
    donor_session, donor_headers, recipient_session, recipient_headers, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    assert _outcome(client, donor_headers, gift["giftId"], "PAID").status_code == 200

    key = _idem()
    confirmed = _confirm(client, recipient_headers, gift["giftId"], "RECEIVED", key=key)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["giftStatus"] == "RECIPIENT_CONFIRMED"
    assert confirmed.json()["wishStatus"] == "GRANTED"

    replay = _confirm(client, recipient_headers, gift["giftId"], "RECEIVED", key=key)
    assert replay.status_code == 200
    assert replay.json()["giftStatus"] == "RECIPIENT_CONFIRMED"

    conflicting = _confirm(client, recipient_headers, gift["giftId"], "NOT_RECEIVED")
    assert conflicting.status_code == 422

    donor_id = UUID(str(donor_session["user"]["id"]))
    recipient_id = UUID(str(recipient_session["user"]["id"]))
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            donor_points = db.scalar(
                select(func.sum(KarmaEvent.points_delta)).where(KarmaEvent.user_id == donor_id)
            )
            recipient_points = db.scalar(
                select(func.sum(KarmaEvent.points_delta)).where(KarmaEvent.user_id == recipient_id)
            )
            assert donor_points == 30
            assert recipient_points == 3
            assert db.scalar(select(func.count(KarmaEvent.id))) == 3
    finally:
        engine.dispose()


def test_recipient_dispute_awards_no_karma(client: TestClient) -> None:
    _, donor_headers, _, recipient_headers, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    assert _outcome(client, donor_headers, gift["giftId"], "PAID").status_code == 200

    confirmed = _confirm(client, recipient_headers, gift["giftId"], "NOT_RECEIVED")
    assert confirmed.status_code == 200
    assert confirmed.json()["giftStatus"] == "DISPUTED"
    assert confirmed.json()["wishStatus"] == "DISPUTED"

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert db.scalar(select(func.count(KarmaEvent.id))) == 0
    finally:
        engine.dispose()


def test_only_recipient_can_confirm(client: TestClient) -> None:
    _, donor_headers, _, _, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    assert _outcome(client, donor_headers, gift["giftId"], "PAID").status_code == 200

    assert _confirm(client, donor_headers, gift["giftId"], "RECEIVED").status_code == 403


def test_expiry_worker_reopens_handoff_within_lifetime(
    client: TestClient,
    settings: Settings,
) -> None:
    _, donor_headers, _, _, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    _set_reservation_expired(gift["giftId"])

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert expire_reservations(session=db, settings=settings) == 1
        with Session(engine) as db:
            gift_row = db.get(Gift, UUID(gift["giftId"]))
            wish_row = db.get(Wish, UUID(wish["id"]))
            assert gift_row is not None and wish_row is not None
            reservation = db.scalar(
                select(WishReservation).where(WishReservation.gift_id == gift_row.id)
            )
            assert reservation is not None
            assert gift_row.status == GiftStatus.ABANDONED
            assert reservation.status == ReservationStatus.EXPIRED
            assert wish_row.status == WishStatus.OPEN
    finally:
        engine.dispose()


def test_donor_pending_timeout_never_reopens(
    client: TestClient,
    settings: Settings,
) -> None:
    _, donor_headers, _, _, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    assert _outcome(client, donor_headers, gift["giftId"], "STILL_PROCESSING").status_code == 200
    _set_reservation_expired(gift["giftId"])

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert expire_reservations(session=db, settings=settings) == 1
        with Session(engine) as db:
            wish_row = db.get(Wish, UUID(wish["id"]))
            assert wish_row is not None
            assert wish_row.status == WishStatus.EXPIRED
    finally:
        engine.dispose()


def test_paid_survives_expiry_and_times_out_to_unverified(
    client: TestClient,
    settings: Settings,
) -> None:
    _, donor_headers, _, recipient_headers, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    assert _outcome(client, donor_headers, gift["giftId"], "PAID").status_code == 200
    _set_reservation_expired(gift["giftId"])

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert expire_reservations(session=db, settings=settings) == 0
        with Session(engine) as db:
            wish_row = db.get(Wish, UUID(wish["id"]))
            assert wish_row is not None
            assert wish_row.status == WishStatus.PAYMENT_CLAIMED
    finally:
        engine.dispose()

    _set_recipient_deadline_past(gift["giftId"])
    assert _confirm(client, recipient_headers, gift["giftId"], "RECEIVED").status_code == 422

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert mark_unverified(session=db, settings=settings) == 1
        with Session(engine) as db:
            gift_row = db.get(Gift, UUID(gift["giftId"]))
            wish_row = db.get(Wish, UUID(wish["id"]))
            assert gift_row is not None and wish_row is not None
            assert gift_row.status == GiftStatus.UNVERIFIED
            assert wish_row.status == WishStatus.UNVERIFIED
            assert db.scalar(select(func.count(KarmaEvent.id))) == 0
    finally:
        engine.dispose()


def test_paid_vs_expiry_race_is_consistent(
    client: TestClient,
    settings: Settings,
    app: FastAPI,
) -> None:
    from threading import Barrier

    _, donor_headers, _, _, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    _set_reservation_expired(gift["giftId"])
    barrier = Barrier(2)

    def donor_attempt() -> int:
        with TestClient(app) as thread_client:
            barrier.wait()
            return int(_outcome(thread_client, donor_headers, gift["giftId"], "PAID").status_code)

    def expiry_attempt() -> int:
        barrier.wait()
        engine = create_engine(os.environ["DATABASE_URL"])
        try:
            with Session(engine) as db:
                return expire_reservations(session=db, settings=settings)
        finally:
            engine.dispose()

    with ThreadPoolExecutor(max_workers=2) as pool:
        donor_future = pool.submit(donor_attempt)
        expiry_future = pool.submit(expiry_attempt)
        paid_status = donor_future.result()
        expired_count = expiry_future.result()

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            gift_row = db.get(Gift, UUID(gift["giftId"]))
            wish_row = db.get(Wish, UUID(wish["id"]))
            assert gift_row is not None and wish_row is not None
            if paid_status == 200:
                assert expired_count == 0
                assert gift_row.status == GiftStatus.DONOR_CLAIMED_PAID
                assert wish_row.status == WishStatus.PAYMENT_CLAIMED
            else:
                assert paid_status == 422
                assert expired_count == 1
                assert gift_row.status == GiftStatus.ABANDONED
                assert wish_row.status == WishStatus.OPEN
    finally:
        engine.dispose()


def test_confirmation_vs_timeout_race_is_consistent(
    client: TestClient,
    settings: Settings,
    app: FastAPI,
) -> None:
    from threading import Barrier

    _, donor_headers, _, recipient_headers, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    assert _outcome(client, donor_headers, gift["giftId"], "PAID").status_code == 200

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            gift_row = db.get(Gift, UUID(gift["giftId"]))
            assert gift_row is not None
            gift_row.recipient_response_deadline = datetime.now(UTC) + timedelta(milliseconds=50)
            db.commit()
    finally:
        engine.dispose()

    barrier = Barrier(2)

    def confirmation_attempt() -> int:
        with TestClient(app) as thread_client:
            barrier.wait()
            return int(
                _confirm(
                    thread_client,
                    recipient_headers,
                    gift["giftId"],
                    "RECEIVED",
                ).status_code
            )

    def timeout_attempt() -> int:
        barrier.wait()
        engine = create_engine(os.environ["DATABASE_URL"])
        try:
            with Session(engine) as db:
                return mark_unverified(session=db, settings=settings)
        finally:
            engine.dispose()

    with ThreadPoolExecutor(max_workers=2) as pool:
        confirmation_future = pool.submit(confirmation_attempt)
        timeout_future = pool.submit(timeout_attempt)
        confirmation_status = confirmation_future.result()
        marked_count = timeout_future.result()

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            gift_row = db.get(Gift, UUID(gift["giftId"]))
            wish_row = db.get(Wish, UUID(wish["id"]))
            assert gift_row is not None and wish_row is not None
            if confirmation_status == 200:
                assert marked_count == 0
                assert gift_row.status == GiftStatus.RECIPIENT_CONFIRMED
                assert wish_row.status == WishStatus.GRANTED
            else:
                assert confirmation_status == 422
                assert marked_count == 1
                assert gift_row.status == GiftStatus.UNVERIFIED
                assert wish_row.status == WishStatus.UNVERIFIED
    finally:
        engine.dispose()
