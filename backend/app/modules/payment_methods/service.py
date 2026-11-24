from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import hmac_sha256_hex, mask_vpa, normalize_vpa
from app.modules.identity.audit import record_audit_event
from app.modules.identity.models import User
from app.modules.payment_methods.models import (
    PaymentMethodStatus,
    RecipientPaymentMethod,
    VpaValidationStatus,
)
from app.modules.payment_methods.schemas import (
    PaymentMethodResponse,
    PaymentMethodUpdateRequest,
)
from app.providers.crypto.base import CryptoProvider


class PaymentMethodService:
    def __init__(
        self,
        *,
        settings: Settings,
        session: Session,
        crypto: CryptoProvider,
    ) -> None:
        self.settings = settings
        self.session = session
        self.crypto = crypto

    def save(
        self,
        user: User,
        request: PaymentMethodUpdateRequest,
    ) -> RecipientPaymentMethod:
        now = datetime.now(UTC)
        if not request.privacy_acknowledged:
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Privacy acknowledgement required",
                "Acknowledge that your UPI app may show your registered name.",
            )
        self._require_recent_authentication(user, now)

        try:
            vpa = normalize_vpa(request.vpa)
        except ValueError as exc:
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid UPI ID",
                str(exc),
            ) from exc

        vpa_hmac = hmac_sha256_hex(
            self.settings.lookup_hmac_key.get_secret_value(),
            f"vpa:{vpa.casefold()}",
        )
        existing = self.session.scalar(
            select(RecipientPaymentMethod)
            .where(RecipientPaymentMethod.user_id == user.id)
            .with_for_update()
        )

        if existing is not None and existing.vpa_hmac == vpa_hmac:
            existing.privacy_ack_at = now
            existing.updated_at = now
            existing.status = PaymentMethodStatus.ACTIVE
            self._audit(user, existing.version)
            self.session.commit()
            return existing

        conflict = self.session.scalar(
            select(RecipientPaymentMethod.id).where(
                RecipientPaymentMethod.vpa_hmac == vpa_hmac,
                RecipientPaymentMethod.user_id != user.id,
            )
        )
        if conflict is not None:
            raise AppError(
                409,
                "VPA_ALREADY_IN_USE",
                "UPI ID already in use",
                "This UPI ID is already linked to another account.",
            )

        encrypted_vpa = self.crypto.encrypt(vpa, context="payment_method.vpa")
        masked = mask_vpa(vpa)

        if existing is not None:
            existing.encrypted_vpa = encrypted_vpa
            existing.vpa_hmac = vpa_hmac
            existing.masked_vpa = masked
            existing.version += 1
            existing.status = PaymentMethodStatus.ACTIVE
            existing.validation_status = VpaValidationStatus.SYNTAX_ONLY
            existing.privacy_ack_at = now
            existing.updated_at = now
            record = existing
        else:
            record = RecipientPaymentMethod(
                id=uuid.uuid4(),
                user_id=user.id,
                encrypted_vpa=encrypted_vpa,
                vpa_hmac=vpa_hmac,
                masked_vpa=masked,
                version=1,
                status=PaymentMethodStatus.ACTIVE,
                validation_status=VpaValidationStatus.SYNTAX_ONLY,
                privacy_ack_at=now,
                created_at=now,
                updated_at=now,
            )
            self.session.add(record)

        self._audit(user, record.version)
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise AppError(
                409,
                "VPA_ALREADY_IN_USE",
                "UPI ID already in use",
                "This UPI ID is already linked to another account.",
            ) from exc
        return record

    def get_for_user(self, user: User) -> RecipientPaymentMethod | None:
        return self.session.scalar(
            select(RecipientPaymentMethod).where(RecipientPaymentMethod.user_id == user.id)
        )

    def response(self, record: RecipientPaymentMethod) -> PaymentMethodResponse:
        return PaymentMethodResponse(
            masked_vpa=record.masked_vpa,
            version=record.version,
            status=record.status,
            validation_status=record.validation_status,
            privacy_ack_at=record.privacy_ack_at,
            updated_at=record.updated_at,
        )

    def _require_recent_authentication(self, user: User, now: datetime) -> None:
        if user.last_authenticated_at is None or now - user.last_authenticated_at > timedelta(
            minutes=self.settings.reauth_window_minutes
        ):
            raise AppError(
                403,
                "REAUTHENTICATION_REQUIRED",
                "Re-authentication required",
                "Sign in again before changing your payment method.",
            )

    def _audit(self, user: User, version: int) -> None:
        record_audit_event(
            session=self.session,
            event_type="PAYMENT_METHOD_SAVED",
            user_id=user.id,
            metadata={"version": version, "validation": "SYNTAX_ONLY"},
        )
