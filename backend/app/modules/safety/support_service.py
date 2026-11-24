from __future__ import annotations

import uuid
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.modules.gifts.models import Gift
from app.modules.identity.audit import record_audit_event
from app.modules.identity.models import User
from app.modules.payment_methods.models import RecipientPaymentMethod
from app.modules.safety.models import (
    SupportCase,
    SupportCaseStatus,
    SupportCaseType,
)
from app.modules.safety.schemas import (
    AdminSupportCaseResponse,
    SupportCaseCreateRequest,
    SupportCaseResolveRequest,
    SupportCaseResponse,
)
from app.modules.wishes.models import Wish
from app.providers.crypto.base import CryptoProvider

_ACTIVE_CASE_STATUSES = {SupportCaseStatus.OPEN, SupportCaseStatus.UNDER_REVIEW}


class SupportCaseService:
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

    def create(
        self,
        actor: User,
        gift_id: UUID,
        request: SupportCaseCreateRequest,
    ) -> SupportCaseResponse:
        gift = self.session.get(Gift, gift_id)
        if gift is None or actor.id not in {gift.donor_id, gift.recipient_id}:
            raise AppError(404, "NOT_FOUND", "Gift not found", "This gift is not available.")

        existing = self.session.scalar(
            select(SupportCase.id).where(
                SupportCase.gift_id == gift_id,
                SupportCase.reporter_id == actor.id,
                SupportCase.case_type == SupportCaseType(request.case_type),
                SupportCase.status.in_(list(_ACTIVE_CASE_STATUSES)),
            )
        )
        if existing is not None:
            raise AppError(
                409,
                "SUPPORT_CASE_EXISTS",
                "Support case already open",
                "You already have an open case for this gift and issue.",
            )

        now = datetime.now(UTC)
        case = SupportCase(
            id=uuid.uuid4(),
            gift_id=gift_id,
            reporter_id=actor.id,
            case_type=SupportCaseType(request.case_type),
            status=SupportCaseStatus.OPEN,
            description_encrypted=self.crypto.encrypt(
                request.description,
                context="support.description",
            ),
            created_at=now,
            updated_at=now,
        )
        self.session.add(case)
        record_audit_event(
            session=self.session,
            event_type="SUPPORT_CASE_CREATED",
            user_id=actor.id,
            metadata={
                "caseId": str(case.id),
                "giftId": str(gift_id),
                "caseType": request.case_type,
            },
        )
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise AppError(
                409,
                "SUPPORT_CASE_EXISTS",
                "Support case already open",
                "You already have an open case for this gift and issue.",
            ) from exc
        return self._response(case)

    def list_admin(
        self,
        status: SupportCaseStatus | None = None,
    ) -> list[AdminSupportCaseResponse]:
        statement = select(SupportCase).order_by(SupportCase.created_at.desc()).limit(100)
        if status is not None:
            statement = statement.where(SupportCase.status == status)
        return [self._admin_response(case) for case in self.session.scalars(statement)]

    def resolve(
        self,
        admin: User,
        case_id: UUID,
        request: SupportCaseResolveRequest,
    ) -> AdminSupportCaseResponse:
        case = self.session.scalar(
            select(SupportCase).where(SupportCase.id == case_id).with_for_update()
        )
        if case is None:
            raise AppError(404, "NOT_FOUND", "Support case not found", "This case is unavailable.")
        if case.status not in _ACTIVE_CASE_STATUSES:
            raise AppError(
                422,
                "INVALID_STATE_TRANSITION",
                "Case already resolved",
                "This support case is no longer open.",
            )

        now = datetime.now(UTC)
        case.status = SupportCaseStatus.RESOLVED
        case.resolved_by = admin.id
        case.resolved_at = now
        case.resolution_note_encrypted = self.crypto.encrypt(
            request.resolution_note,
            context="support.resolution",
        )
        case.updated_at = now
        record_audit_event(
            session=self.session,
            event_type="SUPPORT_CASE_RESOLVED",
            user_id=admin.id,
            metadata={"caseId": str(case.id), "giftId": str(case.gift_id)},
        )
        self.session.commit()
        return self._admin_response(case)

    def _response(self, case: SupportCase) -> SupportCaseResponse:
        return SupportCaseResponse(
            id=case.id,
            case_type=case.case_type,
            status=case.status,
            created_at=case.created_at,
            updated_at=case.updated_at,
        )

    def _admin_response(self, case: SupportCase) -> AdminSupportCaseResponse:
        gift = self.session.get(Gift, case.gift_id)
        if gift is None:
            raise AppError(404, "NOT_FOUND", "Gift not found", "This gift is unavailable.")
        wish = self.session.get(Wish, gift.wish_id)
        reporter = self.session.get(User, case.reporter_id)
        donor = self.session.get(User, gift.donor_id)
        recipient = self.session.get(User, gift.recipient_id)
        payment_method = self.session.get(RecipientPaymentMethod, gift.payment_method_id)
        utr = (
            self.crypto.decrypt(gift.utr_encrypted, context="gift.utr")
            if gift.utr_encrypted
            else None
        )
        resolution = (
            self.crypto.decrypt(
                case.resolution_note_encrypted,
                context="support.resolution",
            )
            if case.resolution_note_encrypted
            else None
        )
        return AdminSupportCaseResponse(
            id=case.id,
            gift_id=gift.id,
            wish_id=gift.wish_id,
            case_type=case.case_type,
            status=case.status,
            description=self.crypto.decrypt(
                case.description_encrypted,
                context="support.description",
            ),
            reporter_display_name=reporter.display_name if reporter else None,
            donor_display_name=donor.display_name if donor else None,
            recipient_display_name=recipient.display_name if recipient else None,
            amount_inr=gift.amount_inr,
            gift_status=gift.status,
            wish_status=wish.status if wish else "UNVERIFIED",
            payment_ref_code=gift.payment_ref,
            recipient_masked_vpa=payment_method.masked_vpa if payment_method else None,
            utr_reference=utr,
            resolution_note=resolution,
            resolved_at=case.resolved_at,
            created_at=case.created_at,
        )
