"""Household role matrix shared by the app routes.

GUEST is read-only: every state-changing route requires MEMBER or higher (:data:`WRITE_ROLES`).
Household-wide configuration and destructive operations on shared structures additionally
require ADMIN or OWNER (:data:`ADMIN_ROLES`). The role comes from the membership API through
:func:`backend_shared.household.require_household`, never from a JWT claim; denials answer 403
``household_role_forbidden``. MCP tools use the same tuples with
:func:`backend_shared.mcp_permissions.mcp_requires_role`.
"""

from backend_shared.household import HouseholdRole, require_role

WRITE_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN", "MEMBER")
ADMIN_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN")

#: Dependency for state-changing routes (MEMBER, ADMIN, OWNER).
require_writer = require_role(*WRITE_ROLES)
#: Dependency for household-wide configuration and destructive routes (ADMIN, OWNER).
require_admin = require_role(*ADMIN_ROLES)

__all__ = ["ADMIN_ROLES", "WRITE_ROLES", "require_admin", "require_writer"]
