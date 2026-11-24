from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.modules.identity.audit import record_audit_event
from app.modules.identity.models import User
from app.modules.notifications.service import notify
from app.modules.payment_methods.models import (
    PaymentMethodStatus,
    RecipientPaymentMethod,
)
from app.modules.wishes.models import Wish, WishMood, WishStatus
from app.modules.wishes.schemas import WishCreateRequest, WishResponse

_URL_RE = re.compile(r"(?:https?://|www\.)", re.IGNORECASE)
_HTML_RE = re.compile(r"[<>]")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)")
_VPA_RE = re.compile(r"[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9]{1,30}")
_UPI_RE = re.compile(r"upi://", re.IGNORECASE)
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_CITY_RE = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,59}$")


class WishService:
    def __init__(self, *, settings: Settings, session: Session) -> None:
        self.settings = settings
        self.session = session

    def create(self, user: User, request: WishCreateRequest) -> Wish:
        now = datetime.now(UTC)
        self._require_onboarded(user)

        payment_method = self.session.scalar(
            select(RecipientPaymentMethod.id).where(
                RecipientPaymentMethod.user_id == user.id,
                RecipientPaymentMethod.status == PaymentMethodStatus.ACTIVE,
            )
        )
        if payment_method is None:
            raise AppError(
                403,
                "PAYMENT_METHOD_REQUIRED",
                "Payment method required",
                "Add a UPI ID before publishing a wish.",
            )

        message = request.message.strip()
        self._validate_message(message)
        city = self._validate_city(request.city)

        cooldown = self.session.scalar(
            select(func.max(Wish.cooldown_until)).where(
                Wish.user_id == user.id,
                Wish.cooldown_until > now,
            )
        )
        if cooldown is not None:
            raise AppError(
                409,
                "COOLDOWN_ACTIVE",
                "Cooldown active",
                f"You can publish another wish after {cooldown.isoformat()}.",
            )

        active_wish = self.session.scalar(
            select(Wish.id).where(
                Wish.user_id == user.id,
                Wish.status.in_([WishStatus.OPEN, WishStatus.LOCKED]),
            )
        )
        if active_wish is not None:
            raise AppError(
                409,
                "WISH_ALREADY_ACTIVE",
                "Wish already active",
                "You can have one active wish at a time.",
            )

        wish = Wish(
            id=uuid.uuid4(),
            user_id=user.id,
            message=message,
            mood=WishMood(request.mood),
            suggested_amount_inr=request.suggested_amount_inr,
            city=city,
            status=WishStatus.OPEN,
            expires_at=now + timedelta(hours=self.settings.wish_lifetime_hours),
            created_at=now,
            updated_at=now,
        )
        self.session.add(wish)
        record_audit_event(
            session=self.session,
            event_type="WISH_CREATED",
            user_id=user.id,
            metadata={
                "wishId": str(wish.id),
                "mood": request.mood,
                "hasSuggestedAmount": request.suggested_amount_inr is not None,
                "hasCity": city is not None,
            },
        )
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise AppError(
                409,
                "WISH_ALREADY_ACTIVE",
                "Wish already active",
                "You can have one active wish at a time.",
            ) from exc
        return wish

    def withdraw(self, user: User, wish_id: UUID) -> Wish:
        now = datetime.now(UTC)
        wish = self.session.scalar(
            select(Wish).where(Wish.id == wish_id, Wish.user_id == user.id).with_for_update()
        )
        if wish is None:
            raise AppError(404, "NOT_FOUND", "Wish not found", "This wish is not available.")
        if wish.status != WishStatus.OPEN:
            raise AppError(
                422,
                "INVALID_STATE_TRANSITION",
                "Wish cannot be withdrawn",
                "Only an open wish can be withdrawn.",
            )

        wish.status = WishStatus.EXPIRED
        wish.closed_reason = "WITHDRAWN"
        wish.cooldown_until = now + timedelta(hours=self.settings.wish_cooldown_hours)
        wish.updated_at = now
        record_audit_event(
            session=self.session,
            event_type="WISH_WITHDRAWN",
            user_id=user.id,
            metadata={"wishId": str(wish.id)},
        )
        self.session.commit()
        return wish

    def list_for_user(self, user: User) -> list[Wish]:
        return list(
            self.session.scalars(
                select(Wish)
                .where(Wish.user_id == user.id)
                .order_by(Wish.created_at.desc())
                .limit(100)
            )
        )

    def response(self, wish: Wish) -> WishResponse:
        return WishResponse(
            id=wish.id,
            message=wish.message,
            mood=wish.mood,
            suggested_amount_inr=wish.suggested_amount_inr,
            city=wish.city,
            status=wish.status,
            expires_at=wish.expires_at,
            cooldown_until=wish.cooldown_until,
            closed_reason=wish.closed_reason,
            created_at=wish.created_at,
        )

    def _require_onboarded(self, user: User) -> None:
        if any(
            value is None
            for value in (
                user.display_name,
                user.avatar,
                user.age_confirmed_at,
                user.terms_accepted_at,
                user.privacy_accepted_at,
                user.guidelines_accepted_at,
            )
        ):
            raise AppError(
                403,
                "ONBOARDING_REQUIRED",
                "Profile incomplete",
                "Complete your profile and accept the policies before publishing a wish.",
            )

    def _validate_message(self, message: str) -> None:
        if not (self.settings.wish_message_min <= len(message) <= self.settings.wish_message_max):
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid wish message",
                (
                    f"Use between {self.settings.wish_message_min} and "
                    f"{self.settings.wish_message_max} characters."
                ),
            )
        if _CONTROL_RE.search(message):
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid wish message",
                "The message contains unsupported characters.",
            )
        if _HTML_RE.search(message):
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid wish message",
                "HTML is not allowed in wishes.",
            )
        if _URL_RE.search(message):
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid wish message",
                "Links are not allowed in wishes.",
            )
        if _UPI_RE.search(message) or _VPA_RE.search(message):
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid wish message",
                "UPI IDs are not allowed in public wishes.",
            )
        if _PHONE_RE.search(message):
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid wish message",
                "Phone numbers are not allowed in public wishes.",
            )

        folded = message.casefold()
        for term in self.settings.prohibited_wish_term_list:
            if term in folded:
                raise AppError(
                    400,
                    "VALIDATION_ERROR",
                    "Invalid wish message",
                    "This message contains prohibited content.",
                )

    def _validate_city(self, city: str | None) -> str | None:
        if city is None:
            return None
        value = city.strip()
        if value == "":
            return None
        if not _CITY_RE.fullmatch(value):
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid city",
                "Enter a city name between 2 and 60 characters.",
            )
        return value


