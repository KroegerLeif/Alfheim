import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_shopping_unauthenticated_production(client: AsyncClient):
    """Verify that unauthenticated requests in production environment return 401 Unauthorized."""

    def fake_getenv(key, default=None):
        if key in ("PYTEST_CURRENT_TEST", "TESTING"):
            return None
        if key == "ENVIRONMENT":
            return "production"
        return default

    with (
        patch("os.getenv", side_effect=fake_getenv),
        patch("src.core.config.settings.ENVIRONMENT", "production"),
    ):
        response = await client.get("/api/v1/shopping-lists", headers={})
        assert response.status_code == 401
        assert "missing authorization header" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_my_households_proxy(client: AsyncClient, mock_dashboard_households):
    """Verify that /api/v1/households/me correctly proxies requests to dashboard-backend."""
    response = await client.get("/api/v1/households/me", headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 200
    households = response.json()
    assert len(households) == 2
    assert households[0]["name"] == "Primary Household"
    assert households[1]["name"] == "Vacation Home"


@pytest.mark.asyncio
async def test_shopping_multi_tenant_household_isolation(client: AsyncClient):
    """Verify that custom shopping lists created in Household A cannot be retrieved by Household B."""
    hh_a = uuid.uuid4()
    hh_b = uuid.uuid4()

    headers_a = {"X-Household-ID": str(hh_a)}
    headers_b = {"X-Household-ID": str(hh_b)}

    # Create a custom list in Household A
    create_res = await client.post(
        "/api/v1/shopping-lists",
        json={"name": "Weekly Groceries A"},
        headers=headers_a,
    )
    assert create_res.status_code == 201
    list_a_id = create_res.json()["id"]

    # Verify Household A can fetch the list directly
    get_a = await client.get(f"/api/v1/shopping-lists/{list_a_id}", headers=headers_a)
    assert get_a.status_code == 200
    assert get_a.json()["id"] == list_a_id

    # Verify Household B cannot access Household A's custom list
    get_b = await client.get(f"/api/v1/shopping-lists/{list_a_id}", headers=headers_b)
    assert get_b.status_code == 400 or get_b.status_code == 404
