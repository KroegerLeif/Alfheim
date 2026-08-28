"""Authentication and tenant isolation dependencies for the Library microservice."""

import uuid
from typing import Any

import backend_shared.dependencies as _deps
from fastapi import Depends, Request

from src.config import settings

MOCK_USER_ID = _deps.MOCK_USER_ID
MOCK_HOME_ID = _deps.MOCK_HOME_ID
SAFE_TEST_HOSTS = _deps.SAFE_TEST_HOSTS
SAFE_TEST_SUFFIXES = _deps.SAFE_TEST_SUFFIXES
UserHomeContext = _deps.UserHomeContext


def is_mock_auth_allowed() -> bool:
    """Check if mock authentication is permitted in current environment."""
    return _deps.is_mock_auth_allowed(settings=settings)


def get_jwks_client(jwks_url: str):
    """Get PyJWKClient instance for token verification."""
    return _deps.get_jwks_client(jwks_url)


def decode_keycloak_token(token: str) -> dict[str, Any]:
    """Decode and validate Keycloak JWT token using application settings."""
    return _deps.decode_keycloak_token(token, settings=settings)


async def get_current_user_and_home(request: Request) -> UserHomeContext:
    """Dependency injector providing authenticated user and active household context from Keycloak JWT.

    Enforces X-Household-ID header validation against authorized JWT claims
    (household_id, active_household_id, or households list). Returns HTTP 403 Forbidden
    if X-Household-ID is unauthorized.
    """
    return await _deps.get_current_user_and_home(request, settings=settings)


async def get_current_household_id(
    context: UserHomeContext = Depends(get_current_user_and_home),
) -> uuid.UUID:
    """Dependency returning validated household UUID for route handler signatures."""
    return context.home_id
