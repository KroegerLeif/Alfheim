"""Household authorization of Budget routes via backend_shared.household (membership owned by core/household)."""

from uuid import uuid4

import pytest
from backend_shared.household import MembershipServiceError, get_membership_lookup
from backend_shared.household.testing import make_test_token
from httpx import AsyncClient
from src.main import app
from tests.helpers import MEMBERSHIPS, create_auth_headers

ACCOUNTS_URL = "/api/v1/accounts/"


@pytest.mark.asyncio
async def test_member_request_is_checked_against_membership_api(client: AsyncClient):
    headers = create_auth_headers(role="GUEST")

    response = await client.get(ACCOUNTS_URL, headers=headers)

    assert response.status_code == 200
    assert len(MEMBERSHIPS.calls) == 1


@pytest.mark.asyncio
async def test_cross_tenant_request_is_forbidden(client: AsyncClient):
    member_headers = create_auth_headers()
    foreign_household = str(uuid4())

    response = await client.get(ACCOUNTS_URL, headers={**member_headers, "X-Household-ID": foreign_household})

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_non_member_cannot_create_in_household(client: AsyncClient):
    headers = create_auth_headers(role=None)

    response = await client.post(ACCOUNTS_URL, headers=headers, json={"name": "Stolen", "account_type": "CHECKING"})

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_missing_household_header_is_rejected(client: AsyncClient):
    headers = {"Authorization": f"Bearer {make_test_token('budget-user')}"}

    response = await client.get(ACCOUNTS_URL, headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_required"


@pytest.mark.asyncio
async def test_non_uuid_household_header_is_rejected(client: AsyncClient):
    headers = {"Authorization": f"Bearer {make_test_token('budget-user')}", "X-Household-ID": "7"}

    response = await client.get(ACCOUNTS_URL, headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_invalid"


@pytest.mark.asyncio
async def test_missing_token_is_unauthenticated(client: AsyncClient):
    response = await client.get(ACCOUNTS_URL, headers={"X-Household-ID": str(uuid4())})

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_membership_service_outage_fails_closed(client: AsyncClient):
    async def _unavailable(household_id, user_sub):
        raise MembershipServiceError("household app down")

    app.dependency_overrides[get_membership_lookup] = lambda: _unavailable

    response = await client.get(ACCOUNTS_URL, headers=create_auth_headers())

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "household_service_unavailable"
