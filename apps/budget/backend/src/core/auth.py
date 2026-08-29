"""Authentication and tenant isolation dependencies for the Budget service."""

import uuid

import backend_shared.dependencies as _deps
from fastapi import Request
from pydantic import BaseModel
from src.core.config import settings


class TenantContext(BaseModel):
    """Context object representing the authenticated user and tenant (household)."""

    user_id: uuid.UUID
    household_id: uuid.UUID
    email: str | None = None
    username: str | None = None
    roles: list[str] = []


async def get_current_tenant(request: Request) -> TenantContext:
    """Extract and validate tenant isolation context from request headers and JWT claims.

    Validates X-Household-ID header against Keycloak token claims.
    Returns HTTP 401 for unauthenticated/invalid requests and HTTP 403 for household mismatches.
    """
    user_home_ctx = await _deps.get_current_user_and_home(request, settings=settings)
    return TenantContext(
        user_id=user_home_ctx.user_id,
        household_id=user_home_ctx.home_id,
        email=user_home_ctx.email,
        username=user_home_ctx.username,
        roles=user_home_ctx.roles,
    )


__all__ = ["TenantContext", "get_current_tenant"]
