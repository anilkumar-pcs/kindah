from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import Settings

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "app" / "db" / "migrations"


def test_upgrade_downgrade_upgrade(settings: Settings) -> None:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))

    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")
