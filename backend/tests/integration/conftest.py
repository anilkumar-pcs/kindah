from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "app" / "db" / "migrations"


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> None:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    command.upgrade(config, "head")


@pytest.fixture(autouse=True)
def clean_identity_tables(migrated_database: None) -> Iterator[None]:
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "TRUNCATE TABLE auth_events, user_sessions, otp_challenges, "
                    "outbox_events, idempotency_records, karma_events, gift_events, "
                    "wish_reservations, gifts, moderation_reports, user_blocks, wishes, "
                    "recipient_payment_methods, users RESTART IDENTITY CASCADE"
                )
            )
    finally:
        engine.dispose()
    yield
