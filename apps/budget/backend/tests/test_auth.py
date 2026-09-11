import uuid
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi import Depends, FastAPI, HTTPException, status
from httpx import ASGITransport, AsyncClient
from src.core import auth as auth_module
from src.core.auth import (
    MOCK_HOME_ID,
    MOCK_USER_ID,
    TenantContext,
    decode_oidc_token,
    get_current_tenant,
    get_jwks_uri,
)
from src.core.config import settings

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


def test_get_jwks_uri_missing_jwks_uri_in_discovery_document():
    """Verify 401 is raised when the OpenID configuration document lacks a jwks_uri field."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"issuer": "http://auth-missing-jwks.example.com"}
    mock_resp.raise_for_status.return_value = None

    with patch("httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.get.return_value = mock_resp
        with pytest.raises(HTTPException) as exc_info:
            get_jwks_uri("http://auth-missing-jwks.example.com")
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


def test_decode_oidc_token_mock_mode_invalid_token_format():
    """Verify 401 when a malformed token cannot be decoded even without signature verification."""
    with pytest.raises(HTTPException) as exc_info:
        decode_oidc_token("not-a-valid-jwt")
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


def test_decode_oidc_token_real_verification_success():
    """Verify successful OIDC JWT verification through the real JWKS caching path."""
    auth_module._jwks_clients.clear()
    secret = "test-signing-key"
    payload = {
        "sub": str(uuid.uuid4()),
        "aud": settings.OIDC_AUDIENCE,
        "iss": settings.OIDC_ISSUER_URL.rstrip("/"),
    }
    token = jwt.encode(payload, secret, algorithm="HS256")

    mock_signing_key = MagicMock()
    mock_signing_key.key = secret
    mock_jwks_client_instance = MagicMock()
    mock_jwks_client_instance.get_signing_key_from_jwt.return_value = mock_signing_key

    with (
        patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=False),
        patch("src.core.auth.get_jwks_uri", return_value="http://auth.example.com/keys"),
        patch("jwt.PyJWKClient", return_value=mock_jwks_client_instance) as mock_pyjwkclient_cls,
    ):
        decoded = decode_oidc_token(token)
        assert decoded["sub"] == payload["sub"]
        mock_pyjwkclient_cls.assert_called_once_with("http://auth.example.com/keys")

    auth_module._jwks_clients.clear()


def test_decode_oidc_token_real_verification_audience_mismatch():
    """Verify a mismatched 'aud' claim is rejected during live OIDC token verification."""
    auth_module._jwks_clients.clear()
    secret = "test-signing-key"
    payload = {
        "sub": str(uuid.uuid4()),
        "aud": "some-other-audience",
        "iss": settings.OIDC_ISSUER_URL.rstrip("/"),
    }
    token = jwt.encode(payload, secret, algorithm="HS256")

    mock_signing_key = MagicMock()
    mock_signing_key.key = secret
    mock_jwks_client_instance = MagicMock()
    mock_jwks_client_instance.get_signing_key_from_jwt.return_value = mock_signing_key

    with (
        patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=False),
        patch("src.core.auth.get_jwks_uri", return_value="http://auth.example.com/keys"),
        patch("jwt.PyJWKClient", return_value=mock_jwks_client_instance),
    ):
        with pytest.raises(HTTPException) as exc_info:
            decode_oidc_token(token)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    auth_module._jwks_clients.clear()


def test_decode_oidc_token_real_verification_issuer_mismatch():
    """Verify a mismatched 'iss' claim is rejected during live OIDC token verification."""
    auth_module._jwks_clients.clear()
    secret = "test-signing-key"
    payload = {
        "sub": str(uuid.uuid4()),
        "aud": settings.OIDC_AUDIENCE,
        "iss": "http://some-other-issuer.example.com",
    }
    token = jwt.encode(payload, secret, algorithm="HS256")

    mock_signing_key = MagicMock()
    mock_signing_key.key = secret
    mock_jwks_client_instance = MagicMock()
    mock_jwks_client_instance.get_signing_key_from_jwt.return_value = mock_signing_key

    with (
        patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=False),
        patch("src.core.auth.get_jwks_uri", return_value="http://auth.example.com/keys"),
        patch("jwt.PyJWKClient", return_value=mock_jwks_client_instance),
    ):
        with pytest.raises(HTTPException) as exc_info:
            decode_oidc_token(token)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    auth_module._jwks_clients.clear()


def test_decode_oidc_token_jwks_discovery_failure_propagates():
    """Verify a JWKS discovery failure during live token verification propagates as 401."""
    auth_module._discovered_jwks_uris.pop(settings.OIDC_ISSUER_URL.rstrip("/"), None)
    token = jwt.encode({"sub": str(uuid.uuid4())}, "secret", algorithm="HS256")

    with (
        patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=False),
        patch("httpx.Client") as mock_client,
    ):
        mock_client.return_value.__enter__.return_value.get.side_effect = Exception("network unreachable")
        with pytest.raises(HTTPException) as exc_info:
            decode_oidc_token(token)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_mock_fallback_no_auth_header():
    """Verify the mock auth fallback context is returned when no Authorization header is present."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/test-tenant")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["user_id"] == str(MOCK_USER_ID)
    assert data["household_id"] == str(MOCK_HOME_ID)


