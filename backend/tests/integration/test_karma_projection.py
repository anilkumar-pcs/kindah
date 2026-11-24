from __future__ import annotations

import os
from datetime import UTC, datetime
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, func, select
from sqlalchemy.orm import Session

from app.modules.karma.badges import BadgeDefinition
from app.modules.karma.models import UserBadge
from app.modules.karma.service import KarmaService, calculate_streak
from tests.integration.test_gifts import _confirm, _create_gift, _outcome, _setup


def test_profile_and_summary_project_ledger_and_badges(client: TestClient) -> None:
    donor_session, donor_headers, recipient_session, recipient_headers, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    assert _outcome(client, donor_headers, gift["giftId"], "PAID").status_code == 200

    before = client.get("/api/v1/me/karma", headers=donor_headers)
    assert before.status_code == 200
    assert before.json()["balance"] == 0

    assert _confirm(client, recipient_headers, gift["giftId"], "RECEIVED").status_code == 200

    donor_profile = client.get("/api/v1/me", headers=donor_headers).json()
    recipient_profile = client.get("/api/v1/me", headers=recipient_headers).json()
    assert donor_profile["karma"] == 30
    assert recipient_profile["karma"] == 3
    assert donor_profile["streak"] == 1

    donor_karma = client.get("/api/v1/me/karma", headers=donor_headers).json()
    assert donor_karma["balance"] == 30
    assert donor_karma["streak"] == 1
    assert {event["eventType"] for event in donor_karma["events"]} == {
        "FIRST_CONFIRMED_GIFT",
        "FIRST_TIME_RECIPIENT_BONUS",
    }
    first_badge = next(
        badge for badge in donor_karma["badges"] if badge["badgeCode"] == "FIRST_GIFT"
    )
    assert first_badge["label"] == "First gift"

    recipient_karma = client.get("/api/v1/me/karma", headers=recipient_headers).json()
    assert recipient_karma["balance"] == 3
    assert recipient_karma["events"][0]["eventType"] == "RECIPIENT_THANKS"
    assert [badge["badgeCode"] for badge in recipient_karma["badges"]] == ["GRATEFUL"]

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            service = KarmaService(db)
            service.award_badges(UUID(donor_session["user"]["id"]))
            service.award_badges(UUID(donor_session["user"]["id"]))
            db.commit()
            count = db.scalar(
                select(func.count(UserBadge.id)).where(
                    UserBadge.user_id == UUID(donor_session["user"]["id"])
                )
            )
            assert count == 1
    finally:
        engine.dispose()
    assert recipient_session["user"]["id"]


def test_badge_definitions_drive_awards_and_can_be_deactivated(client: TestClient) -> None:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            db.execute(
                delete(BadgeDefinition).where(
                    BadgeDefinition.code.in_(["TEST_ACTIVE", "TEST_INACTIVE"])
                )
            )
            db.add_all(
                [
                    BadgeDefinition(
                        code="TEST_ACTIVE",
                        label="Active test badge",
                        rule_type="CONFIRMED_SENT",
                        threshold=1,
                        active=True,
                        sort_order=900,
                    ),
                    BadgeDefinition(
                        code="TEST_INACTIVE",
                        label="Inactive test badge",
                        rule_type="CONFIRMED_SENT",
                        threshold=1,
                        active=False,
                        sort_order=901,
                    ),
                ]
            )
            db.commit()
    finally:
        engine.dispose()

    _, donor_headers, _, recipient_headers, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    assert _outcome(client, donor_headers, gift["giftId"], "PAID").status_code == 200
    assert _confirm(client, recipient_headers, gift["giftId"], "RECEIVED").status_code == 200
    badges = client.get("/api/v1/me/karma", headers=donor_headers).json()["badges"]
    codes = {badge["badgeCode"] for badge in badges}
    assert "TEST_ACTIVE" in codes
    assert "TEST_INACTIVE" not in codes


def test_streak_uses_ist_days_across_utc_midnight() -> None:
    # UTC 18:45 and 20:00 on 2026-11-24 are both IST 2026-11-25.
    same_ist_day = [
        datetime(2026, 11, 24, 18, 45, tzinfo=UTC),
        datetime(2026, 11, 24, 20, 0, tzinfo=UTC),
    ]
    now = datetime(2026, 11, 24, 19, 0, tzinfo=UTC)
    assert calculate_streak(same_ist_day, now) == 1

    consecutive = [
        datetime(2026, 11, 24, 19, 0, tzinfo=UTC),  # IST Nov 25
        datetime(2026, 11, 23, 19, 0, tzinfo=UTC),  # IST Nov 24
        datetime(2026, 11, 22, 19, 0, tzinfo=UTC),  # IST Nov 23
    ]
    assert calculate_streak(consecutive, now) == 3
    assert calculate_streak([consecutive[1]], now) == 1
    assert calculate_streak([], now) == 0
