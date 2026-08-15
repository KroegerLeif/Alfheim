import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_pantry_household_tenant_isolation(client: AsyncClient):
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())

    headers_a = {"X-Household-ID": home_a}
    headers_b = {"X-Household-ID": home_b}

    # 1. Create a storage location in Household A
    res_loc_a = await client.post(
        "/api/v1/locations",
        json={"name": "Kitchen Fridge", "description": "Main refrigerator"},
        headers=headers_a,
    )
    assert res_loc_a.status_code == 201
    loc_a = res_loc_a.json()

    # 2. Query locations in Household B (must not see Household A's location)
    res_loc_b = await client.get("/api/v1/locations", headers=headers_b)
    assert res_loc_b.status_code == 200
    locations_b = res_loc_b.json()
    assert not any(l["id"] == loc_a["id"] for l in locations_b)

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
    categories_b = res_cat_b.json()
    assert not any(c["id"] == cat_a["id"] for c in categories_b)


@pytest.mark.asyncio
async def test_pantry_unauthorized_production(client: AsyncClient):
    def fake_getenv(key, default=None):
        if key in ("PYTEST_CURRENT_TEST", "TESTING"):
            return None
        return default

    with patch("os.getenv", side_effect=fake_getenv):
        with patch("src.core.config.settings.ENVIRONMENT", "production"):
            response = await client.get("/api/v1/locations", headers={})
            assert response.status_code == 401