@pytest.mark.asyncio
async def test_get_current_tenant_missing_auth_header_unauthorized_when_not_mock():
    """Verify 401 with no Authorization header at all when mock auth fallback is disabled."""
    transport = ASGITransport(app=test_app)
    with patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=False):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test-tenant")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "missing authorization header" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_current_tenant_mock_fallback_with_household_header_no_auth():
    """Verify the mock auth fallback honors an explicit X-Household-ID even without a bearer token."""
    hh_id = str(uuid.uuid4())
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/test-tenant", headers={"X-Household-ID": hh_id})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["household_id"] == hh_id


@pytest.mark.asyncio
async def test_get_current_tenant_household_override_forbidden_without_claims():
    """Verify 403 when a non-mock context receives a household header but the token has no household claims."""
    user_id = str(uuid.uuid4())
    token = create_test_token(user_id=user_id)
    hh_id = str(uuid.uuid4())

    transport = ASGITransport(app=test_app)
    with patch("backend_shared.dependencies.is_mock_auth_allowed", side_effect=[True, False]):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/test-tenant",
                headers={"Authorization": f"Bearer {token}", "X-Household-ID": hh_id},
            )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "Forbidden" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_tenant_mock_allows_arbitrary_household_header():
    """Verify a non-UUID household header value falls back to a deterministic UUID5 identifier."""
    user_id = str(uuid.uuid4())
    token = create_test_token(user_id=user_id)
    hh_value = "not-a-uuid-household"

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/test-tenant",
            headers={"Authorization": f"Bearer {token}", "X-Household-ID": hh_value},
        )

    assert response.status_code == status.HTTP_200_OK
    expected_home_id = uuid.uuid5(uuid.NAMESPACE_DNS, hh_value)
    assert response.json()["household_id"] == str(expected_home_id)


@pytest.mark.asyncio
async def test_get_current_tenant_households_list_selected_without_header():
    """Verify a household is selected from the households list claim when no header is supplied."""
    user_id = str(uuid.uuid4())
    hh_id = str(uuid.uuid4())
    token = create_test_token(user_id=user_id, households=[hh_id])

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/test-tenant", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["household_id"] == hh_id


@pytest.mark.asyncio
async def test_get_current_tenant_mock_fallback_home_id_when_no_claims_or_header():
    """Verify mock auth injects the default mock household when the token carries no household claims."""
    user_id = str(uuid.uuid4())
    token = create_test_token(user_id=user_id)

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/test-tenant", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["household_id"] == str(MOCK_HOME_ID)


@pytest.mark.asyncio
async def test_get_current_tenant_missing_household_context_unauthorized():
    """Verify 401 when neither a household header nor token claims provide tenant context."""
    user_id = str(uuid.uuid4())
    token = create_test_token(user_id=user_id)

    transport = ASGITransport(app=test_app)
    with patch("backend_shared.dependencies.is_mock_auth_allowed", side_effect=[True, False]):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test-tenant", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_tenant_non_uuid_subject_claim():
    """Verify a non-UUID 'sub' claim is deterministically mapped to a UUID5 identifier."""
    user_id = "external-idp-subject-123"
    hh_id = str(uuid.uuid4())
    token = create_test_token(user_id=user_id, household_id=hh_id)

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/test-tenant",
            headers={"Authorization": f"Bearer {token}", "X-Household-ID": hh_id},
        )

    assert response.status_code == status.HTTP_200_OK
    expected_user_id = uuid.uuid5(uuid.NAMESPACE_DNS, user_id)
    assert response.json()["user_id"] == str(expected_user_id)
