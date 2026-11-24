from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from sqlalchemy import String, and_, exists, func, or_, select, tuple_
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.modules.discovery.pagination import (
    decode_fresh_cursor,
    decode_random_cursor,
    encode_fresh_cursor,
    encode_random_cursor,
)
from app.modules.discovery.schemas import FeedResponse, PublicWish
from app.modules.identity.models import User, UserStatus
from app.modules.payment_methods.models import (
    PaymentMethodStatus,
    RecipientPaymentMethod,
)
from app.modules.safety.models import UserBlock
from app.modules.wishes.models import Wish, WishStatus

SortOrder = Literal["fresh", "random"]


class DiscoveryService:
    def __init__(self, *, settings: Settings, session: Session) -> None:
        self.settings = settings
        self.session = session

    def feed(
        self,
        *,
        viewer_id: UUID | None,
        city: str | None,
        sort: SortOrder,
        cursor: str | None,
        limit: int,
        seed: str | None,
    ) -> FeedResponse:
        now = datetime.now(UTC)
        resolved_seed = seed or secrets.token_hex(8) if sort == "random" else None
        if sort == "random" and resolved_seed is None:
            resolved_seed = secrets.token_hex(8)

        statement = (
            select(Wish, User)
            .join(User, Wish.user_id == User.id)
            .join(
                RecipientPaymentMethod,
                and_(
                    RecipientPaymentMethod.user_id == User.id,
                    RecipientPaymentMethod.status == PaymentMethodStatus.ACTIVE,
                ),
            )
        )
        conditions = [
            Wish.status == WishStatus.OPEN,
            Wish.expires_at > now,
            User.status == UserStatus.ACTIVE,
            User.display_name.is_not(None),
            User.avatar.is_not(None),
        ]
        if city and city.strip():
            conditions.append(func.lower(Wish.city) == city.strip().lower())
        if viewer_id is not None:
            conditions.append(Wish.user_id != viewer_id)
            conditions.append(
                ~exists().where(
                    UserBlock.blocker_id == viewer_id,
                    UserBlock.blocked_id == Wish.user_id,
                )
            )
            conditions.append(
                ~exists().where(
                    UserBlock.blocker_id == Wish.user_id,
                    UserBlock.blocked_id == viewer_id,
                )
            )

        next_cursor: str | None = None

        if sort == "fresh":
            if cursor:
                fresh = decode_fresh_cursor(cursor)
                conditions.append(
                    tuple_(Wish.created_at, Wish.id) < tuple_(fresh.created_at, fresh.wish_id)
                )
            statement = (
                statement.where(*conditions)
                .order_by(Wish.created_at.desc(), Wish.id.desc())
                .limit(limit + 1)
            )
        else:
            assert resolved_seed is not None
            hash_expression = func.md5(func.concat(Wish.id.cast(String), resolved_seed))
            if cursor:
                random_cursor = decode_random_cursor(cursor)
                if random_cursor.seed != resolved_seed:
                    raise AppError(
                        400,
                        "VALIDATION_ERROR",
                        "Invalid cursor",
                        "The cursor seed does not match the requested order.",
                    )
                conditions.append(
                    or_(
                        hash_expression > random_cursor.hash_value,
                        and_(
                            hash_expression == random_cursor.hash_value,
                            Wish.id > random_cursor.wish_id,
                        ),
                    )
                )
            statement = (
                statement.where(*conditions)
                .order_by(hash_expression.asc(), Wish.id.asc())
                .limit(limit + 1)
            )

        rows = list(self.session.execute(statement).all())
        has_more = len(rows) > limit
        visible = rows[:limit]
        wishes = [self._card(wish, user) for wish, user in visible]

        if has_more and visible:
            last_wish = visible[-1][0]
            if sort == "fresh":
                next_cursor = encode_fresh_cursor(last_wish.created_at, last_wish.id)
            else:
                assert resolved_seed is not None
                digest = hashlib.md5(f"{last_wish.id}{resolved_seed}".encode()).hexdigest()
                next_cursor = encode_random_cursor(
                    digest,
                    last_wish.id,
                    resolved_seed,
                )

        return FeedResponse(
            wishes=wishes,
            next_cursor=next_cursor,
            seed=resolved_seed if sort == "random" else None,
        )

    def get_public(self, wish_id: UUID, viewer_id: UUID | None) -> PublicWish:
        wish, user = self._load(wish_id)
        if wish is None or user is None:
            raise self._not_found()
        if not self._eligible(wish, user, viewer_id):
            raise self._not_found()
        return self._card(wish, user)

    def select(self, wish_id: UUID, viewer_id: UUID) -> PublicWish:
        wish, user = self._load(wish_id)
        if wish is None or user is None:
            raise self._not_found()
        if wish.user_id == viewer_id or not self._eligible(wish, user, viewer_id):
            raise AppError(
                409,
                "WISH_UNAVAILABLE",
                "Wish unavailable",
                "This wish is no longer available for selection.",
            )
        return self._card(wish, user)

    def _load(self, wish_id: UUID) -> tuple[Wish | None, User | None]:
        row = self.session.execute(
            select(Wish, User).join(User, Wish.user_id == User.id).where(Wish.id == wish_id)
        ).first()
        if row is None:
            return None, None
        return row[0], row[1]

    def _eligible(self, wish: Wish, user: User, viewer_id: UUID | None) -> bool:
        now = datetime.now(UTC)
        if wish.status != WishStatus.OPEN or wish.expires_at <= now:
            return False
        if user.status != UserStatus.ACTIVE:
            return False
        if not user.display_name or not user.avatar:
            return False
        if viewer_id is not None and wish.user_id == viewer_id:
            return False
        payment_method = self.session.scalar(
            select(RecipientPaymentMethod.id).where(
                RecipientPaymentMethod.user_id == user.id,
                RecipientPaymentMethod.status == PaymentMethodStatus.ACTIVE,
            )
        )
        if payment_method is None:
            return False
        if viewer_id is not None:
            blocked = self.session.scalar(
                select(UserBlock.blocker_id).where(
                    or_(
                        and_(
                            UserBlock.blocker_id == viewer_id,
                            UserBlock.blocked_id == user.id,
                        ),
                        and_(
                            UserBlock.blocker_id == user.id,
                            UserBlock.blocked_id == viewer_id,
                        ),
                    )
                )
            )
            if blocked is not None:
                return False
        return True

    def _card(self, wish: Wish, user: User) -> PublicWish:
        return PublicWish(
            id=wish.id,
            display_name=user.display_name or "Kindly user",
            avatar=user.avatar or "SPARK",
            city=wish.city or user.city,
            created_at=wish.created_at,
            mood=wish.mood,
            message=wish.message,
            suggested_amount_inr=wish.suggested_amount_inr,
        )

    @staticmethod
    def _not_found() -> AppError:
        return AppError(
            404,
            "NOT_FOUND",
            "Wish not found",
            "This wish is unavailable or no longer visible.",
        )
