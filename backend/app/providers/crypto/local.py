from __future__ import annotations

import base64
import hashlib
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.providers.crypto.base import CryptoError

_VERSION = b"\x01"
_NONCE_BYTES = 12


class LocalAesGcmCryptoProvider:
    """Development/test AES-256-GCM adapter.

    The key is derived from the configured secret. This is not a KMS and must
    not be used for production data.
    """

    def __init__(self, secret: str) -> None:
        key = hashlib.sha256(secret.encode("utf-8")).digest()
        self._aead = AESGCM(key)

    def encrypt(self, plaintext: str, *, context: str) -> str:
        nonce = os.urandom(_NONCE_BYTES)
        ciphertext = self._aead.encrypt(
            nonce,
            plaintext.encode("utf-8"),
            context.encode("utf-8"),
        )
        return base64.urlsafe_b64encode(_VERSION + nonce + ciphertext).decode("ascii")

    def decrypt(self, token: str, *, context: str) -> str:
        try:
            raw = base64.urlsafe_b64decode(token.encode("ascii"))
        except Exception as exc:
            raise CryptoError("Invalid ciphertext encoding") from exc

        minimum_length = len(_VERSION) + _NONCE_BYTES + 16
        if len(raw) < minimum_length or raw[:1] != _VERSION:
            raise CryptoError("Unsupported or malformed ciphertext")

        nonce = raw[len(_VERSION) : len(_VERSION) + _NONCE_BYTES]
        ciphertext = raw[len(_VERSION) + _NONCE_BYTES :]
        try:
            plaintext = self._aead.decrypt(nonce, ciphertext, context.encode("utf-8"))
        except InvalidTag as exc:
            raise CryptoError("Ciphertext authentication failed") from exc
        return plaintext.decode("utf-8")
