from __future__ import annotations

from app.providers.sms.base import OtpMessage


class TestSmsProvider:
    """Deterministic local/test adapter.

    The configured code is used only when this adapter is selected. Production
    rejects the test adapter at settings validation.
    """

    def __init__(self, code: str) -> None:
        self._code = code
        self.sent: list[OtpMessage] = []

    def suggest_code(self) -> str | None:
        return self._code

    def send_otp(self, message: OtpMessage) -> None:
        self.sent.append(message)
