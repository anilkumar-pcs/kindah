from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class OtpMessage:
    phone_e164: str
    code: str
    expires_at: datetime


class SmsProvider(Protocol):
    def suggest_code(self) -> str | None:
        """Return a deterministic code for test adapters, else None."""
        ...

    def send_otp(self, message: OtpMessage) -> None: ...
