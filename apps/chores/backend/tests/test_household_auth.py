import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_household_tenant_isolation(client: AsyncClient):
    household_a = str(uuid.uuid4())
    household_b = str(uuid.uuid4())

    headers_a = {"X-Household-ID": household_a}
    headers_b = {"X-Household-ID": household_b}

    # 1. Create a chore template in Household A
    res_create_a = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Mow Lawn", "description": "Front yard", "points": 20},
        headers=headers_a,
    )
    assert res_create_a.status_code == 201
    template_a = res_create_a.json()
    assert template_a["name"] == "Mow Lawn"

    # 2. Query chore templates from Household B (must NOT see Household A's template)
    res_list_b = await client.get("/api/v1/chores/templates", headers=headers_b)
    assert res_list_b.status_code == 200
    templates_b = res_list_b.json()
    assert not any(t["id"] == template_a["id"] for t in templates_b)

    # 3. Create a chore template with the SAME name in Household B (must succeed because names are scoped per household)
    res_create_b = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Mow Lawn", "description": "Back yard", "points": 25},
        headers=headers_b,
    )
    assert res_create_b.status_code == 201

    # 4. Attempt duplicate name within Household A (fails with 400/409 Conflict)
    res_dup_a = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Mow Lawn", "description": "Duplicate attempt", "points": 20},
        headers=headers_a,
    )
    assert res_dup_a.status_code in (400, 409)


@pytest.mark.asyncio
async def test_missing_auth_header_in_production(client: AsyncClient):
    def fake_getenv(key, default=None):
        if key in ("PYTEST_CURRENT_TEST", "TESTING"):
            return None
        return default

    with patch("os.getenv", side_effect=fake_getenv):
        with patch("src.core.config.settings.ENVIRONMENT", "production"):
            response = await client.get("/api/v1/chores/templates", headers={})
            assert response.status_code == 401
