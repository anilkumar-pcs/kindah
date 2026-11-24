from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.modules.gifts.schemas import (
    DonorOutcomeRequest,
    GiftCreateRequest,
    GiftListResponse,
    GiftResponse,
    RecipientConfirmationRequest,
)
from app.modules.gifts.service import GiftService
from app.modules.identity.dependencies import require_active_auth
from app.modules.identity.service import AuthContext
from app.providers.crypto.base import CryptoProvider
from app.providers.payment_handoff.base import PaymentHandoffProvider

router = APIRouter(tags=["gifts"])


def get_gift_service(
    request: Request,
    session: Session = Depends(get_db_session),
) -> GiftService:
    crypto: CryptoProvider = request.app.state.crypto
    handoff: PaymentHandoffProvider = request.app.state.handoff
    return GiftService(
        settings=request.app.state.settings,
        session=session,
        crypto=crypto,
        handoff=handoff,
    )


def get_idempotency_key(
    idempotency_key: str = Header(
        alias="Idempotency-Key",
        min_length=8,
        max_length=128,
    ),
) -> str:
    return idempotency_key


@router.post(
    "/gifts",
    response_model=GiftResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_gift(
    body: GiftCreateRequest,
    auth: AuthContext = Depends(require_active_auth),
    idempotency_key: str = Depends(get_idempotency_key),
    service: GiftService = Depends(get_gift_service),
) -> GiftResponse:
    return service.create_gift(auth.user, body, idempotency_key)


@router.post(
    "/gifts/{gift_id}/donor-outcome",
    response_model=GiftResponse,
)
def donor_outcome(
    gift_id: UUID,
    body: DonorOutcomeRequest,
    auth: AuthContext = Depends(require_active_auth),
    idempotency_key: str = Depends(get_idempotency_key),
    service: GiftService = Depends(get_gift_service),
) -> GiftResponse:
    return service.donor_outcome(auth.user, gift_id, body, idempotency_key)


@router.post(
    "/gifts/{gift_id}/recipient-confirmation",
    response_model=GiftResponse,
)
def recipient_confirmation(
    gift_id: UUID,
    body: RecipientConfirmationRequest,
    auth: AuthContext = Depends(require_active_auth),
    idempotency_key: str = Depends(get_idempotency_key),
    service: GiftService = Depends(get_gift_service),
) -> GiftResponse:
    return service.recipient_confirmation(auth.user, gift_id, body, idempotency_key)


@router.get(
    "/gifts/{gift_id}",
    response_model=GiftResponse,
)
def get_gift(
    gift_id: UUID,
    auth: AuthContext = Depends(require_active_auth),
    service: GiftService = Depends(get_gift_service),
) -> GiftResponse:
    return service.get_gift(auth.user, gift_id)


@router.get(
    "/me/gifts",
    response_model=GiftListResponse,
)
def list_my_gifts(
    auth: AuthContext = Depends(require_active_auth),
    service: GiftService = Depends(get_gift_service),
) -> GiftListResponse:
    return service.list_for_user(auth.user)
