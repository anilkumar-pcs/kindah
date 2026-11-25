from __future__ import annotations

import json
import os
import uuid
from datetime import UTC, datetime, time, timedelta
from typing import Any, cast
from uuid import UUID
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.modules.gifts.models import Gift, GiftStatus
from app.modules.payment_methods.models import RecipientPaymentMethod
from app.modules.wishes.models import Wish, WishMood, WishStatus
from tests.integration.helpers import complete_setup

pytestmark = pytest.mark.integration

IST = ZoneInfo("Asia/Kolkata")
_STATS_KEYS = {
    "wishesSharedCount",
    "memberCount",
    "openWishCount",
    "confirmedGiftCountAllTime",
    "confirmedGiftValueInrAllTime",
    "confirmedGiftCountThisWeek",
    "confirmedGiftValueInrThisWeek",
    "activeNeighbourhoodCountThisWeek",
    "communityStreakDays",
    "weeklyConfirmedGifts",
    "activeNeighbourhoods",
    "generatedAt",
}
_FORBIDDEN_STATS_TERMS = (
    "phone",
    "mobile",
    "vpa",
    "utr",
    "donor",
    "recipient",
    "displayname",
    "city",
    "latitude",
    "longitude",
)


def _create_user(
    client: TestClient,
    suffix: int,
    display_name: str,
) -> tuple[dict[str, Any], dict[str, str], dict[str, Any]]:
    return complete_setup(
        client,
        phone=f"9876520{suffix:03d}",
        display_name=display_name,
        vpa=f"stats{suffix}@okhdfc",
    )


def _create_wish(
    client: TestClient,
    headers: dict[str, str],
    *,
    message: str = "A warm chai for a long day",
    mood: str = "LONG_DAY",
    amount: int = 25,
    city: str = "Bengaluru",
) -> dict[str, Any]:
    response = client.post(
        "/api/v1/wishes",
        headers=headers,
        json={
            "message": message,
            "mood": mood,
            "suggestedAmountInr": amount,
            "city": city,
        },
    )
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json())


def _current_week_bounds() -> tuple[datetime, datetime]:
    local = datetime.now(UTC).astimezone(IST)
    monday = local.date() - timedelta(days=local.weekday())
    start = datetime.combine(monday, time.min, tzinfo=IST).astimezone(UTC)
    end = datetime.combine(monday + timedelta(days=7), time.min, tzinfo=IST).astimezone(UTC)
    return start, end


def _insert_gifts(
    *,
    donor_id: str,
    recipient_id: str,
    rows: list[dict[str, Any]],
) -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            recipient_uuid = UUID(recipient_id)
            donor_uuid = UUID(donor_id)
            payment_method = db.scalar(
                select(RecipientPaymentMethod).where(
                    RecipientPaymentMethod.user_id == recipient_uuid
                )
            )
            assert payment_method is not None
            for row in rows:
                confirmed_at = cast(datetime, row["confirmed_at"])
                gift_status = cast(
                    GiftStatus,
                    row.get("status", GiftStatus.RECIPIENT_CONFIRMED),
                )
                amount = int(row.get("amount", 25))
                wish_id = uuid.uuid4()
                wish_status = (
                    WishStatus.GRANTED
                    if gift_status == GiftStatus.RECIPIENT_CONFIRMED
                    else WishStatus.PAYMENT_CLAIMED
                )
                db.add(
                    Wish(
                        id=wish_id,
                        user_id=recipient_uuid,
                        message="A warm chai for a good day",
                        mood=WishMood.JUST_BECAUSE,
                        suggested_amount_inr=amount,
                        city=cast(str | None, row.get("city", "Bengaluru")),
                        status=wish_status,
                        expires_at=confirmed_at + timedelta(days=1),
                        created_at=confirmed_at - timedelta(hours=1),
                        updated_at=confirmed_at,
                    )
                )
                db.flush()
                db.add(
                    Gift(
                        id=uuid.uuid4(),
                        wish_id=wish_id,
                        donor_id=donor_uuid,
                        recipient_id=recipient_uuid,
                        amount_inr=amount,
                        cheer_note=None,
                        payment_ref=f"KIND-{uuid.uuid4().hex[:8].upper()}",
                        payment_method_id=payment_method.id,
                        payment_method_version=payment_method.version,
                        status=gift_status,
                        handoff_payload_encrypted="test-handoff",
                        utr_encrypted=None,
                        donor_claimed_at=confirmed_at,
                        recipient_response_deadline=confirmed_at + timedelta(hours=1),
                        reaction=None,
                        thank_you_message=None,
                        created_at=confirmed_at - timedelta(minutes=10),
                        updated_at=confirmed_at,
                    )
                )
            db.commit()
    finally:
        engine.dispose()


