from __future__ import annotations

from urllib.parse import urlencode

from app.providers.payment_handoff.base import Handoff


class TestPaymentHandoffProvider:
    """Deterministic UPI URI/QR payload builder for local/test environments."""

    def create_handoff(
        self,
        *,
        amount_inr: int,
        payment_ref: str,
        payee_vpa: str,
        payee_label: str,
    ) -> Handoff:
        query = urlencode(
            {
                "pa": payee_vpa,
                "pn": payee_label,
                "am": str(amount_inr),
                "cu": "INR",
                "tn": payment_ref,
            }
        )
        uri = f"upi://pay?{query}"
        return Handoff(
            upi_intent_uri=uri,
            qr_payload=uri,
            payment_ref=payment_ref,
        )
