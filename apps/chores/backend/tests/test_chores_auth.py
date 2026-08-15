import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_chores_unauthenticated_production(client: AsyncClient):
    """Verify that unauthenticated requests in production return 401 Unauthorized."""

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
        response = await client.get("/api/v1/chores/templates", headers={})
        assert response.status_code == 401
        assert "missing authorization header" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_chores_household_isolation(client: AsyncClient):
    """Verify that chore templates are strictly scoped to the active household."""
    hh_a = uuid.uuid4()
    hh_b = uuid.uuid4()

    headers_a = {"X-Household-ID": str(hh_a)}
    headers_b = {"X-Household-ID": str(hh_b)}

    # Create a template in Household A
    create_res = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Water Plants A", "points": 10},
        headers=headers_a,
    )
    assert create_res.status_code == 201
    tmpl_a_id = create_res.json()["id"]

    # Verify Household A sees the template
    list_a = await client.get("/api/v1/chores/templates", headers=headers_a)
    assert list_a.status_code == 200
    assert any(t["id"] == tmpl_a_id for t in list_a.json())

    # Verify Household B does NOT see the template
    list_b = await client.get("/api/v1/chores/templates", headers=headers_b)
    assert list_b.status_code == 200
    assert not any(t["id"] == tmpl_a_id for t in list_b.json())
