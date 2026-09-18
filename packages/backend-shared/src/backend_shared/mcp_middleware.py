"""ASGI middleware authorizing MCP requests exactly like HTTP routes (JWT + X-Household-ID + membership API)."""

import contextvars
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# UserHouseholdContext is re-exported only for app tests that still import it from here (deprecated).
from backend_shared.dependencies import UserHouseholdContext
from backend_shared.household import (
    HOUSEHOLD_HEADER,
    HouseholdAuthError,
    HouseholdContext,
    MembershipLookup,
    get_auth_settings,
    get_membership_client,
    resolve_household_context,
)

logger = logging.getLogger(__name__)

#: Key under which the middleware stores the :class:`HouseholdContext` in the ASGI scope.
MCP_HOUSEHOLD_SCOPE_KEY = "alfheim.household_context"

#: Context variable holding the :class:`HouseholdContext` of the current MCP request.
#: Typed ``Any`` only while app tests still store legacy ``UserHouseholdContext`` objects in it;
#: narrow to ``HouseholdContext | None`` once every app is migrated.
mcp_user_context: contextvars.ContextVar[Any] = contextvars.ContextVar("mcp_user_context", default=None)


class MCPAuthenticationMiddleware(BaseHTTPMiddleware):
    """Authorize every MCP request through :func:`backend_shared.household.resolve_household_context`.

    Rejections use the same status codes and ``{"detail": {"code", "message"}}``
    bodies as :func:`backend_shared.household.require_household`. On success the
    :class:`HouseholdContext` is stored in the ASGI scope and in
    :data:`mcp_user_context`; tools read it with :func:`get_mcp_user_context`.
    """

    def __init__(self, app: Any, settings: Any = None, membership_lookup: MembershipLookup | None = None) -> None:
        """Wrap ``app``.

        Args:
            app: The MCP ASGI application.
            settings: OIDC settings for JWT validation (defaults to ``configure_household_auth``'s).
            membership_lookup: Membership lookup override (tests); defaults to the shared client.
        """
        super().__init__(app)
        self.settings = settings
        self.membership_lookup = membership_lookup

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Any]]) -> Any:
        settings = self.settings if self.settings is not None else get_auth_settings()
        lookup = self.membership_lookup if self.membership_lookup is not None else get_membership_client()
        try:
            context = await resolve_household_context(
                request.headers.get("Authorization"),
                request.headers.get(HOUSEHOLD_HEADER),
                settings=settings,
                lookup=lookup,
            )
        except HouseholdAuthError as e:
            logger.warning("MCP request rejected: %s (%s)", e.code, e.message)
            return e.to_response()
        except Exception:
            logger.exception("Unexpected error while authorizing an MCP request")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": {"code": "internal_error", "message": "internal server error"}},
            )

        request.scope[MCP_HOUSEHOLD_SCOPE_KEY] = context
        token = mcp_user_context.set(context)
        try:
            return await call_next(request)
        finally:
            mcp_user_context.reset(token)


def _current_mcp_request_context() -> HouseholdContext | None:
    """Return the context stored on the HTTP request currently handled by the MCP SDK, if any.

    Stateful MCP sessions run tools in a long-lived session task whose context
    variables were copied from the session's *first* request, so the per-request
    ASGI scope is the authoritative source whenever the MCP SDK exposes it.
    """
    try:
        from mcp.server.lowlevel.server import request_ctx
    except ImportError:  # pragma: no cover - the MCP SDK is installed wherever MCP tools run
        return None
    try:
        request = request_ctx.get().request
    except LookupError:
        return None
    scope = getattr(request, "scope", None)
    context = scope.get(MCP_HOUSEHOLD_SCOPE_KEY) if isinstance(scope, dict) else None
    return context if isinstance(context, HouseholdContext) else None


def get_mcp_household_context() -> HouseholdContext:
    """Return the :class:`HouseholdContext` of the current MCP request (use this in tool code).

    Raises:
        RuntimeError: If no context was injected by :class:`MCPAuthenticationMiddleware`.
    """
    context = _current_mcp_request_context() or mcp_user_context.get()
    if not isinstance(context, HouseholdContext):
        raise RuntimeError("Household context not found. Ensure MCPAuthenticationMiddleware wraps the MCP app.")
    return context


def get_mcp_user_context() -> Any:
    """Deprecated alias kept while apps migrate; returns the same object as :func:`get_mcp_household_context`.

    At runtime the value is a :class:`HouseholdContext` (UUID ``household_id``/``user_id``).
    It is typed ``Any`` only so not-yet-migrated tool code still type-checks; switch to
    :func:`get_mcp_household_context` and this alias will be removed.
    """
    context = _current_mcp_request_context() or mcp_user_context.get()
    if context is None:
        raise RuntimeError("Household context not found. Ensure MCPAuthenticationMiddleware wraps the MCP app.")
    return context


__all__ = [
    "MCP_HOUSEHOLD_SCOPE_KEY",
    "MCPAuthenticationMiddleware",
    "UserHouseholdContext",
    "get_mcp_household_context",
    "get_mcp_user_context",
    "mcp_user_context",
]
