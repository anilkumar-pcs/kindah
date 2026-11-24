"""payment methods and wishes

Revision ID: 0003_payment_wishes
Revises: 0002_identity
Create Date: 2026-11-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_payment_wishes"
down_revision: str | None = "0002_identity"
branch_labels: str | None = None
depends_on: str | None = None

_PAYMENT_METHOD_STATUS = ("ACTIVE", "INACTIVE")
_VPA_VALIDATION_STATUS = ("SYNTAX_ONLY", "PROVIDER_VALIDATED")
_WISH_MOOD = ("CHAI_SNACK", "JUST_BECAUSE", "LONG_DAY", "TINY_TREAT")
_WISH_STATUS = (
    "OPEN",
    "LOCKED",
    "PAYMENT_CLAIMED",
    "GRANTED",
    "UNVERIFIED",
    "DISPUTED",
    "EXPIRED",
    "UNDER_REVIEW",
    "REMOVED",
)


def upgrade() -> None:
    bind = op.get_bind()
    payment_status = postgresql.ENUM(
        *_PAYMENT_METHOD_STATUS,
        name="payment_method_status",
        create_type=False,
    )
    vpa_status = postgresql.ENUM(
        *_VPA_VALIDATION_STATUS,
        name="vpa_validation_status",
        create_type=False,
    )
    wish_mood = postgresql.ENUM(*_WISH_MOOD, name="wish_mood", create_type=False)
    wish_status = postgresql.ENUM(*_WISH_STATUS, name="wish_status", create_type=False)

    for enum in (payment_status, vpa_status, wish_mood, wish_status):
        enum.create(bind, checkfirst=True)

    op.add_column(
        "users",
        sa.Column("last_authenticated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE users SET last_authenticated_at = COALESCE(phone_verified_at, now())")
    op.alter_column("users", "last_authenticated_at", nullable=False)

    op.create_table(
        "recipient_payment_methods",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("encrypted_vpa", sa.Text(), nullable=False),
        sa.Column("vpa_hmac", sa.String(length=64), nullable=False),
        sa.Column("masked_vpa", sa.String(length=80), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "status",
            payment_status,
            server_default=sa.text("'ACTIVE'"),
            nullable=False,
        ),
        sa.Column(
            "validation_status",
            vpa_status,
            server_default=sa.text("'SYNTAX_ONLY'"),
            nullable=False,
        ),
        sa.Column("privacy_ack_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.CheckConstraint("version >= 1", name="ck_payment_methods_version"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_payment_methods_user",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_recipient_payment_methods"),
        sa.UniqueConstraint("user_id", name="uq_payment_methods_user"),
        sa.UniqueConstraint("vpa_hmac", name="uq_payment_methods_vpa_hmac"),
    )

    op.create_table(
        "wishes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message", sa.String(length=120), nullable=False),
        sa.Column("mood", wish_mood, nullable=False),
        sa.Column("suggested_amount_inr", sa.Integer(), nullable=True),
        sa.Column("city", sa.String(length=60), nullable=True),
        sa.Column(
            "status",
            wish_status,
            server_default=sa.text("'OPEN'"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_reason", sa.String(length=32), nullable=True),
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
        sa.CheckConstraint(
            "char_length(message) BETWEEN 10 AND 120",
            name="ck_wishes_message",
        ),
        sa.CheckConstraint(
            "suggested_amount_inr IS NULL OR suggested_amount_inr BETWEEN 10 AND 100",
            name="ck_wishes_amount",
        ),
        sa.CheckConstraint("expires_at > created_at", name="ck_wishes_expiry"),
        sa.CheckConstraint(
            "city IS NULL OR char_length(city) BETWEEN 2 AND 60",
            name="ck_wishes_city",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_wishes_user",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_wishes"),
    )
    op.create_index(
        "uq_wishes_one_active_per_user",
        "wishes",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('OPEN', 'LOCKED')"),
    )
    op.create_index("ix_wishes_status_expires", "wishes", ["status", "expires_at"])
    op.create_index("ix_wishes_created_at", "wishes", ["created_at"])


def downgrade() -> None:
    op.drop_table("wishes")
    op.drop_table("recipient_payment_methods")
    op.drop_column("users", "last_authenticated_at")

    bind = op.get_bind()
    for name in (
        "wish_status",
        "wish_mood",
        "vpa_validation_status",
        "payment_method_status",
    ):
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)
