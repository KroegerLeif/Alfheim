"""Household role matrix of the Budget routes.

GUEST is read-only: every state-changing route requires MEMBER or higher
(:data:`WRITE_ROLES`). Household-wide configuration and destructive operations on
shared structures additionally require ADMIN or OWNER (:data:`ADMIN_ROLES`).
Denials answer 403 ``household_role_forbidden`` through
:func:`backend_shared.household.require_role`.
"""

from backend_shared.household import HouseholdRole, require_role

WRITE_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN", "MEMBER")
ADMIN_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN")

#: Dependency for state-changing routes (MEMBER, ADMIN, OWNER).
require_writer = require_role(*WRITE_ROLES)
#: Dependency for household-wide configuration and destructive routes (ADMIN, OWNER).
require_admin = require_role(*ADMIN_ROLES)

__all__ = ["ADMIN_ROLES", "WRITE_ROLES", "require_admin", "require_writer"]
