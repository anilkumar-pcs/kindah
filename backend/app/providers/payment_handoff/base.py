from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Handoff:
    upi_intent_uri: str
    qr_payload: str
    payment_ref: str


class PaymentHandoffProvider(Protocol):
    """Generate a UPI handoff. This does not settle or verify funds."""

    def create_handoff(
        self,
        *,
        amount_inr: int,
        payment_ref: str,
        payee_vpa: str,
        payee_label: str,
    ) -> Handoff: ...
