"""Tests for Keycloak authentication and multi-tenancy dependency in Library backend."""

import uuid
from unittest.mock import patch

import jwt
import pytest
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.testclient import TestClient
from src.api.dependencies import (
    UserHomeContext,
    get_current_household_id,
    get_current_user_and_home,
)

# Sample test UUIDs
USER_UUID = uuid.UUID("11111111-1111-1111-1111-111111111111")
HOUSEHOLD_1 = uuid.UUID("22222222-2222-2222-2222-222222222222")
HOUSEHOLD_2 = uuid.UUID("33333333-3333-3333-3333-333333333333")
UNAUTHORIZED_HOUSEHOLD = uuid.UUID("99999999-9999-9999-9999-999999999999")
SECRET_KEY = "super_secret_test_key_that_is_at_least_32_bytes_long"


@pytest.fixture
def test_app():
    """Create a temporary FastAPI test application with endpoints using dependencies."""
    app = FastAPI()

    @app.get("/test-tenant")
    async def test_tenant_endpoint(
        context: UserHomeContext = Depends(get_current_user_and_home),
        household_id: uuid.UUID = Depends(get_current_household_id),
    ):
        return {
            "user_id": str(context.user_id),
            "household_id": str(household_id),
        }

    return app


def create_mock_jwt(
    sub: str = str(USER_UUID),
    household_id: str | None = str(HOUSEHOLD_1),
    households: list[str] | None = None,
) -> str:
    """Utility to generate an unverified test JWT token."""
    payload = {"sub": sub}
    if household_id is not None:
        payload["household_id"] = household_id
    if households is not None:
        payload["households"] = households
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


@pytest.mark.asyncio
async def test_valid_household_header_matches_jwt():
    """Test that a request with valid JWT and matching X-Household-ID succeeds."""
    token = create_mock_jwt(household_id=str(HOUSEHOLD_1), households=[str(HOUSEHOLD_1), str(HOUSEHOLD_2)])

    request = Request(
        {
            "type": "http",
            "headers": [
                (b"authorization", f"Bearer {token}".encode()),
                (b"x-household-id", str(HOUSEHOLD_1).encode()),
            ],
        }
    )

    with patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=True):
        context = await get_current_user_and_home(request)
        assert context.user_id == USER_UUID
        assert context.home_id == HOUSEHOLD_1


@pytest.mark.asyncio
async def test_unauthorized_household_header_returns_403():
    """Test that requesting a household ID not present in user's claims raises 403 Forbidden."""
    token = create_mock_jwt(household_id=str(HOUSEHOLD_1), households=[str(HOUSEHOLD_1)])

    request = Request(
        {
            "type": "http",
            "headers": [
                (b"authorization", f"Bearer {token}".encode()),
                (b"x-household-id", str(UNAUTHORIZED_HOUSEHOLD).encode()),
            ],
        }
    )

    mock_payload = {
        "sub": str(USER_UUID),
        "household_id": str(HOUSEHOLD_1),
        "households": [str(HOUSEHOLD_1)],
    }

    with (
        patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=False),
        patch("backend_shared.dependencies.decode_keycloak_token", return_value=mock_payload),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user_and_home(request)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Forbidden" in exc_info.value.detail


@pytest.mark.asyncio
async def test_missing_auth_header_non_mock_returns_401():
    """Test that missing authorization header in non-mock environment raises 401 Unauthorized."""
    request = Request({"type": "http", "headers": []})

    with patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=False):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user_and_home(request)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_missing_household_header_falls_back_to_primary_jwt_claim():
    """Test that omitting X-Household-ID header uses the primary household_id claim from JWT."""
    token = create_mock_jwt(household_id=str(HOUSEHOLD_2))

    request = Request(
        {
            "type": "http",
            "headers": [
                (b"authorization", f"Bearer {token}".encode()),
            ],
        }
    )

    with patch("backend_shared.dependencies.is_mock_auth_allowed", return_value=True):
        context = await get_current_user_and_home(request)
        assert context.home_id == HOUSEHOLD_2


@pytest.mark.asyncio
async def test_get_current_household_id_dependency():
    """Test that get_current_household_id helper returns context.home_id."""
    context = UserHomeContext(user_id=USER_UUID, home_id=HOUSEHOLD_1)
    hh_id = await get_current_household_id(context)
    assert hh_id == HOUSEHOLD_1


def test_tenant_endpoint_with_test_client(test_app):
    """Integration test checking FastAPI route behavior with dependency overrides."""
    client = TestClient(test_app)
    token = create_mock_jwt(household_id=str(HOUSEHOLD_1))

    response = client.get(
        "/test-tenant",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Household-ID": str(HOUSEHOLD_1),
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == str(USER_UUID)
    assert data["household_id"] == str(HOUSEHOLD_1)
