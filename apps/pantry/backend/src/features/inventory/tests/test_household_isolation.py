import uuid
from unittest.mock import patch

import pytest
from backend_shared.household import MembershipServiceError
from backend_shared.household.testing import DEFAULT_TEST_SUB, StaticMembershipLookup
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_pantry_household_tenant_isolation(client: AsyncClient, membership: StaticMembershipLookup, auth_headers):
    """Data created in household A is invisible from household B, even for a member of both."""
    home_a = uuid.uuid4()
    home_b = uuid.uuid4()
    membership.set(home_a, DEFAULT_TEST_SUB, "MEMBER")
    membership.set(home_b, DEFAULT_TEST_SUB, "MEMBER")

    headers_a = auth_headers(household_id=home_a)
    headers_b = auth_headers(household_id=home_b)

    # 1. Create a storage location in Household A
    res_loc_a = await client.post(
        "/api/v1/locations",
        json={"name": "Kitchen Fridge", "description": "Main refrigerator"},
        headers=headers_a,
    )
    assert res_loc_a.status_code == 201
    loc_a = res_loc_a.json()
    assert loc_a["home_id"] == str(home_a)

    # 2. Query locations in Household B (must not see Household A's location)
    res_loc_b = await client.get("/api/v1/locations", headers=headers_b)
    assert res_loc_b.status_code == 200
    assert not any(loc["id"] == loc_a["id"] for loc in res_loc_b.json())

    # 3. Create a custom category in Household A
    res_cat_a = await client.post(
        "/api/v1/categories",
        json={"name": "Cold Drinks", "icon": "cup"},
        headers=headers_a,
    )
    assert res_cat_a.status_code == 201
    cat_a = res_cat_a.json()

    # 4. Query categories in Household B (must not see Household A's custom category)
    res_cat_b = await client.get("/api/v1/categories", headers=headers_b)
    assert res_cat_b.status_code == 200
    assert not any(c["id"] == cat_a["id"] for c in res_cat_b.json())


@pytest.mark.asyncio
async def test_pantry_non_member_household_rejected(client: AsyncClient, auth_headers):
    """A caller selecting a household they are not a member of gets 403 household_forbidden."""
    response = await client.get("/api/v1/locations", headers=auth_headers(household_id=uuid.uuid4()))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_pantry_other_user_cannot_access_household(client: AsyncClient, auth_headers):
    """Another authenticated user who is not a member of the default household gets 403."""
    response = await client.get("/api/v1/inventory/state", headers=auth_headers(sub="intruder"))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_pantry_missing_household_header_rejected(client: AsyncClient, auth_headers):
    """Requests without X-Household-ID get 400 household_required."""
    headers = {"Authorization": auth_headers()["Authorization"]}
    client.headers.pop("X-Household-ID")
    response = await client.get("/api/v1/locations", headers=headers)
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_required"


@pytest.mark.asyncio
async def test_pantry_invalid_household_header_rejected(client: AsyncClient):
    """A non-UUID X-Household-ID gets 400 household_invalid."""
    response = await client.get("/api/v1/locations", headers={"X-Household-ID": "not-a-uuid"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_invalid"


@pytest.mark.asyncio
async def test_pantry_unauthenticated_rejected(client: AsyncClient):
    """Requests without a bearer token get 401 unauthenticated (no mock-user fallback)."""
    client.headers.pop("Authorization")
    response = await client.get("/api/v1/locations")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_pantry_membership_service_unavailable(client: AsyncClient, membership: StaticMembershipLookup):
    """When the household membership API is unreachable the request fails closed with 503."""
    with patch.object(StaticMembershipLookup, "__call__", side_effect=MembershipServiceError("down")):
        response = await client.get("/api/v1/locations")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "household_service_unavailable"


@pytest.mark.asyncio
async def test_pantry_unsigned_token_rejected_in_production(client: AsyncClient):
    """Unsigned test tokens are never accepted outside test contexts."""
    with patch("src.core.config.settings.ENVIRONMENT", "production"):
        response = await client.get("/api/v1/locations")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthenticated"
