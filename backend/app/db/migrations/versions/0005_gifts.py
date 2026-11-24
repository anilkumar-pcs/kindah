"""gift reservations, handoff, events and idempotency

Revision ID: 0005_gifts
Revises: 0004_discovery
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_gifts"
down_revision: str | None = "0004_discovery"
branch_labels: str | None = None
depends_on: str | None = None

_GIFT_STATUS = (
    "CREATED",
    "HANDOFF_ISSUED",
    "DONOR_PENDING",
    "DONOR_CLAIMED_PAID",
    "RECIPIENT_CONFIRMED",
    "UNVERIFIED",
    "DISPUTED",
    "FAILED",
    "ABANDONED",
    "CANCELLED",
)
_RESERVATION_STATUS = ("ACTIVE", "RELEASED", "EXPIRED", "CONSUMED")


def upgrade() -> None:
    bind = op.get_bind()
    gift_status = postgresql.ENUM(*_GIFT_STATUS, name="gift_status", create_type=False)
    reservation_status = postgresql.ENUM(
        *_RESERVATION_STATUS, name="reservation_status", create_type=False
    )
    gift_status.create(bind, checkfirst=True)
    reservation_status.create(bind, checkfirst=True)

    op.create_table(
        "gifts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("wish_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("donor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount_inr", sa.Integer(), nullable=False),
        sa.Column("cheer_note", sa.String(length=80), nullable=True),
        sa.Column("payment_ref", sa.String(length=24), nullable=False),
        sa.Column("payment_method_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_method_version", sa.Integer(), nullable=False),
        sa.Column("status", gift_status, server_default=sa.text("'CREATED'"), nullable=False),
        sa.Column("handoff_payload_encrypted", sa.Text(), nullable=False),
        sa.Column("utr_encrypted", sa.Text(), nullable=True),
        sa.Column("donor_claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recipient_response_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reaction", sa.String(length=16), nullable=True),
        sa.Column("thank_you_message", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount_inr BETWEEN 10 AND 100", name="ck_gifts_amount"),
        sa.ForeignKeyConstraint(
            ["wish_id"], ["wishes.id"], name="fk_gifts_wish", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["donor_id"], ["users.id"], name="fk_gifts_donor", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["recipient_id"], ["users.id"], name="fk_gifts_recipient", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["payment_method_id"],
            ["recipient_payment_methods.id"],
            name="fk_gifts_payment_method",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_gifts"),
        sa.UniqueConstraint("payment_ref", name="uq_gifts_payment_ref"),
    )
    op.create_index("ix_gifts_donor_created", "gifts", ["donor_id", "created_at"])
    op.create_index("ix_gifts_recipient_created", "gifts", ["recipient_id", "created_at"])
    op.create_index("ix_gifts_status", "gifts", ["status"])

    op.create_table(
        "wish_reservations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("wish_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("donor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gift_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", reservation_status, server_default=sa.text("'ACTIVE'"), nullable=False),
        sa.Column("reserved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("extension_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("release_reason", sa.String(length=32), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("extension_count BETWEEN 0 AND 1", name="ck_reservations_extension"),
        sa.CheckConstraint("expires_at > reserved_at", name="ck_reservations_expiry"),
        sa.ForeignKeyConstraint(
            ["wish_id"], ["wishes.id"], name="fk_reservations_wish", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["donor_id"], ["users.id"], name="fk_reservations_donor", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["gift_id"], ["gifts.id"], name="fk_reservations_gift", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_wish_reservations"),
        sa.UniqueConstraint("gift_id", name="uq_reservations_gift"),
    )
    op.create_index(
        "uq_reservations_active_wish",
        "wish_reservations",
        ["wish_id"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.create_index("ix_reservations_wish_status", "wish_reservations", ["wish_id", "status"])

    op.create_table(
        "gift_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("gift_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=48), nullable=False),
        sa.Column("from_state", sa.String(length=32), nullable=True),
        sa.Column("to_state", sa.String(length=32), nullable=True),
        sa.Column(
            "metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False
        ),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["gift_id"], ["gifts.id"], name="fk_gift_events_gift", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name="fk_gift_events_actor", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_gift_events"),
        sa.UniqueConstraint("idempotency_key", name="uq_gift_events_idempotency_key"),
    )

    op.create_table(
        "karma_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gift_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=48), nullable=False),
        sa.Column("points_delta", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_karma_events_user", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["gift_id"], ["gifts.id"], name="fk_karma_events_gift", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_karma_events"),
        sa.UniqueConstraint("idempotency_key", name="uq_karma_events_idempotency_key"),
    )

    op.create_table(
        "idempotency_records",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("endpoint", sa.String(length=120), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=False),
        sa.Column("response_body", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name="fk_idempotency_actor", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_idempotency_records"),
        sa.UniqueConstraint(
            "actor_id", "endpoint", "idempotency_key", name="uq_idempotency_actor_endpoint_key"
        ),
    )

    op.create_table(
        "outbox_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("aggregate_type", sa.String(length=32), nullable=False),
        sa.Column("aggregate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=48), nullable=False),
        sa.Column(
            "payload", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False
        ),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dead_letter_reason", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_outbox_events"),
        sa.UniqueConstraint("idempotency_key", name="uq_outbox_events_idempotency_key"),
    )
    op.create_index("ix_outbox_pending", "outbox_events", ["processed_at", "next_attempt_at"])


def downgrade() -> None:
    op.drop_table("outbox_events")
    op.drop_table("idempotency_records")
    op.drop_table("karma_events")
    op.drop_table("gift_events")
    op.drop_table("wish_reservations")
    op.drop_table("gifts")
    bind = op.get_bind()
    for name in ("reservation_status", "gift_status"):
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)
