import uuid
from unittest.mock import patch

import pytest
from backend_shared.household import MembershipServiceError
from backend_shared.household.testing import DEFAULT_TEST_SUB, StaticMembershipLookup
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_household_tenant_isolation(client: AsyncClient, membership: StaticMembershipLookup, auth_headers):
    household_a = uuid.uuid4()
    household_b = uuid.uuid4()
    membership.set(household_a, DEFAULT_TEST_SUB, "MEMBER")
    membership.set(household_b, DEFAULT_TEST_SUB, "MEMBER")

    headers_a = auth_headers(household_id=household_a)
    headers_b = auth_headers(household_id=household_b)

    # 1. Create a chore template in Household A
    res_create_a = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Mow Lawn", "description": "Front yard", "points": 20},
        headers=headers_a,
    )
    assert res_create_a.status_code == 201
    template_a = res_create_a.json()
    assert template_a["name"] == "Mow Lawn"
    assert template_a["home_id"] == str(household_a)

    # 2. Query chore templates from Household B (must NOT see Household A's template)
    res_list_b = await client.get("/api/v1/chores/templates", headers=headers_b)
    assert res_list_b.status_code == 200
    assert not any(t["id"] == template_a["id"] for t in res_list_b.json())

    # 3. Same name in Household B succeeds because names are scoped per household
    res_create_b = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Mow Lawn", "description": "Back yard", "points": 25},
        headers=headers_b,
    )
    assert res_create_b.status_code == 201

    # 4. Duplicate name within Household A fails with 400/409 Conflict
    res_dup_a = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Mow Lawn", "description": "Duplicate attempt", "points": 20},
        headers=headers_a,
    )
    assert res_dup_a.status_code in (400, 409)

    # 5. Household B cannot read Household A's template by id
    res_cross = await client.get(f"/api/v1/chores/templates/{template_a['id']}", headers=headers_b)
    assert res_cross.status_code == 404


@pytest.mark.asyncio
async def test_chores_non_member_household_rejected(client: AsyncClient, auth_headers):
    """A caller selecting a household they are not a member of gets 403 household_forbidden."""
    response = await client.get("/api/v1/chores/templates", headers=auth_headers(household_id=uuid.uuid4()))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_chores_other_user_cannot_complete_in_household(client: AsyncClient, auth_headers):
    """Another authenticated user who is not a member cannot mutate the household's chores."""
    response = await client.post(
        f"/api/v1/chores/instances/{uuid.uuid4()}/complete", json={}, headers=auth_headers(sub="intruder")
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_chores_missing_household_header_rejected(client: AsyncClient):
    """Requests without X-Household-ID get 400 household_required."""
    client.headers.pop("X-Household-ID")
    response = await client.get("/api/v1/chores/templates")
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_required"


@pytest.mark.asyncio
async def test_chores_invalid_household_header_rejected(client: AsyncClient):
    """A non-UUID X-Household-ID gets 400 household_invalid."""
    response = await client.get("/api/v1/chores/templates", headers={"X-Household-ID": "1"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_invalid"


@pytest.mark.asyncio
async def test_chores_unauthenticated_rejected(client: AsyncClient):
    """Requests without a bearer token get 401 unauthenticated (no mock-user fallback)."""
    client.headers.pop("Authorization")
    response = await client.get("/api/v1/chores/templates")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_chores_membership_service_unavailable(client: AsyncClient):
    """When the household membership API is unreachable the request fails closed with 503."""
    with patch.object(StaticMembershipLookup, "__call__", side_effect=MembershipServiceError("down")):
        response = await client.get("/api/v1/chores/templates")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "household_service_unavailable"


@pytest.mark.asyncio
async def test_chores_unsigned_token_rejected_in_production(client: AsyncClient):
    """Unsigned test tokens are never accepted outside test contexts."""
    with patch("src.core.config.settings.ENVIRONMENT", "production"):
        response = await client.get("/api/v1/chores/templates")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthenticated"
