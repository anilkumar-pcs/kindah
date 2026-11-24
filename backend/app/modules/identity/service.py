from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import (
    AccessTokenClaims,
    TokenError,
    constant_time_equals,
    create_access_token,
    decode_access_token,
    generate_csrf_token,
    generate_opaque_token,
    generate_otp,
    hash_opaque_token,
    hash_otp,
    hmac_sha256_hex,
    mask_mobile,
    normalize_indian_mobile,
)
from app.modules.identity.audit import record_audit_event
from app.modules.identity.models import (
    OtpChallenge,
    User,
    UserSession,
    UserStatus,
)
from app.modules.identity.schemas import (
    AVATAR_CODES,
    ConsentRequest,
    OtpRequestResponse,
    ProfileUpdateRequest,
    UserProfileResponse,
)
from app.providers.crypto.base import CryptoProvider
from app.providers.sms.base import OtpMessage, SmsProvider

_DISPLAY_NAME_RE = re.compile(r"^[A-Za-z0-9_]{3,24}$")
_CITY_RE = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,59}$")
_RESERVED_DISPLAY_NAMES = frozenset(
    {
        "admin",
        "administrator",
        "kindly",
        "moderator",
        "support",
        "system",
        "official",
        "help",
        "staff",
    }
)


@dataclass(frozen=True)
class AuthContext:
    user: User
    session: UserSession


@dataclass(frozen=True)
class SessionTokens:
    access_token: str
    refresh_token: str
    csrf_token: str
    expires_in: int
    user: User


