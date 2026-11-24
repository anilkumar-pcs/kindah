"""External provider interfaces and environment-selected adapters."""

from __future__ import annotations

from app.core.config import Settings
from app.providers.crypto.base import CryptoProvider
from app.providers.crypto.local import LocalAesGcmCryptoProvider
from app.providers.sms.base import SmsProvider
from app.providers.sms.test import TestSmsProvider


def build_crypto_provider(settings: Settings) -> CryptoProvider:
    if settings.crypto_provider == "local":
        return LocalAesGcmCryptoProvider(settings.crypto_key.get_secret_value())
    raise RuntimeError(
        f"Crypto provider {settings.crypto_provider!r} is not implemented. "
        "Production KMS integration is a launch gate."
    )


def build_sms_provider(settings: Settings) -> SmsProvider:
    if settings.sms_provider == "test":
        return TestSmsProvider(settings.otp_test_code)
    raise RuntimeError(
        f"SMS provider {settings.sms_provider!r} is not implemented. "
        "Production OTP delivery is a launch gate."
    )
