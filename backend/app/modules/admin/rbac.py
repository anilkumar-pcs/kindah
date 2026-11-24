from __future__ import annotations

from app.modules.identity.models import User, UserRole


def effective_role(user: User) -> UserRole:
    """The database role is the sole authorization source."""

    return user.role


def has_admin_access(user: User) -> bool:
    return effective_role(user) in {UserRole.MODERATOR, UserRole.ADMIN}