def _insert_wish_only(
    *,
    user_id: str,
    status: WishStatus,
    expires_at: datetime,
    message: str,
) -> None:
    now = datetime.now(UTC)
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            db.add(
                Wish(
                    id=uuid.uuid4(),
                    user_id=UUID(user_id),
                    message=message,
                    mood=WishMood.JUST_BECAUSE,
                    suggested_amount_inr=25,
                    city="Bengaluru",
                    status=status,
                    expires_at=expires_at,
                    created_at=now - timedelta(hours=2),
                    updated_at=now,
                )
            )
            db.commit()
    finally:
        engine.dispose()


def test_public_stats_aggregates_confirmed_attestations_only(
    client: TestClient,
) -> None:
    donor_session, _, _ = _create_user(client, 1, "StatsDonor")
    recipient_session, _, _ = _create_user(client, 2, "StatsRecipient")
    now = datetime.now(UTC)
    week_start, _ = _current_week_bounds()
    donor_id = str(donor_session["user"]["id"])
    recipient_id = str(recipient_session["user"]["id"])

    _insert_gifts(
        donor_id=donor_id,
        recipient_id=recipient_id,
        rows=[
            {"confirmed_at": now, "amount": 20, "city": "Bengaluru"},
            {"confirmed_at": now, "amount": 30, "city": "Mysuru"},
            {"confirmed_at": now, "amount": 40, "city": "Mangaluru"},
            {"confirmed_at": now, "amount": 10, "city": "Bengaluru"},
            {"confirmed_at": now, "amount": 10, "city": None},
            {
                "confirmed_at": now,
                "amount": 50,
                "city": "Hubballi",
                "status": GiftStatus.DONOR_CLAIMED_PAID,
            },
            {
                "confirmed_at": week_start - timedelta(days=1),
                "amount": 60,
                "city": "Belagavi",
            },
        ],
    )

    response = client.get("/api/v1/public/stats")

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == _STATS_KEYS
    assert body["wishesSharedCount"] == 7
    assert body["memberCount"] == 2
    assert body["openWishCount"] == 0
    assert body["confirmedGiftCountAllTime"] == 6
    assert body["confirmedGiftValueInrAllTime"] == 170
    assert body["confirmedGiftCountThisWeek"] == 5
    assert body["confirmedGiftValueInrThisWeek"] == 110
    assert body["activeNeighbourhoodCountThisWeek"] == 3
    assert body["activeNeighbourhoods"] == []
    assert len(body["weeklyConfirmedGifts"]) == 7
    assert sum(day["count"] for day in body["weeklyConfirmedGifts"]) == 5
    assert sum(day["valueInr"] for day in body["weeklyConfirmedGifts"]) == 110
    assert body["communityStreakDays"] >= 1
    generated_at = datetime.fromisoformat(body["generatedAt"])
    assert generated_at.tzinfo is not None

    serialized = json.dumps(body).lower()
    for term in _FORBIDDEN_STATS_TERMS:
        assert term not in serialized


def test_area_labels_are_suppressed_below_three_confirmed_gifts(
    client: TestClient,
) -> None:
    donor_session, _, _ = _create_user(client, 50, "AreaDonor")
    recipient_session, _, _ = _create_user(client, 51, "AreaRecipient")
    now = datetime.now(UTC)
    donor_id = str(donor_session["user"]["id"])
    recipient_id = str(recipient_session["user"]["id"])

    _insert_gifts(
        donor_id=donor_id,
        recipient_id=recipient_id,
        rows=[
            {"confirmed_at": now, "amount": 10, "city": "Bengaluru"},
            {"confirmed_at": now, "amount": 20, "city": "Bengaluru"},
            {"confirmed_at": now, "amount": 30, "city": "Bengaluru"},
            {"confirmed_at": now, "amount": 40, "city": "Mysuru"},
            {"confirmed_at": now, "amount": 50, "city": "Mangaluru"},
        ],
    )

    response = client.get("/api/v1/public/stats")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["activeNeighbourhoodCountThisWeek"] == 3
    assert body["activeNeighbourhoods"] == [{"label": "bengaluru", "confirmedGiftCount": 3}]


