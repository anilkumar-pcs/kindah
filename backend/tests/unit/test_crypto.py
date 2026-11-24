from __future__ import annotations

import pytest

from app.providers.crypto.base import CryptoError
from app.providers.crypto.local import LocalAesGcmCryptoProvider


def provider() -> LocalAesGcmCryptoProvider:
    return LocalAesGcmCryptoProvider("unit-test-crypto-key-minimum-32-characters")


def test_encrypt_decrypt_round_trip() -> None:
    ciphertext = provider().encrypt("+919876543210", context="identity.mobile")
    assert "+919876543210" not in ciphertext
    assert provider().decrypt(ciphertext, context="identity.mobile") == "+919876543210"


def test_ciphertext_is_non_deterministic() -> None:
    crypto = provider()
    first = crypto.encrypt("alice@okhdfc", context="payment.vpa")
    second = crypto.encrypt("alice@okhdfc", context="payment.vpa")
    assert first != second


def test_wrong_context_fails_authentication() -> None:
    ciphertext = provider().encrypt("alice@okhdfc", context="payment.vpa")
    with pytest.raises(CryptoError):
        provider().decrypt(ciphertext, context="identity.mobile")


def test_tampered_ciphertext_is_rejected() -> None:
    ciphertext = provider().encrypt("alice@okhdfc", context="payment.vpa")
    raw = list(ciphertext)
    raw[-1] = "A" if raw[-1] != "A" else "B"
    with pytest.raises(CryptoError):
        provider().decrypt("".join(raw), context="payment.vpa")


def test_malformed_ciphertext_is_rejected() -> None:
    with pytest.raises(CryptoError):
        provider().decrypt("not-a-token", context="payment.vpa")
