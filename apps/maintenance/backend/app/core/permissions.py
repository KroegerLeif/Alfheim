"""Household role matrix of the Maintenance routes and MCP tools.

GUEST is read-only: every state-changing route or tool requires MEMBER or higher
(:data:`WRITE_ROLES`). Household-wide configuration and destructive operations on
shared structures additionally require ADMIN or OWNER (:data:`ADMIN_ROLES`).
Routes answer 403 ``household_role_forbidden`` through
:func:`backend_shared.household.require_role`; MCP tools reject the call with a
``ToolError`` carrying the same code.
"""

import functools
from collections.abc import Awaitable, Callable
from typing import Any

from backend_shared.household import CODE_HOUSEHOLD_ROLE_FORBIDDEN, HouseholdRole, require_role
from backend_shared.mcp_middleware import get_mcp_household_context
from fastmcp.exceptions import ToolError

WRITE_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN", "MEMBER")
ADMIN_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN")

#: Dependency for state-changing routes (MEMBER, ADMIN, OWNER).
require_writer = require_role(*WRITE_ROLES)
#: Dependency for household-wide configuration and destructive routes (ADMIN, OWNER).
require_admin = require_role(*ADMIN_ROLES)

ToolFunction = Callable[..., Awaitable[Any]]


def ensure_mcp_role(roles: tuple[HouseholdRole, ...]) -> None:
    """Raise ``ToolError`` unless the current MCP caller has one of ``roles`` in the household.

    Raises:
        ToolError: The caller's role is not in ``roles`` (code ``household_role_forbidden``).
        RuntimeError: No household context was injected by the MCP authentication middleware.
    """
    if get_mcp_household_context().role not in roles:
        raise ToolError(
            f"{CODE_HOUSEHOLD_ROLE_FORBIDDEN}: this action requires one of the roles: {', '.join(sorted(roles))}"
        )


def mcp_requires_role(*roles: HouseholdRole) -> Callable[[ToolFunction], ToolFunction]:
    """Decorator for MCP tools: run the tool only when the caller has one of ``roles``.

    Apply it below ``@mcp.tool()``. The check runs before the tool body, so a denial
    is never swallowed by the tool's own error handling.
    """
    if not roles:
        raise ValueError("mcp_requires_role() needs at least one role")

    def decorator(tool: ToolFunction) -> ToolFunction:
        @functools.wraps(tool)
        async def guarded(*args: Any, **kwargs: Any) -> Any:
            ensure_mcp_role(roles)
            return await tool(*args, **kwargs)

        return guarded

    return decorator


__all__ = [
    "ADMIN_ROLES",
    "WRITE_ROLES",
    "ensure_mcp_role",
    "mcp_requires_role",
    "require_admin",
    "require_writer",
]
