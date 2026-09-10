"""Authentication and tenant isolation dependencies for the Chores microservice.

This module is a thin adapter over ``backend_shared.dependencies``: all OIDC token
decoding and household (multi-tenant) isolation logic lives in the shared package
so every microservice enforces identical rules. Only the service-specific
``settings`` binding is provided here.
"""

import uuid
from typing import Any

import backend_shared.dependencies as _deps
from fastapi import Depends, Request
from src.core.config import settings

MOCK_USER_ID = _deps.MOCK_USER_ID
MOCK_HOME_ID = _deps.MOCK_HOME_ID
SAFE_TEST_HOSTS = _deps.SAFE_TEST_HOSTS
SAFE_TEST_SUFFIXES = _deps.SAFE_TEST_SUFFIXES
UserHomeContext = _deps.UserHomeContext


def is_mock_auth_allowed() -> bool:
    """Return whether mock authentication is permitted in the current environment."""
    return _deps.is_mock_auth_allowed(settings=settings)


def get_jwks_client(jwks_url: str):
    """Return a cached PyJWKClient for the given JWKS endpoint."""
    return _deps.get_jwks_client(jwks_url)


def decode_keycloak_token(token: str) -> dict[str, Any]:
    """Decode and validate an OIDC JWT using the service settings."""
    return _deps.decode_keycloak_token(token, settings=settings)


async def get_current_user_and_home(request: Request) -> UserHomeContext:
    """Provide the authenticated user and validated household context from the OIDC JWT.

    Enforces X-Household-ID header validation against the authorized JWT claims
    (household_id, active_household_id, or households list) and returns HTTP 403
    when the requested household is not one the user belongs to.
    """
    return await _deps.get_current_user_and_home(request, settings=settings)


async def get_current_household_id(
    context: UserHomeContext = Depends(get_current_user_and_home),
) -> uuid.UUID:
    """Return the validated household UUID for route handler signatures."""
    return context.home_id
