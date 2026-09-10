import uuid
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi import Depends, FastAPI, HTTPException, status
from httpx import ASGITransport, AsyncClient
from src.core.auth import TenantContext, decode_oidc_token, get_current_tenant, get_jwks_uri

# Test app with a protected endpoint for testing get_current_tenant
test_app = FastAPI()


@test_app.get("/test-tenant")
async def tenant_endpoint(tenant: TenantContext = Depends(get_current_tenant)):
    return {
        "user_id": str(tenant.user_id),
        "household_id": str(tenant.household_id),
        "email": tenant.email,
        "username": tenant.username,
        "roles": tenant.roles,
    }


def create_test_token(
    user_id: str | None = None,
    household_id: str | None = None,
    active_household_id: str | None = None,
    households: list | None = None,
    email: str = "user@example.com",
    username: str = "testuser",
    roles: list[str] | None = None,
) -> str:
    """Helper to create an unverified JWT token for testing."""
    payload = {}
    if user_id:
        payload["sub"] = user_id
    if household_id:
        payload["household_id"] = household_id
    if active_household_id:
        payload["active_household_id"] = active_household_id
    if households is not None:
        payload["households"] = households
    if email:
        payload["email"] = email
    if username:
        payload["preferred_username"] = username
    if roles:
        payload["realm_access"] = {"roles": roles}

    return jwt.encode(payload, "secret", algorithm="HS256")


@pytest.mark.asyncio
async def test_get_current_tenant_success_matching_header():
    """Verify tenant context extraction when X-Household-ID matches token household_id."""
    user_id = str(uuid.uuid4())
    hh_id = str(uuid.uuid4())
    token = create_test_token(user_id=user_id, household_id=hh_id)

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/test-tenant",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Household-ID": hh_id,
            },
        )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["user_id"] == user_id
    assert data["household_id"] == hh_id


@pytest.mark.asyncio
async def test_get_current_tenant_active_household_claim():
    """Verify tenant context extraction using active_household_id claim."""
    user_id = str(uuid.uuid4())
    hh_id = str(uuid.uuid4())
    token = create_test_token(user_id=user_id, active_household_id=hh_id)

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/test-tenant",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Household-ID": hh_id,
            },
        )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["user_id"] == user_id
    assert data["household_id"] == hh_id


@pytest.mark.asyncio
async def test_get_current_tenant_households_list_claim():
    """Verify tenant context extraction using households list claim."""
    user_id = str(uuid.uuid4())
    hh_1 = str(uuid.uuid4())
    hh_2 = str(uuid.uuid4())
    token = create_test_token(user_id=user_id, households=[hh_1, {"id": hh_2}])

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request second household in list
        response = await client.get(
            "/test-tenant",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Household-ID": hh_2,
            },
        )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["household_id"] == hh_2


@pytest.mark.asyncio
async def test_get_current_tenant_household_mismatch_forbidden():
    """Verify 403 Forbidden is returned when X-Household-ID does not match token claims."""
    user_id = str(uuid.uuid4())
    hh_allowed = str(uuid.uuid4())
    hh_forbidden = str(uuid.uuid4())
    token = create_test_token(user_id=user_id, household_id=hh_allowed)

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/test-tenant",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Household-ID": hh_forbidden,
            },
        )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "Forbidden" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_tenant_missing_sub_unauthorized():
    """Verify 401 Unauthorized when JWT token lacks 'sub' claim."""
    token = create_test_token(user_id=None, household_id=str(uuid.uuid4()))

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/test-tenant",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_invalid_auth_header_format():
    """Verify 401 Unauthorized when Authorization header is ill-formed."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/test-tenant",
            headers={"Authorization": "Basic invalidcredentials"},
        )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_default_household_selection():
    """Verify default household selection when X-Household-ID header is omitted."""
    user_id = str(uuid.uuid4())
    hh_id = str(uuid.uuid4())
    token = create_test_token(user_id=user_id, household_id=hh_id)

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/test-tenant",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["household_id"] == hh_id


def test_get_jwks_uri_discovery():
    """Verify OpenID configuration JWKS URI discovery."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"jwks_uri": "http://auth.example.com/keys"}
    mock_resp.raise_for_status.return_value = None

    with patch("httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.get.return_value = mock_resp
        jwks_uri = get_jwks_uri("http://auth.example.com/custom-issuer")
        assert jwks_uri == "http://auth.example.com/keys"

    # Cached lookup test
    cached_uri = get_jwks_uri("http://auth.example.com/custom-issuer")
    assert cached_uri == "http://auth.example.com/keys"


def test_get_jwks_uri_discovery_failure():
    """Verify 401 response on discovery failure."""
    with patch("httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.get.side_effect = Exception("Network Error")
        with pytest.raises(HTTPException) as exc_info:
            get_jwks_uri("http://failed.example.com")
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


def test_decode_oidc_token_live_verification():
    """Verify live OIDC token validation error handling in non-mock context."""
    with (
        patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=False),
        patch("src.core.auth.get_jwks_uri", return_value="http://auth.example.com/keys"),
        patch("src.core.auth.get_jwks_client") as mock_jwks_client,
    ):
        mock_client = MagicMock()
        mock_client.get_signing_key_from_jwt.side_effect = Exception("Invalid key")
        mock_jwks_client.return_value = mock_client

        with pytest.raises(HTTPException) as exc_info:
            decode_oidc_token("invalid.jwt.token")
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
