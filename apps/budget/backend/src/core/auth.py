"""Authentication and tenant isolation dependencies for the Budget service."""

import logging
import uuid
from typing import Any

import backend_shared.dependencies as _deps
import httpx
import jwt
from fastapi import HTTPException, Request, status
from pydantic import BaseModel
from src.core.config import settings

logger = logging.getLogger(__name__)

MOCK_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
MOCK_HOME_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")

_jwks_clients: dict[str, jwt.PyJWKClient] = {}
_discovered_jwks_uris: dict[str, str] = {}


def get_jwks_uri(issuer_url: str) -> str:
    """Fetch OpenID configuration from issuer and discover jwks_uri."""
    normalized_issuer = issuer_url.rstrip("/")
    if normalized_issuer in _discovered_jwks_uris:
        return _discovered_jwks_uris[normalized_issuer]

    discovery_url = f"{normalized_issuer}/.well-known/openid-configuration"
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(discovery_url)
            resp.raise_for_status()
            data = resp.json()
            jwks_uri = data.get("jwks_uri")
            if not jwks_uri:
                raise ValueError("Missing jwks_uri in OpenID configuration")
            _discovered_jwks_uris[normalized_issuer] = jwks_uri
            return jwks_uri
    except Exception as e:
        logger.error("Failed to discover JWKS URI from %s: %s", discovery_url, e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unable to discover OIDC JWKS configuration: {e}",
        )


def get_jwks_client(jwks_uri: str) -> jwt.PyJWKClient:
    """Get cached PyJWKClient instance for a JWKS URI."""
    if jwks_uri not in _jwks_clients:
        _jwks_clients[jwks_uri] = jwt.PyJWKClient(jwks_uri)
    return _jwks_clients[jwks_uri]


def decode_oidc_token(token: str) -> dict[str, Any]:
    """Decode and validate OIDC JWT token signature, issuer, audience, and expiration."""
    if _deps.is_mock_auth_allowed(settings):
        try:
            logger.debug("Decoding OIDC token without signature verification in test context.")
            return jwt.decode(
                token,
                options={"verify_signature": False, "verify_aud": False, "verify_iss": False},
            )
        except jwt.PyJWTError as e:
            logger.warning("Mock JWT decoding failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"invalid or expired token: {e}",
            )

    try:
        issuer = settings.OIDC_ISSUER_URL.rstrip("/")
        jwks_uri = get_jwks_uri(settings.OIDC_ISSUER_URL)
        jwks_client = get_jwks_client(jwks_uri)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256", "HS256"],
            audience=settings.OIDC_AUDIENCE,
            issuer=issuer,
            options={
                "verify_signature": True,
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
            },
        )
        return payload
    except HTTPException:
        raise
    except jwt.PyJWTError as e:
        logger.warning("OIDC JWT validation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"invalid or expired token: {e}",
        )
    except Exception as e:
        logger.error("Unexpected error during JWT validation: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"invalid or expired token: {e}",
        )


class TenantContext(BaseModel):
    """Context object representing the authenticated user and tenant (household)."""

    user_id: uuid.UUID
    household_id: uuid.UUID
    email: str | None = None
    username: str | None = None
    roles: list[str] = []


async def get_current_tenant(request: Request) -> TenantContext:
    """Extract and validate tenant isolation context from request headers and OIDC JWT claims.

    Validates X-Household-ID header against OIDC token claims.
    Returns HTTP 401 for unauthenticated/invalid requests and HTTP 403 for household mismatches.
    """
    auth_header = request.headers.get("Authorization")
    header_hh = request.headers.get("X-Household-ID")

    if not auth_header:
        if _deps.is_mock_auth_allowed(settings):
            home_id = uuid.UUID(header_hh) if header_hh else MOCK_HOME_ID
            logger.warning(
                "Mock auth fallback context injected for testing context. User: %s, Household: %s",
                MOCK_USER_ID,
                home_id,
            )
            return TenantContext(user_id=MOCK_USER_ID, household_id=home_id)
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
            if _deps.is_mock_auth_allowed(settings):
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
            if _deps.is_mock_auth_allowed(settings):
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

    roles = payload.get("realm_access", {}).get("roles", []) or payload.get("roles", [])
    username = payload.get("preferred_username") or payload.get("username") or payload.get("name")

    return TenantContext(
        user_id=user_id,
        household_id=home_id,
        email=payload.get("email"),
        username=username,
        roles=roles,
    )


__all__ = ["TenantContext", "get_current_tenant", "decode_oidc_token", "get_jwks_uri"]
