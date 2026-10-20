"""Household role matrix of the Library routes.

GUEST is read-only: every state-changing route requires MEMBER or higher
(:data:`WRITE_ROLES`). Household-wide configuration and destructive operations on
shared structures additionally require ADMIN or OWNER (:data:`ADMIN_ROLES`).
Denials answer 403 ``household_role_forbidden`` through
:func:`backend_shared.household.require_role`.
"""

import uuid

from backend_shared.household import HouseholdContext, HouseholdRole, require_role
from fastapi import Depends

WRITE_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN", "MEMBER")
ADMIN_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN")

#: Dependency for state-changing routes (MEMBER, ADMIN, OWNER).
require_writer = require_role(*WRITE_ROLES)
#: Dependency for household-wide configuration and destructive routes (ADMIN, OWNER).
require_admin = require_role(*ADMIN_ROLES)


async def get_writer_household_id(context: HouseholdContext = Depends(require_writer)) -> uuid.UUID:
    """Household UUID of a caller allowed to change household data (MEMBER or higher)."""
    return context.household_id


async def get_admin_household_id(context: HouseholdContext = Depends(require_admin)) -> uuid.UUID:
    """Household UUID of a caller allowed to change household-wide configuration (ADMIN or OWNER)."""
    return context.household_id


__all__ = [
    "ADMIN_ROLES",
    "WRITE_ROLES",
    "get_admin_household_id",
    "get_writer_household_id",
    "require_admin",
    "require_writer",
]
