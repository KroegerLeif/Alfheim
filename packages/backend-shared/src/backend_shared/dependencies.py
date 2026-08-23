import logging
import os
import uuid
from typing import Any
from urllib.parse import urlparse

import jwt
from fastapi import HTTPException, Request, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

MOCK_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
MOCK_HOME_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")

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


class UserHomeContext(BaseModel):
    user_id: uuid.UUID
    home_id: uuid.UUID
    email: str | None = None
    username: str | None = None
    roles: list[str] = []


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
    except (ValueError, AttributeError) as e:
        logger.warning("Failed to parse test URL '%s': %s", url, e)
        return False


def is_mock_auth_allowed(settings: Any = None) -> bool:
    """Ensure mock authentication and test token bypass are strictly constrained to explicit test execution contexts."""
    env = (getattr(settings, "ENVIRONMENT", os.getenv("ENVIRONMENT", "")) or "").strip().lower()
    if env in ("production", "prod", "staging", "stage"):
        return False

    is_explicit_test = bool(os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING") == "true")
    if not is_explicit_test and env != "testing":
        return False

    if settings:
        if not _is_safe_test_url(getattr(settings, "DATABASE_URL", None)):
            logger.error(
                "Mock auth rejected: non-localhost/unsafe DATABASE_URL detected: %s",
                getattr(settings, "DATABASE_URL", None),
            )
            return False

        if not _is_safe_test_url(getattr(settings, "KEYCLOAK_URL", None)):
            logger.error(
                "Mock auth rejected: non-localhost/unsafe KEYCLOAK_URL detected: %s",
                getattr(settings, "KEYCLOAK_URL", None),
            )
            return False

        if not _is_safe_test_url(getattr(settings, "KEYCLOAK_PUBLIC_URL", None)):
            logger.error(
                "Mock auth rejected: non-localhost/unsafe KEYCLOAK_PUBLIC_URL detected: %s",
                getattr(settings, "KEYCLOAK_PUBLIC_URL", None),
            )
            return False

    return True


def get_jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    if jwks_url not in _jwks_clients:
        _jwks_clients[jwks_url] = jwt.PyJWKClient(jwks_url)
    return _jwks_clients[jwks_url]


def decode_keycloak_token(token: str, settings: Any = None) -> dict:
    if is_mock_auth_allowed(settings):
        try:
            logger.debug("Decoding Keycloak token without signature verification in test context.")
            return jwt.decode(token, options={"verify_signature": False, "verify_aud": False, "verify_iss": False})
        except jwt.PyJWTError as e:
            logger.warning("Mock JWT decoding failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"invalid or expired token: {e}",
            )

    last_error = None
    fallback_urls = getattr(settings, "jwks_fallback_urls", []) if settings else []
    expected_issuer = getattr(settings, "expected_issuer", None) if settings else None

    for jwks_url in fallback_urls:
        try:
            jwks_client = get_jwks_client(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "HS256"],
                issuer=expected_issuer,
                options={"verify_aud": False, "verify_iss": bool(expected_issuer)},
            )
        except HTTPException:
            raise
        except (jwt.PyJWTError, ValueError) as e:
            logger.warning("Keycloak token verification attempt failed for endpoint %s: %s", jwks_url, e)
            last_error = e

    logger.warning("Keycloak JWT validation failed across endpoints: %s", last_error)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"invalid or expired token: {last_error}",
    )


async def get_current_user_and_home(request: Request, settings: Any = None) -> UserHomeContext:
    """Dependency injector providing authenticated user and active household context from Keycloak JWT (UUID home_id)."""
    auth_header = request.headers.get("Authorization")
    header_hh = request.headers.get("X-Household-ID")

    if not auth_header:
        if is_mock_auth_allowed(settings):
            home_id = uuid.UUID(header_hh) if header_hh else MOCK_HOME_ID
            logger.warning(
                "Mock auth fallback context injected for testing context. User: %s, Household: %s",
                MOCK_USER_ID,
                home_id,
            )
            return UserHomeContext(user_id=MOCK_USER_ID, home_id=home_id)
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
    payload = decode_keycloak_token(raw_token, settings=settings)

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing sub claim in token",
        )

    try:
        user_id = uuid.UUID(sub)
    except ValueError:
        user_id = uuid.uuid5(uuid.NAMESPACE_DNS, sub)

    allowed_households: set[str] = set()

    primary_hh = payload.get("household_id") or payload.get("active_household_id")
    if primary_hh:
        allowed_households.add(str(primary_hh).lower())

    raw_households = payload.get("households")
    if isinstance(raw_households, list):
        for item in raw_households:
            if isinstance(item, str) and item:
                allowed_households.add(item.lower())
            elif isinstance(item, dict):
                hh_id = item.get("id") or item.get("household_id")
                if hh_id:
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
            if is_mock_auth_allowed(settings):
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
        if primary_hh:
            selected_hh_str = str(primary_hh)
        elif allowed_households:
            selected_hh_str = next(iter(allowed_households))
        else:
            if is_mock_auth_allowed(settings):
                logger.warning(
                    "Mock household fallback context injected for testing context. Home: %s",
                    MOCK_HOME_ID,
                )
                selected_hh_str = str(MOCK_HOME_ID)
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="missing household context (X-Household-ID or token claim)",
                )

    try:
        home_id = uuid.UUID(selected_hh_str)
    except ValueError:
        home_id = uuid.uuid5(uuid.NAMESPACE_DNS, selected_hh_str)

    roles = payload.get("realm_access", {}).get("roles", [])

    return UserHomeContext(
        user_id=user_id,
        home_id=home_id,
        email=payload.get("email"),
        username=payload.get("preferred_username"),
        roles=roles,
    )


async def get_current_user_and_household(request: Request, settings: Any = None) -> UserHouseholdContext:
    """Dependency injector providing authenticated user and household context from Keycloak JWT (integer household_id)."""
    auth_header = request.headers.get("Authorization")
    header_hh = request.headers.get("X-Household-ID")

    if not auth_header:
        if is_mock_auth_allowed(settings):
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
    payload = decode_keycloak_token(raw_token, settings=settings)

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing sub claim in token",
        )

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
            if is_mock_auth_allowed(settings):
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
            if is_mock_auth_allowed(settings):
                logger.warning("Mock household fallback context injected for testing context. Household: 1")
                selected_hh_str = "1"
            else:
                selected_hh_str = None

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
