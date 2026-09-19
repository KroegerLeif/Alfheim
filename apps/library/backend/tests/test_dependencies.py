"""Household authorization of Library routes via backend_shared.household (membership owned by core/household)."""

import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from backend_shared.household import MembershipServiceError, get_membership_lookup
from backend_shared.household.testing import make_test_token, override_membership
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.api.dependencies import get_current_household_id
from src.db.database import get_db_session
from src.main import app

USER_SUB = "library-user"
HOUSEHOLD_1 = uuid.UUID("22222222-2222-2222-2222-222222222222")
HOUSEHOLD_2 = uuid.UUID("33333333-3333-3333-3333-333333333333")
PROVIDERS_URL = "/api/v1/library/providers"


def _headers(household_id: uuid.UUID | str | None, sub: str = USER_SUB) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {make_test_token(sub)}"}
    if household_id is not None:
        headers["X-Household-ID"] = str(household_id)
    return headers


@pytest_asyncio.fixture
async def auth_app(db_session: AsyncSession) -> AsyncGenerator[FastAPI, None]:
    """Main app with only the database overridden: authorization runs for real against a stubbed membership API."""

    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = _get_test_db
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(auth_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=auth_app), base_url="http://testserver") as ac:
        yield ac


@pytest.mark.asyncio
async def test_member_can_access_household_data(auth_app: FastAPI, auth_client: AsyncClient):
    lookup = override_membership(auth_app, {(HOUSEHOLD_1, USER_SUB): "MEMBER"})

    created = await auth_client.post(PROVIDERS_URL, json={"provider_name": "Netflix"}, headers=_headers(HOUSEHOLD_1))
    assert created.status_code == 201
    assert created.json()["household_id"] == str(HOUSEHOLD_1)

    listed = await auth_client.get(PROVIDERS_URL, headers=_headers(HOUSEHOLD_1))
    assert listed.status_code == 200
    assert [p["provider_name"] for p in listed.json()] == ["Netflix"]
    assert (HOUSEHOLD_1, USER_SUB) in lookup.calls


@pytest.mark.asyncio
async def test_cross_tenant_request_is_forbidden(auth_app: FastAPI, auth_client: AsyncClient):
    override_membership(auth_app, {(HOUSEHOLD_1, USER_SUB): "OWNER"})

    response = await auth_client.get(PROVIDERS_URL, headers=_headers(HOUSEHOLD_2))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_missing_household_header_is_rejected(auth_app: FastAPI, auth_client: AsyncClient):
    override_membership(auth_app, {(HOUSEHOLD_1, USER_SUB): "OWNER"})

    response = await auth_client.get(PROVIDERS_URL, headers=_headers(None))

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_required"


@pytest.mark.asyncio
async def test_non_uuid_household_header_is_rejected(auth_app: FastAPI, auth_client: AsyncClient):
    override_membership(auth_app, {(HOUSEHOLD_1, USER_SUB): "OWNER"})

    response = await auth_client.get(PROVIDERS_URL, headers=_headers("42"))

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_invalid"


@pytest.mark.asyncio
async def test_missing_token_is_unauthenticated(auth_app: FastAPI, auth_client: AsyncClient):
    override_membership(auth_app, {(HOUSEHOLD_1, USER_SUB): "OWNER"})

    response = await auth_client.get(PROVIDERS_URL, headers={"X-Household-ID": str(HOUSEHOLD_1)})

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_membership_service_outage_fails_closed(auth_app: FastAPI, auth_client: AsyncClient):
    async def _unavailable(household_id: uuid.UUID, user_sub: str):
        raise MembershipServiceError("household app down")

    auth_app.dependency_overrides[get_membership_lookup] = lambda: _unavailable

    response = await auth_client.get(PROVIDERS_URL, headers=_headers(HOUSEHOLD_1))

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "household_service_unavailable"


@pytest.mark.asyncio
async def test_mcp_endpoint_requires_household_header(auth_client: AsyncClient):
    response = await auth_client.post("/mcp", headers={"Authorization": f"Bearer {make_test_token(USER_SUB)}"})

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_required"


@pytest.mark.asyncio
async def test_get_current_household_id_returns_context_household():
    from backend_shared.household.testing import make_household_context

    context = make_household_context(household_id=HOUSEHOLD_2)
    assert await get_current_household_id(context) == HOUSEHOLD_2
