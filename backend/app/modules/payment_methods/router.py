from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.db import get_db_session
from app.core.errors import AppError
from app.modules.identity.dependencies import require_active_auth
from app.modules.identity.service import AuthContext
from app.modules.payment_methods.schemas import (
    PaymentMethodResponse,
    PaymentMethodUpdateRequest,
)
from app.modules.payment_methods.service import PaymentMethodService
from app.providers.crypto.base import CryptoProvider

router = APIRouter(tags=["payment-methods"])


def get_payment_method_service(
    request: Request,
    session: Session = Depends(get_db_session),
) -> PaymentMethodService:
    crypto: CryptoProvider = request.app.state.crypto
    return PaymentMethodService(
        settings=request.app.state.settings,
        session=session,
        crypto=crypto,
    )


@router.put(
    "/me/payment-method",
    response_model=PaymentMethodResponse,
)
def save_payment_method(
    body: PaymentMethodUpdateRequest,
    auth: AuthContext = Depends(require_active_auth),
    service: PaymentMethodService = Depends(get_payment_method_service),
) -> PaymentMethodResponse:
    record = service.save(auth.user, body)
    return service.response(record)


@router.get(
    "/me/payment-method",
    response_model=PaymentMethodResponse,
)
def get_payment_method(
    auth: AuthContext = Depends(require_active_auth),
    service: PaymentMethodService = Depends(get_payment_method_service),
) -> PaymentMethodResponse:
    record = service.get_for_user(auth.user)
    if record is None:
        raise AppError(
            404,
            "NOT_FOUND",
            "Payment method not found",
            "Add a UPI ID before publishing a wish.",
        )
    return service.response(record)
