"""ASGI middleware authorizing MCP requests exactly like HTTP routes (JWT + X-Household-ID + membership API)."""

import contextvars
import logging
from collections.abc import Awaitable, Callable
from typing import Any, Protocol

from fastapi import FastAPI, Request, status
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Route

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

#: Canonical MCP endpoint path; the chat backend's ``CHAT_MCP_SERVERS`` points at ``http://<app>-backend:8000/mcp``.
MCP_ENDPOINT_PATH = "/mcp"

#: Context variable holding the :class:`HouseholdContext` of the current MCP request.
mcp_household_context_var: contextvars.ContextVar[HouseholdContext | None] = contextvars.ContextVar(
    "mcp_household_context", default=None
)


class MCPAuthenticationMiddleware(BaseHTTPMiddleware):
    """Authorize every MCP request through :func:`backend_shared.household.resolve_household_context`.

    Rejections use the same status codes and ``{"detail": {"code", "message"}}``
    bodies as :func:`backend_shared.household.require_household`. On success the
    :class:`HouseholdContext` is stored in the ASGI scope and in
    :data:`mcp_household_context_var`; tools read it with :func:`get_mcp_household_context`.
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
        token = mcp_household_context_var.set(context)
        try:
            return await call_next(request)
        finally:
            mcp_household_context_var.reset(token)


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
    context = _current_mcp_request_context() or mcp_household_context_var.get()
    if context is None:
        raise RuntimeError("Household context not found. Ensure MCPAuthenticationMiddleware wraps the MCP app.")
    return context


class MCPHTTPServer(Protocol):
    """What :func:`mount_mcp` needs from a ``fastmcp.FastMCP`` server."""

    def http_app(self, path: str | None = None) -> Starlette: ...


def mount_mcp(
    app: FastAPI,
    server: MCPHTTPServer,
    *,
    path: str = MCP_ENDPOINT_PATH,
    settings: Any = None,
    membership_lookup: MembershipLookup | None = None,
) -> Starlette:
    """Serve ``server``'s Streamable HTTP endpoint at exactly ``path`` behind :class:`MCPAuthenticationMiddleware`.

    The MCP app is registered as a plain route (not a ``Mount``), so ``POST /mcp`` is
    handled directly: no 307 to ``/mcp/`` and no doubled ``/mcp/mcp`` path. The caller
    **must** run the returned app's lifespan inside its own, otherwise the MCP session
    manager's task group never starts and every request fails::

        mcp_app = mount_mcp(app, mcp, settings=settings)

        @asynccontextmanager
        async def lifespan(app):
            async with mcp_app.router.lifespan_context(mcp_app):
                yield

    Args:
        app: The FastAPI application.
        server: The FastMCP server.
        path: Endpoint path (defaults to :data:`MCP_ENDPOINT_PATH`).
        settings: OIDC settings forwarded to :class:`MCPAuthenticationMiddleware`.
        membership_lookup: Membership lookup override forwarded to the middleware (tests).

    Returns:
        The MCP Starlette app, whose lifespan the caller runs.
    """
    mcp_app = server.http_app(path=path)
    guarded = MCPAuthenticationMiddleware(mcp_app, settings=settings, membership_lookup=membership_lookup)
    app.router.routes.append(Route(path, endpoint=guarded, include_in_schema=False))
    return mcp_app


__all__ = [
    "MCP_ENDPOINT_PATH",
    "MCP_HOUSEHOLD_SCOPE_KEY",
    "MCPAuthenticationMiddleware",
    "MCPHTTPServer",
    "get_mcp_household_context",
    "mcp_household_context_var",
    "mount_mcp",
]
