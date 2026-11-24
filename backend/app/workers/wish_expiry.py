from __future__ import annotations

import argparse
import logging
import time
from datetime import datetime

from app.core.config import Settings, get_settings
from app.core.db import Database
from app.core.logging import configure_logging
from app.modules.wishes.service import expire_due_wishes

logger = logging.getLogger("kindly.workers.wish_expiry")


def run_once(
    settings: Settings | None = None,
    now: datetime | None = None,
) -> int:
    resolved = settings or get_settings()
    database = Database(
        resolved.database_url,
        resolved.db_connect_timeout_seconds,
    )
    try:
        with database.session() as session:
            return expire_due_wishes(
                session=session,
                settings=resolved,
                now=now,
            )
    finally:
        database.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Expire due Kindly wishes")
    parser.add_argument("--loop", action="store_true", help="run every interval")
    parser.add_argument("--interval", type=int, default=60, help="seconds between runs")
    args = parser.parse_args()

    settings = get_settings()
    configure_logging(settings.log_level)

    while True:
        expired = run_once(settings)
        logger.info("wish_expiry_run", extra={"expired_count": expired})
        if not args.loop:
            break
        time.sleep(max(5, args.interval))


if __name__ == "__main__":
    main()