def test_active_neighbourhood_count_is_suppressed_below_three(
    client: TestClient,
) -> None:
    donor_session, _, _ = _create_user(client, 10, "SuppressionDonor")
    recipient_session, _, _ = _create_user(client, 11, "SuppressionRecipient")
    now = datetime.now(UTC)
    donor_id = str(donor_session["user"]["id"])
    recipient_id = str(recipient_session["user"]["id"])

    _insert_gifts(
        donor_id=donor_id,
        recipient_id=recipient_id,
        rows=[
            {"confirmed_at": now, "amount": 20, "city": "Bengaluru"},
            {"confirmed_at": now, "amount": 30, "city": "Mysuru"},
        ],
    )

    below_threshold = client.get("/api/v1/public/stats")
    assert below_threshold.status_code == 200, below_threshold.text
    assert below_threshold.json()["confirmedGiftCountThisWeek"] == 2
    assert below_threshold.json()["activeNeighbourhoodCountThisWeek"] == 0

    _insert_gifts(
        donor_id=donor_id,
        recipient_id=recipient_id,
        rows=[{"confirmed_at": now, "amount": 40, "city": "Mangaluru"}],
    )

    at_threshold = client.get("/api/v1/public/stats")
    assert at_threshold.status_code == 200, at_threshold.text
    assert at_threshold.json()["confirmedGiftCountThisWeek"] == 3
    assert at_threshold.json()["activeNeighbourhoodCountThisWeek"] == 3


def test_week_boundary_uses_ist_iso_week(client: TestClient) -> None:
    donor_session, _, _ = _create_user(client, 20, "BoundaryDonor")
    recipient_session, _, _ = _create_user(client, 21, "BoundaryRecipient")
    week_start, week_end = _current_week_bounds()
    donor_id = str(donor_session["user"]["id"])
    recipient_id = str(recipient_session["user"]["id"])

    _insert_gifts(
        donor_id=donor_id,
        recipient_id=recipient_id,
        rows=[
            {"confirmed_at": week_start, "amount": 10, "city": "Bengaluru"},
            {
                "confirmed_at": week_end - timedelta(microseconds=1),
                "amount": 20,
                "city": "Mysuru",
            },
            {
                "confirmed_at": week_start - timedelta(microseconds=1),
                "amount": 30,
                "city": "Mangaluru",
            },
            {"confirmed_at": week_end, "amount": 40, "city": "Hubballi"},
        ],
    )

    response = client.get("/api/v1/public/stats")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["confirmedGiftCountThisWeek"] == 2
    assert body["confirmedGiftValueInrThisWeek"] == 30
    assert body["activeNeighbourhoodCountThisWeek"] == 0


def test_community_streak_uses_consecutive_ist_days(client: TestClient) -> None:
    donor_session, _, _ = _create_user(client, 30, "StreakDonor")
    recipient_session, _, _ = _create_user(client, 31, "StreakRecipient")
    now = datetime.now(UTC)
    donor_id = str(donor_session["user"]["id"])
    recipient_id = str(recipient_session["user"]["id"])

    _insert_gifts(
        donor_id=donor_id,
        recipient_id=recipient_id,
        rows=[
            {"confirmed_at": now, "amount": 10, "city": "Bengaluru"},
            {"confirmed_at": now - timedelta(days=1), "amount": 20, "city": "Mysuru"},
            {"confirmed_at": now - timedelta(days=2), "amount": 30, "city": "Mangaluru"},
            {"confirmed_at": now - timedelta(days=4), "amount": 40, "city": "Hubballi"},
        ],
    )

    response = client.get("/api/v1/public/stats")

    assert response.status_code == 200, response.text
    assert response.json()["communityStreakDays"] == 3


def test_open_wish_count_matches_publicly_visible_wishes(
    client: TestClient,
) -> None:
    _, headers_one, _ = _create_user(client, 40, "OpenWishOne")
    _create_wish(client, headers_one)
    _, headers_two, _ = _create_user(client, 41, "OpenWishTwo")
    _create_wish(client, headers_two)

    excluded_session, _, _ = _create_user(client, 42, "ExcludedOpenWish")
    excluded_user_id = str(excluded_session["user"]["id"])
    now = datetime.now(UTC)
    _insert_wish_only(
        user_id=excluded_user_id,
        status=WishStatus.UNDER_REVIEW,
        expires_at=now + timedelta(hours=24),
        message="A warm chai under review",
    )
    _insert_wish_only(
        user_id=excluded_user_id,
        status=WishStatus.REMOVED,
        expires_at=now + timedelta(hours=24),
        message="A warm chai that was removed",
    )
    _insert_wish_only(
        user_id=excluded_user_id,
        status=WishStatus.EXPIRED,
        expires_at=now - timedelta(hours=1),
        message="A warm chai that is already expired",
    )
    _insert_wish_only(
        user_id=excluded_user_id,
        status=WishStatus.OPEN,
        expires_at=now - timedelta(minutes=1),
        message="A warm chai past its open window",
    )

    response = client.get("/api/v1/public/stats")

    assert response.status_code == 200, response.text
    assert response.json()["openWishCount"] == 2
