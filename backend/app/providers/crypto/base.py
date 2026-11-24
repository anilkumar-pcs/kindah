from __future__ import annotations

from typing import Protocol


class CryptoError(Exception):
    """Raised when ciphertext cannot be authenticated or decrypted."""


class CryptoProvider(Protocol):
    """Encrypt sensitive values at rest.

    Production must use a KMS envelope-encryption adapter. The local adapter is
    for development and tests only.
    """

    def encrypt(self, plaintext: str, *, context: str) -> str: ...

    def decrypt(self, token: str, *, context: str) -> str: ...
