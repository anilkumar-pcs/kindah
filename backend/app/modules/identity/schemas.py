from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.core.schemas import ApiModel
from app.modules.identity.models import UserStatus

AvatarCode = Literal["SPARK", "CHAI", "SUN", "LEAF", "MOON", "HEART"]
AVATAR_CODES: frozenset[str] = frozenset({"SPARK", "CHAI", "SUN", "LEAF", "MOON", "HEART"})


class OtpRequest(ApiModel):
    phone: str = Field(min_length=8, max_length=24)


class OtpRequestResponse(ApiModel):
    message: str
    expires_in_seconds: int


class OtpVerifyRequest(ApiModel):
    phone: str = Field(min_length=8, max_length=24)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ConsentRequest(ApiModel):
    age_confirmed: bool
    terms_accepted: bool
    privacy_accepted: bool
    guidelines_accepted: bool

    @model_validator(mode="after")
    def all_confirmations_required(self) -> ConsentRequest:
        if not all(
            (
                self.age_confirmed,
                self.terms_accepted,
                self.privacy_accepted,
                self.guidelines_accepted,
            )
        ):
            raise ValueError("All age and policy confirmations are required")
        return self


class ProfileUpdateRequest(ApiModel):
    display_name: str | None = None
    avatar: AvatarCode | None = None
    city: str | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> ProfileUpdateRequest:
        if not self.model_fields_set:
            raise ValueError("At least one profile field is required")
        if "display_name" in self.model_fields_set and self.display_name is None:
            raise ValueError("displayName cannot be null")
        if "avatar" in self.model_fields_set and self.avatar is None:
            raise ValueError("avatar cannot be null")
        return self


class UserProfileResponse(ApiModel):
    id: UUID
    display_name: str | None
    avatar: str | None
    city: str | None
    status: UserStatus
    onboarding_required: bool
    karma: int = 0
    streak: int = 0
    cooldown_until: datetime | None = None
    age_confirmed_at: datetime | None
    terms_accepted_at: datetime | None
    privacy_accepted_at: datetime | None
    guidelines_accepted_at: datetime | None


class SessionResponse(ApiModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserProfileResponse


class MessageResponse(ApiModel):
    message: str
