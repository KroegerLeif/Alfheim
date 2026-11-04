"""Household role checks for MCP tools, shared by every app that exposes tools.

GUEST is read-only: apps decorate their writing tools with :func:`mcp_requires_role`.
A denial raises a ``ToolError`` carrying the ``household_role_forbidden`` code, the same
code the REST routes answer with through :func:`backend_shared.household.require_role`.
"""

import functools
from collections.abc import Awaitable, Callable
from typing import Any

from fastmcp.exceptions import ToolError

from backend_shared.household import CODE_HOUSEHOLD_ROLE_FORBIDDEN, HouseholdRole
from backend_shared.mcp_middleware import get_mcp_household_context

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


__all__ = ["ensure_mcp_role", "mcp_requires_role"]
