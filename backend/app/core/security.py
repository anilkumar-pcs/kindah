from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from jwt import InvalidTokenError

from app.core.config import Settings

_MOBILE_RE = re.compile(r"^[6-9]\d{9}$")
_ACCESS_ISSUER = "kindly-api"
_ACCESS_TYPE = "access"


class TokenError(Exception):
    """Raised when an access token is missing, malformed or expired."""


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: str
    session_id: str
    issued_at: datetime
    expires_at: datetime


def normalize_indian_mobile(raw: str) -> str:
    """Normalize common Indian mobile formats to +91XXXXXXXXXX."""

    cleaned = re.sub(r"[\s\-()]", "", raw.strip())
    if cleaned.startswith("+"):
        if not cleaned.startswith("+91"):
            raise ValueError("Only Indian (+91) mobile numbers are supported")
        digits = cleaned[3:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        digits = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        digits = cleaned[1:]
    else:
        digits = cleaned

    if not _MOBILE_RE.fullmatch(digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return f"+91{digits}"


def mask_mobile(e164: str) -> str:
    digits = e164.removeprefix("+91")
    return f"+91 ******{digits[-4:]}"


def hmac_sha256_hex(key: str, value: str) -> str:
    return hmac.new(key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(key: str, challenge_id: str, code: str) -> str:
    return hmac_sha256_hex(key, f"{challenge_id}:{code}")


def constant_time_equals(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def generate_opaque_token(nbytes: int = 48) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def create_access_token(
    settings: Settings,
    *,
    user_id: str,
    session_id: str,
    now: datetime | None = None,
) -> tuple[str, datetime]:
    issued_at = now or datetime.now(UTC)
    expires_at = issued_at + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {
        "sub": user_id,
        "sid": session_id,
        "type": _ACCESS_TYPE,
        "iss": _ACCESS_ISSUER,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )
    return token, expires_at


def decode_access_token(settings: Settings, token: str) -> AccessTokenClaims:
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            issuer=_ACCESS_ISSUER,
            options={"require": ["exp", "iat", "sub", "sid", "type"]},
        )
    except InvalidTokenError as exc:
        raise TokenError("Invalid or expired access token") from exc

    if payload.get("type") != _ACCESS_TYPE:
        raise TokenError("Invalid access token type")

    try:
        return AccessTokenClaims(
            user_id=str(payload["sub"]),
            session_id=str(payload["sid"]),
            issued_at=datetime.fromtimestamp(int(payload["iat"]), UTC),
            expires_at=datetime.fromtimestamp(int(payload["exp"]), UTC),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise TokenError("Invalid access token claims") from exc
