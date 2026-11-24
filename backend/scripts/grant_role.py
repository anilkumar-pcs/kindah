"""Bootstrap or repair a user's database role.

Usage:
    cd backend
    uv run python -m scripts.grant_role --phone 9876543210 --role ADMIN
    uv run python -m scripts.grant_role --display-name ChaiLover --role ADMIN
    uv run python -m scripts.grant_role --user-id <uuid> --role MODERATOR

The phone is normalized and looked up by HMAC only; it is never printed.
"""

from __future__ import annotations

import argparse
import sys
from uuid import UUID

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.db import Database
from app.core.security import hmac_sha256_hex, normalize_indian_mobile
from app.modules.identity.models import User, UserRole


def main() -> int:
    parser = argparse.ArgumentParser(description="Set a user's database role")
    identity = parser.add_mutually_exclusive_group(required=True)
    identity.add_argument("--phone", help="Indian mobile number used to sign in")
    identity.add_argument("--display-name", help="Public pseudonym")
    identity.add_argument("--user-id", help="User UUID")
    parser.add_argument(
        "--role",
        choices=[role.value for role in UserRole],
        default=UserRole.ADMIN.value,
    )
    args = parser.parse_args()

    settings = get_settings()
    database = Database(settings.database_url, settings.db_connect_timeout_seconds)
    try:
        with database.session() as session:
            if args.phone:
                phone = normalize_indian_mobile(args.phone)
                mobile_hmac = hmac_sha256_hex(
                    settings.lookup_hmac_key.get_secret_value(),
                    phone,
                )
                user = session.scalar(select(User).where(User.mobile_hmac == mobile_hmac))
            elif args.display_name:
                user = session.scalar(
                    select(User).where(
                        func.lower(User.display_name) == args.display_name.strip().lower()
                    )
                )
            else:
                user = session.get(User, UUID(args.user_id))
            if user is None:
                print("No matching user found.", file=sys.stderr)
                return 1
            user.role = UserRole(args.role)
            session.commit()
            print(f"Updated {user.display_name or user.id}: role={user.role.value}")
    finally:
        database.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
