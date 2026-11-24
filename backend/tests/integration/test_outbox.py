from __future__ import annotations

import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.gifts.models import OutboxEvent
from app.modules.identity.models import User, UserRole
from app.workers.outbox_dispatcher import count_dead_letters, dispatch_outbox
from tests.integration.helpers import admin_mfa_headers, complete_setup

pytestmark = pytest.mark.integration


def _event(
    *,
    event_type: str = "DONOR_CLAIMED_PAID",
    key: str | None = None,
) -> UUID:
    event = OutboxEvent(
        id=uuid.uuid4(),
        aggregate_type="gift",
        aggregate_id=uuid.uuid4(),
        event_type=event_type,
        payload={"giftId": str(uuid.uuid4())},
        idempotency_key=key or f"test:{uuid.uuid4()}",
        created_at=datetime.now(UTC),
    )
    event_id = event.id
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            db.add(event)
            db.commit()
    finally:
        engine.dispose()
    return event_id


def _load(event_id: UUID) -> SimpleNamespace:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            row = db.get(OutboxEvent, event_id)
            assert row is not None
            return SimpleNamespace(
                event_type=row.event_type,
                processed_at=row.processed_at,
                attempts=row.attempts,
                next_attempt_at=row.next_attempt_at,
                dead_letter_reason=row.dead_letter_reason,
            )
    finally:
        engine.dispose()


def test_successful_dispatch_is_idempotent(settings: Settings) -> None:
    event_id = _event()
    calls: list[str] = []

    def handler(row: OutboxEvent) -> None:
        calls.append(str(row.id))

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert dispatch_outbox(session=db, settings=settings, handler=handler) == (1, 0)
        with Session(engine) as db:
            assert dispatch_outbox(session=db, settings=settings, handler=handler) == (0, 0)
    finally:
        engine.dispose()

    row = _load(event_id)
    assert row.processed_at is not None
    assert row.attempts == 1
    assert calls == [str(event_id)]


def test_failure_retries_then_dead_letters(settings: Settings) -> None:
    event_id = _event()
    retrying = settings.model_copy(
        update={"outbox_max_attempts": 2, "outbox_retry_base_seconds": 10}
    )
    alerts: list[UUID] = []

    def failing(row: OutboxEvent) -> None:
        raise RuntimeError("provider unavailable")

    now = datetime.now(UTC)
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            assert dispatch_outbox(
                session=db,
                settings=retrying,
                now=now,
                handler=failing,
                on_dead_letter=lambda row: alerts.append(row.id),
            ) == (0, 0)
        row = _load(event_id)
        assert row.processed_at is None
        assert row.attempts == 1
        assert row.next_attempt_at is not None
        assert row.next_attempt_at > now
        assert row.dead_letter_reason is None

        with Session(engine) as db:
            assert dispatch_outbox(
                session=db,
                settings=retrying,
                now=now + timedelta(seconds=11),
                handler=failing,
                on_dead_letter=lambda row: alerts.append(row.id),
            ) == (0, 1)
        row = _load(event_id)
        assert row.dead_letter_reason == "RuntimeError"
        assert row.next_attempt_at is None
        assert alerts == [event_id]

        with Session(engine) as db:
            assert count_dead_letters(db) == 1
            assert dispatch_outbox(
                session=db,
                settings=retrying,
                now=now + timedelta(days=1),
                handler=failing,
            ) == (0, 0)
    finally:
        engine.dispose()


def test_skip_locked_allows_only_one_dispatcher_to_claim(settings: Settings) -> None:
    _event()
    barrier = Barrier(2)

    def worker() -> int:
        engine = create_engine(os.environ["DATABASE_URL"])
        try:
            with Session(engine) as db:
                barrier.wait()
                processed, _ = dispatch_outbox(
                    session=db,
                    settings=settings,
                    handler=lambda row: time.sleep(0.2),
                )
                return processed
        finally:
            engine.dispose()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [pool.submit(worker), pool.submit(worker)]
        processed_total = sum(future.result() for future in results)
    assert processed_total == 1


def test_admin_can_see_dead_letters(client: TestClient) -> None:
    failed_id = _event(event_type="UNKNOWN_EVENT_TYPE")
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            row = db.get(OutboxEvent, failed_id)
            assert row is not None
            row.attempts = 99
            row.dead_letter_reason = "UnknownOutboxEvent"
            db.commit()
    finally:
        engine.dispose()

    session, headers, _ = complete_setup(
        client,
        phone="9876504001",
        display_name="OutboxAdmin",
        vpa="outboxadmin@okhdfc",
    )
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with Session(engine) as db:
            user = db.get(User, UUID(session["user"]["id"]))
            assert user is not None
            user.role = UserRole.ADMIN
            db.commit()
    finally:
        engine.dispose()
    headers = admin_mfa_headers(client, headers)

    response = client.get("/api/v1/admin/outbox/dead-letters", headers=headers)
    assert response.status_code == 200, response.text
    ids = [item["id"] for item in response.json()["deadLetters"]]
    assert str(failed_id) in ids
    assert "UNKNOWN_EVENT_TYPE" in str(response.json())
    without_mfa = {key: value for key, value in headers.items() if key != "X-Admin-MFA"}
    assert client.get("/api/v1/admin/outbox/dead-letters", headers=without_mfa).status_code == 403