def expire_due_wishes(
    *,
    session: Session,
    settings: Settings,
    now: datetime | None = None,
    batch_size: int = 100,
) -> int:
    current = now or datetime.now(UTC)
    wishes = list(
        session.scalars(
            select(Wish)
            .where(Wish.status == WishStatus.OPEN, Wish.expires_at <= current)
            .order_by(Wish.expires_at)
            .with_for_update(skip_locked=True)
            .limit(batch_size)
        )
    )
    for wish in wishes:
        wish.status = WishStatus.EXPIRED
        wish.closed_reason = "EXPIRED"
        wish.cooldown_until = current + timedelta(hours=settings.wish_cooldown_hours)
        wish.updated_at = current
        notify(
            session=session,
            user_id=wish.user_id,
            dedupe_key=f"wish:{wish.id}:expired",
            notification_type="WISH_EXPIRED",
            title="Wish expired",
            body="Your 24-hour wish window ended without a completed gift.",
            entity_type="WISH",
            entity_id=wish.id,
            payload={"wishId": str(wish.id)},
        )
        record_audit_event(
            session=session,
            event_type="WISH_EXPIRED",
            user_id=wish.user_id,
            metadata={"wishId": str(wish.id)},
        )
    if wishes:
        session.commit()
    return len(wishes)
