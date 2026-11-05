"""Household role matrix of the Maintenance routes and MCP tools.

GUEST is read-only: every state-changing route or tool requires MEMBER or higher
(:data:`WRITE_ROLES`). Household-wide configuration and destructive operations on
shared structures additionally require ADMIN or OWNER (:data:`ADMIN_ROLES`).
Routes answer 403 ``household_role_forbidden`` through
:func:`backend_shared.household.require_role`; MCP tools reject the call with a
``ToolError`` carrying the same code.
"""

from backend_shared.household import HouseholdRole, require_role
from backend_shared.mcp_permissions import ensure_mcp_role, mcp_requires_role

WRITE_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN", "MEMBER")
ADMIN_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN")

#: Dependency for state-changing routes (MEMBER, ADMIN, OWNER).
require_writer = require_role(*WRITE_ROLES)
#: Dependency for household-wide configuration and destructive routes (ADMIN, OWNER).
require_admin = require_role(*ADMIN_ROLES)

__all__ = [
    "ADMIN_ROLES",
    "WRITE_ROLES",
    "ensure_mcp_role",
    "mcp_requires_role",
    "require_admin",
    "require_writer",
]
