import logging
import os
from urllib.parse import urlparse

import jwt
from fastapi import HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

SAFE_TEST_HOSTS = {
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "test",
    "testserver",
    "postgres",
    "keycloak",
    "alfheim_keycloak",
    "pantry-backend",
    "shopping-backend",
    "chores-backend",
    "maintenance-backend",
}

SAFE_TEST_SUFFIXES = (
    ".localhost",
    ".test",
    ".local",
    ".internal",
    ".loegien.localhost",
)


class UserHouseholdContext(BaseModel):
    user_id: str
    household_id: int | None = None
    email: str | None = None
    username: str | None = None
    roles: list[str] = []


_jwks_clients: dict[str, jwt.PyJWKClient] = {}


def _is_safe_test_url(url: str | None) -> bool:
    """Validate that a URL points to a local or container test service, not remote production infrastructure."""
    if not url:
        return True
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        if not hostname:
            return True
        if hostname in SAFE_TEST_HOSTS:
            return True
        if any(hostname.endswith(suffix) for suffix in SAFE_TEST_SUFFIXES):
            return True
        return False
    except Exception:
        return False


def is_mock_auth_allowed() -> bool:
    """
    Ensure mock authentication and test token bypass are strictly constrained to explicit
    test execution contexts and disabled when production/staging environments or non-localhost
    production URLs are detected.
    """
    env = (settings.ENVIRONMENT or "").strip().lower()
    # 1. Strictly forbid mock auth fallbacks in production or staging environments
    if env in ("production", "prod", "staging", "stage"):
        return False

    # 2. Must be running in an explicit test runner or testing environment
    is_explicit_test = bool(os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING") == "true")
    if not is_explicit_test and env != "testing":
        return False

    # 3. Guard against non-localhost production database or Keycloak URLs
    if not _is_safe_test_url(getattr(settings, "DATABASE_URL", None)):
        logger.error(
            "Mock auth rejected: non-localhost/unsafe DATABASE_URL detected: %s",
            settings.DATABASE_URL,
        )
        return False

    if not _is_safe_test_url(getattr(settings, "KEYCLOAK_URL", None)):
        logger.error(
            "Mock auth rejected: non-localhost/unsafe KEYCLOAK_URL detected: %s",
            settings.KEYCLOAK_URL,
        )
        return False

    if not _is_safe_test_url(getattr(settings, "KEYCLOAK_PUBLIC_URL", None)):
        logger.error(
            "Mock auth rejected: non-localhost/unsafe KEYCLOAK_PUBLIC_URL detected: %s",
            settings.KEYCLOAK_PUBLIC_URL,
        )
        return False

    return True


def get_jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    if jwks_url not in _jwks_clients:
        _jwks_clients[jwks_url] = jwt.PyJWKClient(jwks_url)
    return _jwks_clients[jwks_url]


def decode_keycloak_token(token: str) -> dict:
    if is_mock_auth_allowed():
        try:
            logger.debug("Decoding Keycloak token without signature verification in test context.")
            return jwt.decode(token, options={"verify_signature": False, "verify_aud": False, "verify_iss": False})
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"invalid or expired token: {e}",
            )

    last_error = None
    for jwks_url in settings.jwks_fallback_urls:
        try:
            jwks_client = get_jwks_client(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "HS256"],
                issuer=settings.expected_issuer,
                options={"verify_aud": False, "verify_iss": True},
            )
        except HTTPException:
            raise
        except Exception as e:
            last_error = e

    logger.warning(f"Keycloak JWT validation failed across endpoints: {last_error}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"invalid or expired token: {last_error}",
    )


async def get_current_user_and_household(request: Request) -> UserHouseholdContext:
    """Dependency injector providing authenticated user and household context from Keycloak JWT."""
    auth_header = request.headers.get("Authorization")
    header_hh = request.headers.get("X-Household-ID")

    if not auth_header:
        if is_mock_auth_allowed():
            parsed_mock_hh: int | None = 1
            if header_hh:
                try:
                    parsed_mock_hh = int(header_hh)
                except (ValueError, TypeError):
                    parsed_mock_hh = None
            logger.warning(
                "Mock auth fallback context injected for testing context. User: test-user, Household: %s",
                parsed_mock_hh,
            )
            return UserHouseholdContext(user_id="test-user", household_id=parsed_mock_hh)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing authorization header",
        )

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid authorization header format",
        )

    raw_token = parts[1]
    payload = decode_keycloak_token(raw_token)

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing sub claim in token",
        )

    # Collect all authorized household IDs from verified JWT claims
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

    selected_hh_str: str | None = None

    if header_hh:
        header_hh_clean = header_hh.strip().lower()
        if allowed_households:
            if header_hh_clean not in allowed_households:
                logger.warning(
                    "Cross-tenant IDOR blocked: header X-Household-ID '%s' not in user's token household claims: %s",
                    header_hh,
                    allowed_households,
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: user is not a member of the requested household",
                )
            selected_hh_str = header_hh
        else:
            if is_mock_auth_allowed():
                selected_hh_str = header_hh
            else:
                logger.warning(
                    "Cross-tenant IDOR blocked: header X-Household-ID '%s' supplied but no household claims present in token.",
                    header_hh,
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: user is not a member of the requested household",
                )
    else:
        if primary_hh is not None:
            selected_hh_str = str(primary_hh)
        elif allowed_households:
            selected_hh_str = next(iter(allowed_households))
        else:
            if is_mock_auth_allowed():
                logger.warning("Mock household fallback context injected for testing context. Household: 1")
                selected_hh_str = "1"
            else:
                parsed_hh_id = None

    parsed_hh_id: int | None = None
    if selected_hh_str is not None:
        try:
            parsed_hh_id = int(selected_hh_str)
        except (ValueError, TypeError):
            parsed_hh_id = None

    roles = payload.get("realm_access", {}).get("roles", [])

    return UserHouseholdContext(
        user_id=sub,
        household_id=parsed_hh_id,
        email=payload.get("email"),
        username=payload.get("preferred_username"),
        roles=roles,
    )
