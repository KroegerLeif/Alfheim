"""ASGI middleware for MCP endpoint authentication and context injection."""

import contextvars
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from backend_shared.dependencies import UserHouseholdContext, decode_oidc_token, is_mock_auth_allowed

logger = logging.getLogger(__name__)

# Context variable to store authenticated user context across async boundaries
mcp_user_context: contextvars.ContextVar[UserHouseholdContext | None] = contextvars.ContextVar(
    "mcp_user_context", default=None
)


class MCPAuthenticationMiddleware(BaseHTTPMiddleware):
    """ASGI middleware that enforces authentication on MCP endpoints and injects user context.

    This middleware:
    1. Requires a valid JWT token in the Authorization header
    2. Validates the token signature and claims
    3. Extracts authenticated user and household context
    4. Stores the context in request scope for MCP tools to access
    5. Enforces tenant isolation by validating requested household against token claims
    """

    def __init__(self, app: Any, settings: Any = None) -> None:
        """Initialize the middleware with optional settings for OIDC configuration.

        Args:
            app: The ASGI application to wrap
            settings: Optional settings object containing OIDC configuration
        """
        super().__init__(app)
        self.settings = settings

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Any]]
    ) -> Any:
        """Process the request, enforce authentication, and inject user context."""
        try:
            auth_header = request.headers.get("Authorization")

            # Require Authorization header
            if not auth_header:
                if is_mock_auth_allowed(self.settings):
                    # For testing: allow mock auth
                    user_context = UserHouseholdContext(
                        user_id="test-user",
                        household_id=1,
                    )
                    request.scope["user_context"] = user_context
                    mcp_user_context.set(user_context)
                    return await call_next(request)

                logger.warning("MCP request without authorization header")
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "missing authorization header"},
                )

            # Parse Bearer token
            parts = auth_header.split()
            if len(parts) != 2 or parts[0].lower() != "bearer":
                logger.warning("MCP request with invalid authorization header format")
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "invalid authorization header format"},
                )

            raw_token = parts[1]

            # Decode and validate JWT
            try:
                payload = decode_oidc_token(raw_token, settings=self.settings)
            except HTTPException as e:
                logger.warning(f"JWT validation failed: {e.detail}")
                return JSONResponse(
                    status_code=e.status_code,
                    content={"detail": e.detail},
                )

            sub = payload.get("sub")
            if not sub:
                logger.warning("JWT missing sub claim")
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "missing sub claim in token"},
                )

            # Extract allowed households from token
            allowed_households: set[str] = set()

            primary_hh = payload.get("household_id") or payload.get("active_household_id")
            if primary_hh is not None:
                allowed_households.add(str(primary_hh).lower())

            raw_households = payload.get("households")
            if isinstance(raw_households, list):
                for item in raw_households:
                    if isinstance(item, (str, int)) and item:
                        allowed_households.add(str(item).lower())
                    elif isinstance(item, dict):
                        hh_id = item.get("id") or item.get("household_id")
                        if hh_id is not None:
                            allowed_households.add(str(hh_id).lower())

            # Determine selected household
            selected_hh_str: str | None = None
            header_hh = request.headers.get("X-Household-ID")

            if header_hh:
                header_hh_clean = header_hh.strip().lower()
                if allowed_households:
                    if header_hh_clean not in allowed_households:
                        logger.warning(
                            f"Cross-tenant IDOR blocked: X-Household-ID '{header_hh}' "
                            f"not in user's token households: {allowed_households}"
                        )
                        return JSONResponse(
                            status_code=status.HTTP_403_FORBIDDEN,
                            content={"detail": "Forbidden: user is not a member of the requested household"},
                        )
                    selected_hh_str = header_hh
                else:
                    if is_mock_auth_allowed(self.settings):
                        selected_hh_str = header_hh
                    else:
                        logger.warning(
                            f"Cross-tenant IDOR blocked: X-Household-ID '{header_hh}' "
                            "supplied but no household claims in token"
                        )
                        return JSONResponse(
                            status_code=status.HTTP_403_FORBIDDEN,
                            content={"detail": "Forbidden: user is not a member of the requested household"},
                        )
            else:
                if primary_hh is not None:
                    selected_hh_str = str(primary_hh)
                elif allowed_households:
                    selected_hh_str = next(iter(allowed_households))
                else:
                    if is_mock_auth_allowed(self.settings):
                        selected_hh_str = "1"
                    else:
                        logger.warning(
                            "MCP request missing household context "
                            "(X-Household-ID header or token claim)"
                        )
                        return JSONResponse(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            content={"detail": "missing household context"},
                        )

            # Parse household ID as integer
            parsed_hh_id: int | None = None
            if selected_hh_str is not None:
                try:
                    parsed_hh_id = int(selected_hh_str)
                except (ValueError, TypeError):
                    logger.warning(f"Failed to parse household ID: {selected_hh_str}")
                    parsed_hh_id = None

            # Create and inject user context
            user_context = UserHouseholdContext(
                user_id=sub,
                household_id=parsed_hh_id,
                email=payload.get("email"),
                username=payload.get("preferred_username"),
                roles=payload.get("realm_access", {}).get("roles", []),
            )

            # Store in both request scope and context variable
            request.scope["user_context"] = user_context
            mcp_user_context.set(user_context)

            return await call_next(request)

        except Exception as e:
            logger.error(f"Unexpected error in MCP authentication middleware: {e}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Internal server error"},
            )


def get_mcp_user_context() -> UserHouseholdContext:
    """Extract the authenticated user context from the context variable.

    This function is used by MCP tools to access the authenticated user
    and household context that was injected by MCPAuthenticationMiddleware.

    Returns:
        UserHouseholdContext with authenticated user and household information

    Raises:
        RuntimeError: If the context was not injected by the middleware
    """
    context = mcp_user_context.get()
    if not context:
        raise RuntimeError(
            "User context not found. "
            "Ensure MCPAuthenticationMiddleware is applied to the MCP app."
        )
    return context
