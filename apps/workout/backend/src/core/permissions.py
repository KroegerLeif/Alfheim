"""Household role matrix of the Workout routes and MCP tools.

Plans, sessions, favorites and exercise preferences are personal to the calling user and
stay available to every role, GUEST included. Only the shared catalogs (equipment and
exercises) have a household-wide part: entries with ``scope=household`` are household
configuration, so changing them requires MEMBER or higher (:data:`WRITE_ROLES`) and
deleting them requires ADMIN or OWNER (:data:`ADMIN_ROLES`). Entries with ``scope=user``
are personal and open to every role. Routes answer 403 ``household_role_forbidden`` like
:func:`backend_shared.household.require_role`; MCP tools reject the call with a
``ToolError`` carrying the same code.
"""

from enum import Enum

from backend_shared.household import (
    CODE_HOUSEHOLD_ROLE_FORBIDDEN,
    HouseholdAuthError,
    HouseholdContext,
    HouseholdRole,
)
from backend_shared.mcp_middleware import get_mcp_household_context
from fastapi import status
from fastmcp.exceptions import ToolError

WRITE_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN", "MEMBER")
ADMIN_ROLES: tuple[HouseholdRole, ...] = ("OWNER", "ADMIN")

HOUSEHOLD_SCOPE = "household"


def _forbidden_message(roles: tuple[HouseholdRole, ...]) -> str:
    return f"this action requires one of the roles: {', '.join(sorted(roles))}"


def _required_roles(scope: str | Enum, destructive: bool) -> tuple[HouseholdRole, ...] | None:
    """Roles allowed to change a catalog entry of ``scope``; ``None`` when every role may (personal entries)."""
    value = scope.value if isinstance(scope, Enum) else scope
    if value != HOUSEHOLD_SCOPE:
        return None
    return ADMIN_ROLES if destructive else WRITE_ROLES


def ensure_catalog_write(context: HouseholdContext, scope: str | Enum, *, destructive: bool = False) -> None:
    """Route guard: raise 403 ``household_role_forbidden`` unless ``context.role`` may change an entry of ``scope``.

    Args:
        context: The authenticated household context.
        scope: The entry's scope (``system``, ``household`` or ``user``).
        destructive: Whether the change deletes the entry (needs ADMIN or OWNER for household entries).
    """
    roles = _required_roles(scope, destructive)
    if roles is not None and context.role not in roles:
        raise HouseholdAuthError(
            status.HTTP_403_FORBIDDEN, CODE_HOUSEHOLD_ROLE_FORBIDDEN, _forbidden_message(roles)
        ).to_http_exception()


def ensure_mcp_catalog_write(scope: str | Enum, *, destructive: bool = False) -> None:
    """MCP tool guard: like :func:`ensure_catalog_write`, for the caller of the current MCP request.

    Raises:
        ToolError: The caller's role may not change an entry of ``scope``.
        RuntimeError: No household context was injected by the MCP authentication middleware.
    """
    roles = _required_roles(scope, destructive)
    if roles is not None and get_mcp_household_context().role not in roles:
        raise ToolError(f"{CODE_HOUSEHOLD_ROLE_FORBIDDEN}: {_forbidden_message(roles)}")


__all__ = [
    "ADMIN_ROLES",
    "HOUSEHOLD_SCOPE",
    "WRITE_ROLES",
    "ensure_catalog_write",
    "ensure_mcp_catalog_write",
]
