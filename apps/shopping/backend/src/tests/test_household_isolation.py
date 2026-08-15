import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_shopping_household_isolation_and_protected_lists(client: AsyncClient):
    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())

    headers_a = {"X-Household-ID": home_a}
    headers_b = {"X-Household-ID": home_b}

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
async def test_shopping_unauthorized_production(client: AsyncClient):
    def fake_getenv(key, default=None):
        if key in ("PYTEST_CURRENT_TEST", "TESTING"):
            return None
        return default

    with patch("os.getenv", side_effect=fake_getenv):
        with patch("src.core.config.settings.ENVIRONMENT", "production"):
            response = await client.get("/api/v1/shopping-lists", headers={})
            assert response.status_code == 401
