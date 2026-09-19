import uuid
from unittest.mock import patch

import pytest
from backend_shared.household import MembershipServiceError
from backend_shared.household.testing import DEFAULT_TEST_SUB, StaticMembershipLookup
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_shopping_household_isolation_and_protected_lists(
    client: AsyncClient, membership: StaticMembershipLookup, auth_headers
):
    home_a = uuid.uuid4()
    home_b = uuid.uuid4()
    membership.set(home_a, DEFAULT_TEST_SUB, "MEMBER")
    membership.set(home_b, DEFAULT_TEST_SUB, "MEMBER")

    headers_a = auth_headers(household_id=home_a)
    headers_b = auth_headers(household_id=home_b)

    # 1. Fetch lists for Household A (auto-provisions Default Household List & Personal List)
    res_a = await client.get("/api/v1/shopping-lists", headers=headers_a)
    assert res_a.status_code == 200
    lists_a = res_a.json()
    assert len(lists_a) >= 2
    default_a = next(l for l in lists_a if l["is_default"])
    personal_a = next(l for l in lists_a if l["is_personal"])
    assert default_a["is_default"] is True
    assert personal_a["is_personal"] is True

    # 2. Fetch lists for Household B (auto-provisions Household B's distinct Default List)
    res_b = await client.get("/api/v1/shopping-lists", headers=headers_b)
    assert res_b.status_code == 200
    lists_b = res_b.json()
    default_b = next(l for l in lists_b if l["is_default"])
    assert default_b["id"] != default_a["id"]

    # 3. Household B caller cannot access or mutate Household A's default list
    res_cross = await client.get(f"/api/v1/shopping-lists/{default_a['id']}", headers=headers_b)
    assert res_cross.status_code in (400, 403, 404)

    # 4. Attempting to delete protected default or personal list must fail with 400
    res_del_default = await client.delete(f"/api/v1/shopping-lists/{default_a['id']}", headers=headers_a)
    assert res_del_default.status_code == 400
    assert "cannot delete" in res_del_default.text.lower() or "protected" in res_del_default.text.lower()


@pytest.mark.asyncio
async def test_shopping_non_member_household_rejected(client: AsyncClient, auth_headers):
    """A caller selecting a household they are not a member of gets 403 household_forbidden."""
    response = await client.get("/api/v1/shopping-lists", headers=auth_headers(household_id=uuid.uuid4()))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_shopping_other_user_cannot_push_into_household(client: AsyncClient, auth_headers):
    """The inter-service push endpoint is authorized like any other route: non-members get 403."""
    response = await client.post(
        "/api/v1/shopping/items",
        json={"name": "Milk", "quantity": 1, "unit": "l"},
        headers=auth_headers(sub="intruder"),
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_shopping_missing_household_header_rejected(client: AsyncClient):
    """Requests without X-Household-ID get 400 household_required."""
    client.headers.pop("X-Household-ID")
    response = await client.get("/api/v1/shopping-lists")
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_required"


@pytest.mark.asyncio
async def test_shopping_invalid_household_header_rejected(client: AsyncClient):
    """A non-UUID X-Household-ID gets 400 household_invalid."""
    response = await client.get("/api/v1/shopping-lists", headers={"X-Household-ID": "42"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_invalid"


@pytest.mark.asyncio
async def test_shopping_membership_service_unavailable(client: AsyncClient):
    """When the household membership API is unreachable the request fails closed with 503."""
    with patch.object(StaticMembershipLookup, "__call__", side_effect=MembershipServiceError("down")):
        response = await client.get("/api/v1/shopping-lists")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "household_service_unavailable"


@pytest.mark.asyncio
async def test_shopping_unsigned_token_rejected_in_production(client: AsyncClient):
    """Unsigned test tokens are never accepted outside test contexts."""
    with patch("src.core.config.settings.ENVIRONMENT", "production"):
        response = await client.get("/api/v1/shopping-lists")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthenticated"
