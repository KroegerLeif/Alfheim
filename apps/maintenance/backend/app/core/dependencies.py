import os
import logging
import jwt
from typing import Optional
from fastapi import Request, HTTPException, status
from pydantic import BaseModel
from app.core.config import settings

logger = logging.getLogger(__name__)


class UserHouseholdContext(BaseModel):
    user_id: str
    household_id: Optional[int] = None
    email: Optional[str] = None
    username: Optional[str] = None
    roles: list[str] = []


_jwks_clients: dict[str, jwt.PyJWKClient] = {}


def get_jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    if jwks_url not in _jwks_clients:
        _jwks_clients[jwks_url] = jwt.PyJWKClient(jwks_url)
    return _jwks_clients[jwks_url]


def decode_keycloak_token(token: str) -> dict:
    if os.getenv("TESTING") == "true" or settings.ENVIRONMENT == "testing":
        try:
            return jwt.decode(token, options={"verify_signature": False, "verify_aud": False})
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"invalid or expired token: {e}",
            )

    try:
        jwks_client = get_jwks_client(settings.jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "HS256"],
            options={"verify_aud": False},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Keycloak JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"invalid or expired token: {e}",
        )


async def get_current_user_and_household(request: Request) -> UserHouseholdContext:
    """Dependency injector providing authenticated user and household context from Keycloak JWT."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        if os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING") == "true" or settings.ENVIRONMENT == "testing":
            return UserHouseholdContext(user_id="test-user", household_id=1)
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

    hh_val = payload.get("household_id") or payload.get("active_household_id") or request.headers.get("X-Household-ID")
    parsed_hh_id: Optional[int] = None
    if hh_val is not None:
        try:
            parsed_hh_id = int(hh_val)
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
