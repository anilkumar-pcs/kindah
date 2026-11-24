from __future__ import annotations

from app.core.config import Settings
from app.modules.identity.models import User, UserRole


def effective_role(settings: Settings, user: User) -> UserRole:
    """Resolve the effective role.

    ``ADMIN_USER_IDS`` remains a local/test bootstrap allow-list; a database
    role always wins. Production operations should assign DB roles.
    """

    if user.role in {UserRole.MODERATOR, UserRole.ADMIN}:
        return user.role
    if str(user.id) in settings.admin_user_id_list:
        return UserRole.ADMIN
    return UserRole.USER


def has_admin_access(settings: Settings, user: User) -> bool:
    return effective_role(settings, user) in {UserRole.MODERATOR, UserRole.ADMIN}
