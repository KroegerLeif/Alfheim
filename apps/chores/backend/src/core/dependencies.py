import logging
import urllib.request
import json
from typing import Any

import backend_shared.dependencies as _deps
from fastapi import HTTPException, Request, status
from src.core.config import settings

logger = logging.getLogger(__name__)

MOCK_USER_ID = _deps.MOCK_USER_ID
MOCK_HOME_ID = _deps.MOCK_HOME_ID
SAFE_TEST_HOSTS = _deps.SAFE_TEST_HOSTS
SAFE_TEST_SUFFIXES = _deps.SAFE_TEST_SUFFIXES
UserHomeContext = _deps.UserHomeContext

_discovered_jwks_uri: str | None = None


def discover_jwks_uri(issuer_url: str) -> str | None:
    """Fetch OIDC JWKS URI from {OIDC_ISSUER_URL}/.well-known/openid-configuration."""
    global _discovered_jwks_uri
    if _discovered_jwks_uri:
        return _discovered_jwks_uri

    discovery_url = f"{issuer_url.rstrip('/')}/.well-known/openid-configuration"
    try:
        req = urllib.request.Request(discovery_url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                jwks_uri = data.get("jwks_uri")
                if jwks_uri:
                    _discovered_jwks_uri = jwks_uri
                    return jwks_uri
    except Exception as e:
        logger.warning("Failed to discover JWKS URI from OIDC discovery endpoint %s: %s", discovery_url, e)

    return None


def is_mock_auth_allowed() -> bool:
    """Ensure mock auth is strictly allowed in test environments with safe host settings."""
    if not _deps.is_mock_auth_allowed(settings=settings):
        return False
    if hasattr(settings, "OIDC_ISSUER_URL") and not _deps._is_safe_test_url(settings.OIDC_ISSUER_URL):
        logger.error(
            "Mock auth rejected: non-localhost/unsafe OIDC_ISSUER_URL detected: %s",
            settings.OIDC_ISSUER_URL,
        )
        return False
    return True


def get_jwks_client(jwks_url: str):
    return _deps.get_jwks_client(jwks_url)


def decode_oidc_token(token: str) -> dict[str, Any]:
    """Decode and validate OIDC JWT signature, issuer, audience, and expiration."""
    if is_mock_auth_allowed():
        try:
            return _deps.jwt.decode(token, options={"verify_signature": False, "verify_aud": False, "verify_iss": False})
        except _deps.jwt.PyJWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"invalid or expired token: {e}",
            )

    last_error = None
    fallback_urls = getattr(settings, "jwks_fallback_urls", [])
    discovered = discover_jwks_uri(settings.OIDC_ISSUER_URL)
    if discovered and discovered not in fallback_urls:
        fallback_urls = [discovered] + fallback_urls

    expected_issuer = getattr(settings, "expected_issuer", None)
    expected_audience = getattr(settings, "OIDC_AUDIENCE", "alfheim")

    for jwks_url in fallback_urls:
        try:
            jwks_client = get_jwks_client(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            return _deps.jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "HS256"],
                issuer=expected_issuer,
                audience=expected_audience,
                options={
                    "verify_aud": bool(expected_audience),
                    "verify_iss": bool(expected_issuer),
                },
            )
        except HTTPException:
            raise
        except (_deps.jwt.PyJWTError, ValueError) as e:
            logger.warning("OIDC token verification attempt failed for JWKS endpoint %s: %s", jwks_url, e)
            last_error = e

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"invalid or expired token: {last_error}",
    )


# Alias for backward compatibility
decode_keycloak_token = decode_oidc_token


async def get_current_user_and_home(request: Request) -> UserHomeContext:
    """Dependency injector providing authenticated user and active household context from OIDC JWT."""
    auth_header = request.headers.get("Authorization")
    header_hh = request.headers.get("X-Household-ID")

    if not auth_header:
        if is_mock_auth_allowed():
            home_id = _deps.uuid.UUID(header_hh) if header_hh else MOCK_HOME_ID
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
    payload = decode_oidc_token(raw_token)

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing sub claim in token",
        )

    try:
        user_id = _deps.uuid.UUID(sub)
    except ValueError:
        user_id = _deps.uuid.uuid5(_deps.uuid.NAMESPACE_DNS, sub)

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
        if primary_hh:
            selected_hh_str = str(primary_hh)
        elif allowed_households:
            selected_hh_str = next(iter(allowed_households))
        else:
            if is_mock_auth_allowed():
                selected_hh_str = str(MOCK_HOME_ID)
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="missing household context (X-Household-ID or token claim)",
                )

    try:
        home_id = _deps.uuid.UUID(selected_hh_str)
    except ValueError:
        home_id = _deps.uuid.uuid5(_deps.uuid.NAMESPACE_DNS, selected_hh_str)

    roles = payload.get("realm_access", {}).get("roles", [])

    return UserHomeContext(
        user_id=user_id,
        home_id=home_id,
        email=payload.get("email"),
        username=payload.get("preferred_username"),
        roles=roles,
    )