class IdentityService:
    def __init__(
        self,
        *,
        settings: Settings,
        session: Session,
        crypto: CryptoProvider,
        sms: SmsProvider,
    ) -> None:
        self.settings = settings
        self.session = session
        self.crypto = crypto
        self.sms = sms

    # ------------------------------------------------------------------
    # OTP
    # ------------------------------------------------------------------
    def request_otp(self, raw_phone: str, request_ip: str | None) -> OtpRequestResponse:
        phone = self._normalize_or_raise(raw_phone)
        now = self._now()
        mobile_hmac = self._mobile_hmac(phone)
        ip_hmac = self._ip_hmac(request_ip)
        window_start = now - timedelta(minutes=self.settings.otp_window_minutes)

        phone_count = self.session.scalar(
            select(func.count(OtpChallenge.id)).where(
                OtpChallenge.mobile_hmac == mobile_hmac,
                OtpChallenge.created_at >= window_start,
            )
        )
        if (phone_count or 0) >= self.settings.otp_phone_limit:
            raise AppError(
                429,
                "RATE_LIMITED",
                "Too many requests",
                "Too many codes requested for this number. Try again later.",
            )

        if ip_hmac is not None:
            ip_count = self.session.scalar(
                select(func.count(OtpChallenge.id)).where(
                    OtpChallenge.request_ip_hmac == ip_hmac,
                    OtpChallenge.created_at >= window_start,
                )
            )
            if (ip_count or 0) >= self.settings.otp_ip_limit:
                raise AppError(
                    429,
                    "RATE_LIMITED",
                    "Too many requests",
                    "Too many codes requested. Try again later.",
                )

        latest_created = self.session.scalar(
            select(func.max(OtpChallenge.created_at)).where(
                OtpChallenge.mobile_hmac == mobile_hmac,
            )
        )
        if latest_created is not None:
            elapsed = (now - latest_created).total_seconds()
            if elapsed < self.settings.otp_resend_seconds:
                raise AppError(
                    429,
                    "RATE_LIMITED",
                    "Please wait",
                    "A code was requested recently. Wait before requesting another.",
                )

        challenge_id = uuid.uuid4()
        code = self.sms.suggest_code() or generate_otp()
        expires_at = now + timedelta(seconds=self.settings.otp_ttl_seconds)
        challenge = OtpChallenge(
            id=challenge_id,
            mobile_encrypted=self.crypto.encrypt(phone, context="identity.mobile"),
            mobile_hmac=mobile_hmac,
            code_hash=hash_otp(
                self.settings.otp_hmac_key.get_secret_value(),
                str(challenge_id),
                code,
            ),
            expires_at=expires_at,
            request_ip_hmac=ip_hmac,
        )
        self.session.add(challenge)
        self._audit(
            "OTP_REQUESTED",
            user_id=None,
            ip_hmac=ip_hmac,
            metadata={"channel": "sms"},
        )
        self.session.commit()

        try:
            self.sms.send_otp(OtpMessage(phone_e164=phone, code=code, expires_at=expires_at))
        except Exception as exc:
            self._audit(
                "OTP_DELIVERY_FAILED",
                user_id=None,
                ip_hmac=ip_hmac,
            )
            self.session.commit()
            raise AppError(
                503,
                "DEPENDENCY_UNAVAILABLE",
                "OTP delivery unavailable",
                "We could not send a code right now. Try again shortly.",
            ) from exc

        return OtpRequestResponse(
            message="If this number can be verified, a code has been sent.",
            expires_in_seconds=self.settings.otp_ttl_seconds,
        )

    def verify_otp(
        self,
        raw_phone: str,
        code: str,
        request_ip: str | None,
        user_agent: str | None,
    ) -> SessionTokens:
        phone = self._normalize_or_raise(raw_phone)
        now = self._now()
        mobile_hmac = self._mobile_hmac(phone)
        ip_hmac = self._ip_hmac(request_ip)

        challenge = self.session.scalar(
            select(OtpChallenge)
            .where(
                OtpChallenge.mobile_hmac == mobile_hmac,
                OtpChallenge.consumed_at.is_(None),
                OtpChallenge.expires_at > now,
            )
            .order_by(OtpChallenge.created_at.desc())
            .with_for_update()
            .limit(1)
        )
        if challenge is None:
            self._audit("OTP_VERIFY_FAILED", None, ip_hmac, {"reason": "missing"})
            self.session.commit()
            raise self._invalid_otp()

        if challenge.attempts >= self.settings.otp_max_attempts:
            self._audit("OTP_VERIFY_FAILED", None, ip_hmac, {"reason": "exhausted"})
            self.session.commit()
            raise AppError(
                429,
                "RATE_LIMITED",
                "Too many attempts",
                "Request a new code and try again.",
            )

        challenge.attempts += 1
        expected = hash_otp(
            self.settings.otp_hmac_key.get_secret_value(),
            str(challenge.id),
            code,
        )
        if not constant_time_equals(expected, challenge.code_hash):
            self._audit("OTP_VERIFY_FAILED", None, ip_hmac, {"reason": "mismatch"})
            self.session.commit()
            raise self._invalid_otp()

        challenge.consumed_at = now

        user = self.session.scalar(
            select(User).where(User.mobile_hmac == mobile_hmac).with_for_update()
        )
        created = False
        if user is None:
            user = User(
                mobile_encrypted=challenge.mobile_encrypted,
                mobile_hmac=mobile_hmac,
                mobile_masked=mask_mobile(phone),
                status=UserStatus.ACTIVE,
                phone_verified_at=now,
                last_authenticated_at=now,
            )
            self.session.add(user)
            try:
                with self.session.begin_nested():
                    self.session.flush()
                created = True
            except IntegrityError:
                user = self.session.scalar(
                    select(User).where(User.mobile_hmac == mobile_hmac).with_for_update()
                )
                if user is None:
                    raise AppError(
                        503,
                        "DEPENDENCY_UNAVAILABLE",
                        "Account unavailable",
                        "We could not load your account. Try again.",
                    ) from None

        if user.phone_verified_at is None:
            user.phone_verified_at = now
        user.last_authenticated_at = now

        tokens = self._issue_session(
            user=user,
            now=now,
            ip_hmac=ip_hmac,
            user_agent=user_agent,
        )
        self._audit(
            "ACCOUNT_CREATED" if created else "OTP_VERIFIED",
            user_id=user.id,
            ip_hmac=ip_hmac,
        )
        self.session.commit()
        return tokens

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------
    def refresh_session(
        self,
        refresh_token: str,
        request_ip: str | None,
        user_agent: str | None,
    ) -> SessionTokens:
        now = self._now()
        ip_hmac = self._ip_hmac(request_ip)
        token_hash = hash_opaque_token(refresh_token)
        session_row = self.session.scalar(
            select(UserSession)
            .where(UserSession.refresh_token_hash == token_hash)
            .with_for_update()
        )
        if session_row is None:
            raise AppError(401, "AUTH_REQUIRED", "Sign in required", "Your session is not valid.")

        if session_row.revoked_at is not None:
            self.session.execute(
                update(UserSession)
                .where(
                    UserSession.family_id == session_row.family_id,
                    UserSession.revoked_at.is_(None),
                )
                .values(revoked_at=now)
            )
            self._audit(
                "SESSION_REUSE_DETECTED",
                user_id=session_row.user_id,
                ip_hmac=ip_hmac,
            )
            self.session.commit()
            raise AppError(
                401,
                "SESSION_EXPIRED",
                "Session expired",
                "Sign in again to continue.",
            )

        if session_row.expires_at <= now:
            session_row.revoked_at = now
            self._audit("SESSION_EXPIRED", session_row.user_id, ip_hmac)
            self.session.commit()
            raise AppError(
                401,
                "SESSION_EXPIRED",
                "Session expired",
                "Sign in again to continue.",
            )

        user = self.session.get(User, session_row.user_id)
        if user is None or user.status in {UserStatus.BANNED, UserStatus.DELETED}:
            session_row.revoked_at = now
            self._audit("SESSION_REVOKED", session_row.user_id, ip_hmac)
            self.session.commit()
            raise AppError(
                403,
                "ACCOUNT_RESTRICTED",
                "Account unavailable",
                "This account cannot be used.",
            )

        new_tokens = self._issue_session(
            user=user,
            now=now,
            ip_hmac=ip_hmac,
            user_agent=user_agent,
            family_id=session_row.family_id,
        )
        session_row.revoked_at = now
        session_row.last_seen_at = now
        session_row.replaced_by_session_id = uuid.UUID(self._session_id_from_tokens(new_tokens))
        self._audit("SESSION_REFRESHED", user_id=user.id, ip_hmac=ip_hmac)
        self.session.commit()
        return new_tokens

    def logout(self, refresh_token: str, request_ip: str | None) -> None:
        now = self._now()
        ip_hmac = self._ip_hmac(request_ip)
        token_hash = hash_opaque_token(refresh_token)
        session_row = self.session.scalar(
            select(UserSession)
            .where(UserSession.refresh_token_hash == token_hash)
            .with_for_update()
        )
        if session_row is not None and session_row.revoked_at is None:
            session_row.revoked_at = now
            self._audit("LOGOUT", user_id=session_row.user_id, ip_hmac=ip_hmac)
            self.session.commit()

    def authenticate(self, access_token: str) -> AuthContext:
        try:
            claims: AccessTokenClaims = decode_access_token(self.settings, access_token)
            session_id = uuid.UUID(claims.session_id)
            user_id = uuid.UUID(claims.user_id)
        except (TokenError, ValueError) as exc:
            raise self._session_expired() from exc

        session_row = self.session.get(UserSession, session_id)
        now = self._now()
        if (
            session_row is None
            or str(session_row.user_id) != claims.user_id
            or session_row.revoked_at is not None
            or session_row.expires_at <= now
        ):
            raise self._session_expired()

        user = self.session.get(User, user_id)
        if user is None or user.status in {UserStatus.BANNED, UserStatus.DELETED}:
            raise AppError(
                403,
                "ACCOUNT_RESTRICTED",
                "Account unavailable",
                "This account cannot be used.",
            )
        return AuthContext(user=user, session=session_row)

    # ------------------------------------------------------------------
    # Consent and profile
    # ------------------------------------------------------------------
    def record_consent(self, user: User, consent: ConsentRequest) -> User:
        now = self._now()
        user.age_confirmed_at = now
        user.terms_accepted_at = now
        user.terms_version = self.settings.legal_policy_version
        user.privacy_accepted_at = now
        user.privacy_version = self.settings.legal_policy_version
        user.guidelines_accepted_at = now
        user.guidelines_version = self.settings.legal_policy_version
        self._audit(
            "CONSENT_RECORDED",
            user_id=user.id,
            metadata={"policyVersion": self.settings.legal_policy_version},
        )
        self.session.commit()
        return user

    def update_profile(self, user: User, update: ProfileUpdateRequest) -> User:
        if any(
            value is None
            for value in (
                user.age_confirmed_at,
                user.terms_accepted_at,
                user.privacy_accepted_at,
                user.guidelines_accepted_at,
            )
        ):
            raise AppError(
                403,
                "CONSENT_REQUIRED",
                "Consent required",
                "Accept the age and policy confirmations before editing your profile.",
            )

        fields = update.model_fields_set

        if "display_name" in fields:
            display_name = (update.display_name or "").strip()
            if not _DISPLAY_NAME_RE.fullmatch(display_name):
                raise AppError(
                    400,
                    "VALIDATION_ERROR",
                    "Invalid display name",
                    "Use 3-24 letters, digits or underscores.",
                )
            normalized = display_name.lower()
            if normalized in _RESERVED_DISPLAY_NAMES or normalized.isdigit():
                raise AppError(
                    400,
                    "VALIDATION_ERROR",
                    "Invalid display name",
                    "Choose a different display name.",
                )
            existing = self.session.scalar(
                select(User.id).where(
                    User.display_name_normalized == normalized,
                    User.id != user.id,
                )
            )
            if existing is not None:
                raise AppError(
                    409,
                    "DISPLAY_NAME_TAKEN",
                    "Display name taken",
                    "Choose a different display name.",
                )
            user.display_name = display_name
            user.display_name_normalized = normalized

        if "avatar" in fields and update.avatar is not None:
            if update.avatar not in AVATAR_CODES:
                raise AppError(
                    400,
                    "VALIDATION_ERROR",
                    "Invalid avatar",
                    "Choose one of the available avatars.",
                )
            user.avatar = update.avatar

        if "city" in fields:
            city = (update.city or "").strip()
            if city == "":
                user.city = None
            else:
                if not _CITY_RE.fullmatch(city):
                    raise AppError(
                        400,
                        "VALIDATION_ERROR",
                        "Invalid city",
                        "Enter a city name between 2 and 60 characters.",
                    )
                user.city = city

        self._audit("PROFILE_UPDATED", user_id=user.id, metadata={"fields": sorted(fields)})
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise AppError(
                409,
                "DISPLAY_NAME_TAKEN",
                "Display name taken",
                "Choose a different display name.",
            ) from exc
        return user

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def profile(self, user: User) -> UserProfileResponse:
        return UserProfileResponse(
            id=user.id,
            display_name=user.display_name,
            avatar=user.avatar,
            city=user.city,
            status=user.status,
            onboarding_required=self._onboarding_required(user),
            karma=0,
            streak=0,
            cooldown_until=None,
            age_confirmed_at=user.age_confirmed_at,
            terms_accepted_at=user.terms_accepted_at,
            privacy_accepted_at=user.privacy_accepted_at,
            guidelines_accepted_at=user.guidelines_accepted_at,
        )

    def _issue_session(
        self,
        *,
        user: User,
        now: datetime,
        ip_hmac: str | None,
        user_agent: str | None,
        family_id: uuid.UUID | None = None,
    ) -> SessionTokens:
        refresh_token = generate_opaque_token()
        session_row = UserSession(
            user_id=user.id,
            family_id=family_id or uuid.uuid4(),
            refresh_token_hash=hash_opaque_token(refresh_token),
            expires_at=now + timedelta(days=self.settings.refresh_token_ttl_days),
            request_ip_hmac=ip_hmac,
            user_agent_hash=self._user_agent_hash(user_agent),
        )
        self.session.add(session_row)
        self.session.flush()

        access_token, _access_expires_at = create_access_token(
            self.settings,
            user_id=str(user.id),
            session_id=str(session_row.id),
            now=now,
        )
        return SessionTokens(
            access_token=access_token,
            refresh_token=refresh_token,
            csrf_token=generate_csrf_token(),
            expires_in=self.settings.access_token_ttl_minutes * 60,
            user=user,
        )

    def _session_id_from_tokens(self, tokens: SessionTokens) -> str:
        claims = decode_access_token(self.settings, tokens.access_token)
        return claims.session_id

    def _onboarding_required(self, user: User) -> bool:
        return any(
            value is None
            for value in (
                user.display_name,
                user.avatar,
                user.age_confirmed_at,
                user.terms_accepted_at,
                user.privacy_accepted_at,
                user.guidelines_accepted_at,
            )
        )

    def _mobile_hmac(self, phone: str) -> str:
        return hmac_sha256_hex(
            self.settings.lookup_hmac_key.get_secret_value(),
            phone,
        )

    def _ip_hmac(self, request_ip: str | None) -> str | None:
        if not request_ip:
            return None
        return hmac_sha256_hex(
            self.settings.lookup_hmac_key.get_secret_value(),
            f"ip:{request_ip}",
        )

    def _user_agent_hash(self, user_agent: str | None) -> str | None:
        if not user_agent:
            return None
        return hmac_sha256_hex(
            self.settings.lookup_hmac_key.get_secret_value(),
            f"ua:{user_agent}",
        )

    def _normalize_or_raise(self, raw_phone: str) -> str:
        try:
            return normalize_indian_mobile(raw_phone)
        except ValueError as exc:
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid mobile number",
                str(exc),
            ) from exc

    def _audit(
        self,
        event_type: str,
        user_id: uuid.UUID | None,
        ip_hmac: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        record_audit_event(
            session=self.session,
            event_type=event_type,
            user_id=user_id,
            request_ip_hmac=ip_hmac,
            metadata=metadata,
        )

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    @staticmethod
    def _invalid_otp() -> AppError:
        return AppError(
            401,
            "INVALID_OTP",
            "Invalid or expired code",
            "Request a new code and try again.",
        )

    @staticmethod
    def _session_expired() -> AppError:
        return AppError(
            401,
            "SESSION_EXPIRED",
            "Session expired",
            "Sign in again to continue.",
        )
