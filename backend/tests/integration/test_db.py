from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.config import Settings
from app.core.db import Database

pytestmark = pytest.mark.integration


def test_database_check(settings: Settings) -> None:
    database = Database(settings.database_url, connect_timeout_seconds=2)
    try:
        database.check()
    finally:
        database.dispose()


def test_session_rolls_back_after_failure(settings: Settings) -> None:
    database = Database(settings.database_url, connect_timeout_seconds=2)
    session = database.session()
    try:
        session.execute(text("SELECT 1"))
        with pytest.raises(DBAPIError):
            session.execute(text("SELECT 1 / 0"))
        session.rollback()
    finally:
        session.close()

    try:
        with database.session() as fresh_session:
            assert fresh_session.execute(text("SELECT 1")).scalar_one() == 1
    finally:
        database.dispose()
