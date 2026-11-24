from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.modules.gifts.models import (
    Gift,
    GiftEvent,
    GiftStatus,
    IdempotencyRecord,
    KarmaEvent,
    OutboxEvent,
    ReservationStatus,
    WishReservation,
)
from app.modules.gifts.schemas import (
    DonorOutcomeRequest,
    GiftCreateRequest,
    GiftListResponse,
    GiftResponse,
    RecipientConfirmationRequest,
)
from app.modules.identity.models import User, UserStatus
from app.modules.payment_methods.models import (
    PaymentMethodStatus,
    RecipientPaymentMethod,
)
from app.modules.safety.models import UserBlock
from app.modules.wishes.models import Wish, WishStatus
from app.providers.crypto.base import CryptoProvider
from app.providers.payment_handoff.base import PaymentHandoffProvider

_CREATE_ENDPOINT = "POST /api/v1/gifts"
_IDEMPOTENCY_RETENTION_DAYS = 30


class GiftService:
    def __init__(
        self,
        *,
        settings: Settings,
        session: Session,
        crypto: CryptoProvider,
        handoff: PaymentHandoffProvider,
    ) -> None:
        self.settings = settings
        self.session = session
        self.crypto = crypto
        self.handoff = handoff

    # ------------------------------------------------------------------
    # Gift creation
    # ------------------------------------------------------------------
    def create_gift(
        self,
        donor: User,
        request: GiftCreateRequest,
        idempotency_key: str,
    ) -> GiftResponse:
        payload = {
            "wishId": str(request.wish_id),
            "amountInr": request.amount_inr,
            "cheerNote": request.cheer_note,
        }
        replay = self._replay_or_conflict(
            actor_id=donor.id,
            endpoint=_CREATE_ENDPOINT,
            key=idempotency_key,
            payload=payload,
            donor_view=True,
        )
        if replay is not None:
            return replay

        now = self._now()
        wish = self.session.scalar(select(Wish).where(Wish.id == request.wish_id).with_for_update())
        if wish is None:
            raise self._not_found()
        if wish.user_id == donor.id:
            raise self._unavailable()
        if wish.status != WishStatus.OPEN or wish.expires_at <= now:
            raise self._unavailable()

        recipient = self.session.get(User, wish.user_id)
        if recipient is None or recipient.status != UserStatus.ACTIVE:
            raise self._unavailable()
        if self._blocked(donor.id, recipient.id):
            raise self._unavailable()

        payment_method = self.session.scalar(
            select(RecipientPaymentMethod).where(
                RecipientPaymentMethod.user_id == recipient.id,
                RecipientPaymentMethod.status == PaymentMethodStatus.ACTIVE,
            )
        )
        if payment_method is None:
            raise AppError(
                403,
                "PAYMENT_METHOD_REQUIRED",
                "Payment method unavailable",
                "The recipient cannot receive gifts right now.",
            )

        unresolved = self.session.scalar(
            select(func.count(Gift.id)).where(
                Gift.donor_id == donor.id,
                Gift.status == GiftStatus.DONOR_CLAIMED_PAID,
            )
        )
        if (unresolved or 0) >= self.settings.unresolved_claim_limit:
            raise AppError(
                409,
                "UNRESOLVED_CLAIM_LIMIT",
                "Unresolved claims",
                "Resolve your existing paid claims before giving again.",
            )

        payment_ref = f"KIND-{secrets.token_hex(3).upper()}"
        gift = Gift(
            id=uuid.uuid4(),
            wish_id=wish.id,
            donor_id=donor.id,
            recipient_id=recipient.id,
            amount_inr=request.amount_inr,
            cheer_note=(request.cheer_note.strip() or None) if request.cheer_note else None,
            payment_ref=payment_ref,
            payment_method_id=payment_method.id,
            payment_method_version=payment_method.version,
            status=GiftStatus.CREATED,
            handoff_payload_encrypted="pending",
            created_at=now,
            updated_at=now,
        )
        self.session.add(gift)
        self.session.flush()

        payee_vpa = self.crypto.decrypt(
            payment_method.encrypted_vpa,
            context="payment_method.vpa",
        )
        handoff = self.handoff.create_handoff(
            amount_inr=request.amount_inr,
            payment_ref=payment_ref,
            payee_vpa=payee_vpa,
            payee_label="Kindly recipient",
        )
        gift.handoff_payload_encrypted = self.crypto.encrypt(
            json.dumps(
                {
                    "upiIntentUri": handoff.upi_intent_uri,
                    "qrPayload": handoff.qr_payload,
                    "paymentRef": payment_ref,
                },
                separators=(",", ":"),
            ),
            context="gift.handoff",
        )
        gift.status = GiftStatus.HANDOFF_ISSUED

        reservation = WishReservation(
            id=uuid.uuid4(),
            wish_id=wish.id,
            donor_id=donor.id,
            gift_id=gift.id,
            status=ReservationStatus.ACTIVE,
            reserved_at=now,
            expires_at=now + timedelta(minutes=self.settings.reservation_minutes),
            extension_count=0,
            created_at=now,
            updated_at=now,
        )
        self.session.add(reservation)
        wish.status = WishStatus.LOCKED
        wish.updated_at = now

        self._event(gift, donor.id, "GIFT_CREATED", None, GiftStatus.CREATED.value, "created")
        self._event(
            gift,
            donor.id,
            "GIFT_HANDOFF_ISSUED",
            GiftStatus.CREATED.value,
            GiftStatus.HANDOFF_ISSUED.value,
            "handoff",
        )
        self._outbox(gift, "GIFT_HANDOFF_ISSUED", "handoff", {"paymentRef": payment_ref})

        response = self._response(
            gift,
            wish,
            reservation,
            donor_view=True,
            recipient_name=recipient.display_name,
        )
        body = response.model_dump(mode="json", by_alias=True)
        body["upiIntentUri"] = None
        body["qrPayload"] = None
        self._store_idempotency(
            actor_id=donor.id,
            endpoint=_CREATE_ENDPOINT,
            key=idempotency_key,
            payload=payload,
            status=201,
            body=body,
            now=now,
        )
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise self._unavailable() from exc
        return response

    # ------------------------------------------------------------------
    # Donor outcome
    # ------------------------------------------------------------------
    def donor_outcome(
        self,
        donor: User,
        gift_id: UUID,
        request: DonorOutcomeRequest,
        idempotency_key: str,
    ) -> GiftResponse:
        endpoint = f"POST /api/v1/gifts/{gift_id}/donor-outcome"
        payload = {"outcome": request.outcome, "utrReference": request.utr_reference}
        replay = self._replay_or_conflict(
            actor_id=donor.id,
            endpoint=endpoint,
            key=idempotency_key,
            payload=payload,
            donor_view=True,
        )
        if replay is not None:
            return replay

        now = self._now()
        wish, reservation, gift = self._lock_triplet(gift_id)
        if gift.donor_id != donor.id:
            raise AppError(403, "FORBIDDEN", "Not allowed", "Only the donor can report an outcome.")
        if gift.status not in {GiftStatus.HANDOFF_ISSUED, GiftStatus.DONOR_PENDING}:
            raise self._invalid_transition()

        from_state = gift.status.value
        if request.outcome == "PAID":
            if reservation.status != ReservationStatus.ACTIVE:
                raise self._invalid_transition()
            gift.status = GiftStatus.DONOR_CLAIMED_PAID
            gift.donor_claimed_at = now
            gift.recipient_response_deadline = now + timedelta(
                hours=self.settings.recipient_response_hours
            )
            if request.utr_reference:
                gift.utr_encrypted = self.crypto.encrypt(
                    request.utr_reference,
                    context="gift.utr",
                )
            wish.status = WishStatus.PAYMENT_CLAIMED
            reservation.status = ReservationStatus.CONSUMED
            event_type = "DONOR_CLAIMED_PAID"
        elif request.outcome == "STILL_PROCESSING":
            if reservation.status != ReservationStatus.ACTIVE or reservation.extension_count >= 1:
                raise self._invalid_transition()
            gift.status = GiftStatus.DONOR_PENDING
            reservation.extension_count = 1
            reservation.expires_at = reservation.reserved_at + timedelta(
                minutes=self.settings.reservation_extension_minutes
            )
            event_type = "DONOR_STILL_PROCESSING"
        else:
            gift.status = GiftStatus.FAILED
            reservation.status = ReservationStatus.RELEASED
            reservation.released_at = now
            reservation.release_reason = "DONOR_FAILED"
            if wish.expires_at > now:
                wish.status = WishStatus.OPEN
            else:
                wish.status = WishStatus.EXPIRED
                wish.closed_reason = "EXPIRED"
                wish.cooldown_until = now + timedelta(hours=self.settings.wish_cooldown_hours)
            event_type = "DONOR_FAILED"

        gift.updated_at = now
        wish.updated_at = now
        reservation.updated_at = now
        self._event(gift, donor.id, event_type, from_state, gift.status.value, event_type.lower())
        self._outbox(gift, event_type, event_type.lower(), {"outcome": request.outcome})

        response = self._response(gift, wish, reservation, donor_view=True)
        body = response.model_dump(mode="json", by_alias=True)
        body["upiIntentUri"] = None
        body["qrPayload"] = None
        self._store_idempotency(
            actor_id=donor.id,
            endpoint=endpoint,
            key=idempotency_key,
            payload=payload,
            status=200,
            body=body,
            now=now,
        )
        self.session.commit()
        return response

    # ------------------------------------------------------------------
    # Recipient confirmation
    # ------------------------------------------------------------------
    def recipient_confirmation(
        self,
        recipient: User,
        gift_id: UUID,
        request: RecipientConfirmationRequest,
        idempotency_key: str,
    ) -> GiftResponse:
        endpoint = f"POST /api/v1/gifts/{gift_id}/recipient-confirmation"
        payload = {
            "outcome": request.outcome,
            "reaction": request.reaction,
            "message": request.message,
        }
        replay = self._replay_or_conflict(
            actor_id=recipient.id,
            endpoint=endpoint,
            key=idempotency_key,
            payload=payload,
            donor_view=False,
        )
        if replay is not None:
            return replay

        now = self._now()
        wish, reservation, gift = self._lock_triplet(gift_id)
        if gift.recipient_id != recipient.id:
            raise AppError(
                403,
                "FORBIDDEN",
                "Not allowed",
                "Only the recipient can confirm receipt.",
            )
        if gift.status != GiftStatus.DONOR_CLAIMED_PAID:
            raise self._invalid_transition()
        if gift.recipient_response_deadline is not None and now > gift.recipient_response_deadline:
            raise self._invalid_transition()

        from_state = gift.status.value
        if request.outcome == "RECEIVED":
            gift.status = GiftStatus.RECIPIENT_CONFIRMED
            wish.status = WishStatus.GRANTED
            gift.reaction = request.reaction
            gift.thank_you_message = (
                request.message.strip() if request.message and request.message.strip() else None
            )
            self._award_karma(gift, now)
            event_type = "RECIPIENT_CONFIRMED"
        else:
            gift.status = GiftStatus.DISPUTED
            wish.status = WishStatus.DISPUTED
            event_type = "RECIPIENT_DISPUTED"

        gift.updated_at = now
        wish.updated_at = now
        reservation.updated_at = now
        self._event(
            gift,
            recipient.id,
            event_type,
            from_state,
            gift.status.value,
            event_type.lower(),
        )
        self._outbox(gift, event_type, event_type.lower(), {"outcome": request.outcome})

        response = self._response(gift, wish, reservation, donor_view=False)
        body = response.model_dump(mode="json", by_alias=True)
        self._store_idempotency(
            actor_id=recipient.id,
            endpoint=endpoint,
            key=idempotency_key,
            payload=payload,
            status=200,
            body=body,
            now=now,
        )
        self.session.commit()
        return response

    # ------------------------------------------------------------------
    # Participant reads
    # ------------------------------------------------------------------
    def get_gift(self, actor: User, gift_id: UUID) -> GiftResponse:
        gift = self.session.get(Gift, gift_id)
        if gift is None or actor.id not in {gift.donor_id, gift.recipient_id}:
            raise self._not_found()
        wish = self.session.get(Wish, gift.wish_id)
        reservation = self.session.scalar(
            select(WishReservation).where(WishReservation.gift_id == gift.id)
        )
        if wish is None or reservation is None:
            raise self._not_found()
        return self._response(
            gift,
            wish,
            reservation,
            donor_view=actor.id == gift.donor_id,
        )

    def list_for_user(self, actor: User) -> GiftListResponse:
        gifts = list(
            self.session.scalars(
                select(Gift)
                .where(or_(Gift.donor_id == actor.id, Gift.recipient_id == actor.id))
                .order_by(Gift.created_at.desc())
                .limit(100)
            )
        )
        responses: list[GiftResponse] = []
        for gift in gifts:
            wish = self.session.get(Wish, gift.wish_id)
            reservation = self.session.scalar(
                select(WishReservation).where(WishReservation.gift_id == gift.id)
            )
            if wish is not None and reservation is not None:
                responses.append(
                    self._response(
                        gift,
                        wish,
                        reservation,
                        donor_view=actor.id == gift.donor_id,
                    )
                )
        return GiftListResponse(gifts=responses)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _lock_triplet(
        self,
        gift_id: UUID,
    ) -> tuple[Wish, WishReservation, Gift]:
        hint = self.session.get(Gift, gift_id)
        if hint is None:
            raise self._not_found()
        wish = self.session.scalar(
            select(Wish)
            .where(Wish.id == hint.wish_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        reservation = self.session.scalar(
            select(WishReservation)
            .where(WishReservation.gift_id == gift_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        gift = self.session.scalar(
            select(Gift)
            .where(Gift.id == gift_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if wish is None or reservation is None or gift is None:
            raise self._not_found()
        return wish, reservation, gift

    def _response(
        self,
        gift: Gift,
        wish: Wish,
        reservation: WishReservation,
        *,
        donor_view: bool,
        recipient_name: str | None = None,
    ) -> GiftResponse:
        uri: str | None = None
        qr: str | None = None
        if donor_view:
            uri, qr = self._handoff_fields(gift)
        if recipient_name is None:
            recipient = self.session.get(User, gift.recipient_id)
            recipient_name = recipient.display_name if recipient else None
        return GiftResponse(
            gift_id=gift.id,
            wish_id=gift.wish_id,
            gift_status=gift.status,
            wish_status=wish.status,
            amount_inr=gift.amount_inr,
            payment_ref_code=gift.payment_ref,
            upi_intent_uri=uri,
            qr_payload=qr,
            reservation_expires_at=reservation.expires_at,
            recipient_display_name=recipient_name if donor_view else None,
            created_at=gift.created_at,
        )

    def _handoff_fields(self, gift: Gift) -> tuple[str | None, str | None]:
        payload = json.loads(
            self.crypto.decrypt(
                gift.handoff_payload_encrypted,
                context="gift.handoff",
            )
        )
        return payload.get("upiIntentUri"), payload.get("qrPayload")

    def _replay_or_conflict(
        self,
        *,
        actor_id: UUID,
        endpoint: str,
        key: str,
        payload: dict[str, Any],
        donor_view: bool,
    ) -> GiftResponse | None:
        record = self.session.scalar(
            select(IdempotencyRecord).where(
                IdempotencyRecord.actor_id == actor_id,
                IdempotencyRecord.endpoint == endpoint,
                IdempotencyRecord.idempotency_key == key,
            )
        )
        if record is None:
            return None
        if record.request_hash != self._request_hash(payload):
            raise AppError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "Idempotency conflict",
                "This key was already used with a different request.",
            )
        body = dict(record.response_body)
        gift_id = body.get("giftId")
        if donor_view and gift_id:
            gift = self.session.get(Gift, UUID(str(gift_id)))
            if gift is not None:
                uri, qr = self._handoff_fields(gift)
                body["upiIntentUri"] = uri
                body["qrPayload"] = qr
        return GiftResponse.model_validate(body)

    def _store_idempotency(
        self,
        *,
        actor_id: UUID,
        endpoint: str,
        key: str,
        payload: dict[str, Any],
        status: int,
        body: dict[str, Any],
        now: datetime,
    ) -> None:
        self.session.add(
            IdempotencyRecord(
                actor_id=actor_id,
                endpoint=endpoint,
                idempotency_key=key,
                request_hash=self._request_hash(payload),
                response_status=status,
                response_body=body,
                created_at=now,
                expires_at=now + timedelta(days=_IDEMPOTENCY_RETENTION_DAYS),
            )
        )

    def _award_karma(self, gift: Gift, now: datetime) -> None:
        prior_donor = self.session.scalar(
            select(func.count(Gift.id)).where(
                Gift.donor_id == gift.donor_id,
                Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                Gift.id != gift.id,
            )
        )
        self._karma(
            gift.donor_id,
            gift,
            "FIRST_CONFIRMED_GIFT" if (prior_donor or 0) == 0 else "CONFIRMED_GIFT",
            25 if (prior_donor or 0) == 0 else 10,
            "donor",
        )

        prior_recipient = self.session.scalar(
            select(func.count(Gift.id)).where(
                Gift.recipient_id == gift.recipient_id,
                Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                Gift.id != gift.id,
            )
        )
        if (prior_recipient or 0) == 0:
            self._karma(
                gift.donor_id,
                gift,
                "FIRST_TIME_RECIPIENT_BONUS",
                5,
                "first-recipient",
            )

        if gift.reaction is not None or gift.thank_you_message is not None:
            self._karma(
                gift.recipient_id,
                gift,
                "RECIPIENT_THANKS",
                3,
                "recipient-thanks",
            )

        pay_it_forward = self.session.scalar(
            select(func.count(Gift.id)).where(
                Gift.recipient_id == gift.donor_id,
                Gift.status == GiftStatus.RECIPIENT_CONFIRMED,
                Gift.created_at >= now - timedelta(hours=24),
            )
        )
        if (pay_it_forward or 0) > 0:
            self._karma(
                gift.donor_id,
                gift,
                "PAY_IT_FORWARD",
                15,
                "pay-it-forward",
            )

    def _karma(
        self,
        user_id: UUID,
        gift: Gift,
        event_type: str,
        points: int,
        suffix: str,
    ) -> None:
        key = f"karma:{gift.id}:{suffix}"
        exists = self.session.scalar(select(KarmaEvent.id).where(KarmaEvent.idempotency_key == key))
        if exists is None:
            self.session.add(
                KarmaEvent(
                    user_id=user_id,
                    gift_id=gift.id,
                    event_type=event_type,
                    points_delta=points,
                    idempotency_key=key,
                )
            )

    def _event(
        self,
        gift: Gift,
        actor_id: UUID | None,
        event_type: str,
        from_state: str | None,
        to_state: str | None,
        suffix: str,
    ) -> None:
        self.session.add(
            GiftEvent(
                gift_id=gift.id,
                actor_id=actor_id,
                event_type=event_type,
                from_state=from_state,
                to_state=to_state,
                idempotency_key=f"gift:{gift.id}:{suffix}",
            )
        )

    def _outbox(
        self,
        gift: Gift,
        event_type: str,
        suffix: str,
        payload: dict[str, Any],
    ) -> None:
        self.session.add(
            OutboxEvent(
                aggregate_type="gift",
                aggregate_id=gift.id,
                event_type=event_type,
                payload=payload,
                idempotency_key=f"outbox:{gift.id}:{suffix}",
            )
        )

    def _blocked(self, first_id: UUID, second_id: UUID) -> bool:
        found = self.session.scalar(
            select(UserBlock.blocker_id).where(
                or_(
                    (UserBlock.blocker_id == first_id) & (UserBlock.blocked_id == second_id),
                    (UserBlock.blocker_id == second_id) & (UserBlock.blocked_id == first_id),
                )
            )
        )
        return found is not None

    @staticmethod
    def _request_hash(payload: dict[str, Any]) -> str:
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(raw.encode()).hexdigest()

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    @staticmethod
    def _not_found() -> AppError:
        return AppError(404, "NOT_FOUND", "Gift not found", "This gift is not available.")

    @staticmethod
    def _unavailable() -> AppError:
        return AppError(
            409,
            "WISH_UNAVAILABLE",
            "Wish unavailable",
            "This wish is no longer available.",
        )

    @staticmethod
    def _invalid_transition() -> AppError:
        return AppError(
            422,
            "INVALID_STATE_TRANSITION",
            "Invalid state transition",
            "This action is not valid for the current gift state.",
        )
