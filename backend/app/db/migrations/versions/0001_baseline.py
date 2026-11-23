"""baseline: migration infrastructure only

Revision ID: 0001_baseline
Revises:
Create Date: 2026-11-23

Domain tables are added by their owning phases. This baseline proves the
migration chain and keeps the schema version explicit from day one.
"""

from __future__ import annotations

revision: str = "0001_baseline"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
