from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import struct
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

import jwt
from jwt import InvalidTokenError

from app.core.config import Settings

_MOBILE_RE = re.compile(r"^[6-9]\d{9}$")
_VPA_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,49}@[A-Za-z][A-Za-z0-9]{1,30}$")
_ACCESS_ISSUER = "kindly-api"
_ACCESS_TYPE = "access"
_MFA_TYPE = "admin_mfa"


class TokenError(Exception):
    """Raised when an access token is missing, malformed or expired."""


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: str
    session_id: str
    issued_at: datetime
    expires_at: datetime


@dataclass(frozen=True)
class MfaTokenClaims:
    user_id: str
    session_id: str
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


def normalize_vpa(raw: str) -> str:
    """Validate VPA syntax only. This does not prove ownership or existence."""

    value = raw.strip()
    if len(value) > 80 or not _VPA_RE.fullmatch(value):
        raise ValueError("Enter a valid UPI ID in the format name@provider")
    return value


def mask_vpa(vpa: str) -> str:
    local, _, provider = vpa.partition("@")
    return f"{local[:2]}***@{provider}"


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


def create_mfa_token(
    settings: Settings,
    *,
    user_id: str,
    session_id: str,
    now: datetime | None = None,
) -> tuple[str, datetime]:
    issued_at = now or datetime.now(UTC)
    expires_at = issued_at + timedelta(minutes=settings.admin_mfa_ttl_minutes)
    payload = {
        "sub": user_id,
        "sid": session_id,
        "type": _MFA_TYPE,
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


def decode_mfa_token(settings: Settings, token: str) -> MfaTokenClaims:
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            issuer=_ACCESS_ISSUER,
            options={"require": ["exp", "iat", "sub", "sid", "type"]},
        )
    except InvalidTokenError as exc:
        raise TokenError("Invalid or expired MFA token") from exc
    if payload.get("type") != _MFA_TYPE:
        raise TokenError("Invalid MFA token type")
    try:
        return MfaTokenClaims(
            user_id=str(payload["sub"]),
            session_id=str(payload["sid"]),
            expires_at=datetime.fromtimestamp(int(payload["exp"]), UTC),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise TokenError("Invalid MFA token claims") from exc


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def totp_uri(settings: Settings, secret: str, account_name: str) -> str:
    label = f"{settings.admin_mfa_issuer}:{account_name}"
    issuer = quote(settings.admin_mfa_issuer, safe="")
    return (
        f"otpauth://totp/{quote(label, safe='')}?secret={secret}"
        f"&issuer={issuer}&algorithm=SHA1&digits=6&period=30"
    )


def _totp_code_at_step(secret: str, step: int) -> str:
    padded = secret + "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(padded.upper(), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{binary % 1_000_000:06d}"


def totp_code(secret: str, at: datetime | None = None) -> str:
    current_step = int((at or datetime.now(UTC)).timestamp()) // 30
    return _totp_code_at_step(secret, current_step)


def match_totp_step(
    secret: str,
    code: str,
    *,
    at: datetime | None = None,
    window: int = 1,
) -> int | None:
    if not re.fullmatch(r"\d{6}", code):
        return None
    current_step = int((at or datetime.now(UTC)).timestamp()) // 30
    for offset in range(-window, window + 1):
        candidate_step = current_step + offset
        if hmac.compare_digest(_totp_code_at_step(secret, candidate_step), code):
            return candidate_step
    return None


def generate_recovery_codes(count: int = 10) -> list[str]:
    return [f"{secrets.token_hex(2)}-{secrets.token_hex(2)}" for _ in range(count)]


def normalize_recovery_code(code: str) -> str:
    return code.replace("-", "").replace(" ", "").strip().lower()


def hash_recovery_code(settings: Settings, code: str) -> str:
    return hmac_sha256_hex(
        settings.lookup_hmac_key.get_secret_value(),
        f"admin-recovery:{normalize_recovery_code(code)}",
    )
