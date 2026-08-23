"""Authentication and tenant isolation dependencies for maintenance service."""

from typing import Any

import backend_shared.dependencies as _deps
from fastapi import Request

from app.core.config import settings

SAFE_TEST_HOSTS = _deps.SAFE_TEST_HOSTS
SAFE_TEST_SUFFIXES = _deps.SAFE_TEST_SUFFIXES
UserHouseholdContext = _deps.UserHouseholdContext


def is_mock_auth_allowed() -> bool:
    return _deps.is_mock_auth_allowed(settings=settings)


def get_jwks_client(jwks_url: str):
    return _deps.get_jwks_client(jwks_url)


def decode_keycloak_token(token: str) -> dict[str, Any]:
    return _deps.decode_keycloak_token(token, settings=settings)


async def get_current_user_and_household(request: Request) -> UserHouseholdContext:
    return await _deps.get_current_user_and_household(request, settings=settings)
