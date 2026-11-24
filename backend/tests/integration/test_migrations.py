from __future__ import annotations

import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "app" / "db" / "migrations"
MIGRATION_DB_NAME = "kindah_migration_test"


def _migration_url() -> str:
    base = make_url(os.environ["DATABASE_URL"])
    return str(base.set(database=MIGRATION_DB_NAME))


def _ensure_database() -> None:
    base = make_url(os.environ["DATABASE_URL"])
    admin_url = base.set(database="postgres")
    engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with engine.connect() as connection:
            exists = connection.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": MIGRATION_DB_NAME},
            ).scalar()
            if not exists:
                connection.execute(text(f'CREATE DATABASE "{MIGRATION_DB_NAME}"'))
    finally:
        engine.dispose()


def test_upgrade_downgrade_upgrade() -> None:
    _ensure_database()

    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    config.attributes["database_url"] = _migration_url()

    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")
