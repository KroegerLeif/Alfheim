import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_pantry_unauthenticated_production(client: AsyncClient):
    """Verify that unauthenticated requests in production environment are rejected with 401."""

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
        response = await client.get("/api/v1/categories", headers={})
        assert response.status_code == 401
        assert "missing authorization header" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_pantry_household_multi_tenant_isolation(client: AsyncClient):
    """Verify that inventory categories and locations are strictly isolated by household context."""
    household_a = uuid.uuid4()
    household_b = uuid.uuid4()

    headers_a = {"X-Household-ID": str(household_a)}
    headers_b = {"X-Household-ID": str(household_b)}

    # 1. Create a category in Household A
    res_a = await client.post(
        "/api/v1/categories",
        json={"name": "Household A Category"},
        headers=headers_a,
    )
    assert res_a.status_code == 201
    cat_a = res_a.json()
    assert cat_a["name"] == "Household A Category"

    # 2. Fetch categories for Household A
    list_a = await client.get("/api/v1/categories", headers=headers_a)
    assert list_a.status_code == 200
    names_a = [c["name"] for c in list_a.json()]
    assert "Household A Category" in names_a

    # 3. Fetch categories for Household B - should NOT contain Household A Category
    list_b = await client.get("/api/v1/categories", headers=headers_b)
    assert list_b.status_code == 200
    names_b = [c["name"] for c in list_b.json()]
    assert "Household A Category" not in names_b
