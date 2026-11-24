from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.notifications.models import Notification
from app.modules.wishes.models import Wish
from app.modules.wishes.service import expire_due_wishes
from tests.integration.helpers import complete_setup
from tests.integration.test_discovery import _create_wish
from tests.integration.test_gifts import _confirm, _create_gift, _outcome, _setup


def test_gift_notifications_are_safe_deduplicated_and_readable(client: TestClient) -> None:
    _, donor_headers, _, recipient_headers, wish = _setup(client)
    gift = _create_gift(client, donor_headers, wish["id"]).json()
    paid = _outcome(client, donor_headers, gift["giftId"], "PAID")
    assert paid.status_code == 200

    recipient_inbox = client.get("/api/v1/me/notifications", headers=recipient_headers)
    assert recipient_inbox.status_code == 200
    data = recipient_inbox.json()
    assert data["unreadCount"] == 1
    assert len(data["notifications"]) == 1
    notification = data["notifications"][0]
    assert notification["notificationType"] == "GIFT_CLAIMED"
    assert notification["entityId"] == gift["giftId"]
    serialized = str(notification)
    assert "upi://" not in serialized
    assert "utr" not in serialized.lower()
    assert "9876500" not in serialized

    assert _confirm(client, recipient_headers, gift["giftId"], "RECEIVED").status_code == 200
    donor_inbox = client.get("/api/v1/me/notifications", headers=donor_headers).json()
    assert [item["notificationType"] for item in donor_inbox["notifications"]] == ["GIFT_CONFIRMED"]

    marked = client.post(
        f"/api/v1/me/notifications/{notification['id']}/read",
        headers=recipient_headers,
    )
    assert marked.status_code == 200
    assert marked.json()["readAt"] is not None
    assert (
        client.get("/api/v1/me/notifications", headers=recipient_headers).json()["unreadCount"] == 0
    )
    assert (
        client.post(
            "/api/v1/me/notifications/read-all",
            headers=donor_headers,
        ).json()["marked"]
        == 1
    )


def test_wish_expiry_notifies_owner(client: TestClient, settings: Settings) -> None:
    _, headers, _ = complete_setup(
        client,
        phone="9876503101",
        display_name="ExpiryNotify",
        vpa="expirynotify@okhdfc",
    )
    wish = _create_wish(client, headers)
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            row = db.get(Wish, UUID(wish["id"]))
            assert row is not None
            row.created_at = datetime.now(UTC) - timedelta(hours=25)
            row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
            db.commit()
        with Session(engine) as db:
            assert expire_due_wishes(session=db, settings=settings) == 1
    finally:
        engine.dispose()

    inbox = client.get("/api/v1/me/notifications", headers=headers).json()
    assert any(item["notificationType"] == "WISH_EXPIRED" for item in inbox["notifications"])


def test_notify_is_deduplicated_by_key(client: TestClient) -> None:
    _, headers, _, _, _ = _setup(client)
    user_id = UUID(client.get("/api/v1/me", headers=headers).json()["id"])
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            from app.modules.notifications.service import notify

            for _ in range(2):
                notify(
                    session=db,
                    user_id=user_id,
                    dedupe_key="test:dedupe:once",
                    notification_type="TEST",
                    title="Only once",
                    body="This should be inserted once.",
                )
            db.commit()
            count = db.scalar(
                select(func.count(Notification.id)).where(
                    Notification.user_id == user_id,
                    Notification.dedupe_key == "test:dedupe:once",
                )
            )
            assert count == 1
    finally:
        engine.dispose()
