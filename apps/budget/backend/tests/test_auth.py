import uuid

import jwt
import pytest
from fastapi import Depends, FastAPI, status
from httpx import ASGITransport, AsyncClient
from src.core.auth import TenantContext, get_current_tenant

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
