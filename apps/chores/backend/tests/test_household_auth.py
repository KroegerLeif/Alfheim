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
async def test_mock_auth_fallback_fails_in_production(client: AsyncClient):
    """Verify that unauthenticated requests are strictly rejected in production environments."""
    with patch("src.core.dependencies.settings.ENVIRONMENT", "production"):
        response = await client.get("/api/v1/chores/templates", headers={})
        assert response.status_code == 401
        assert "missing authorization header" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_mock_auth_fallback_fails_with_production_database_url(client: AsyncClient):
    """Verify that mock fallback is disabled when a non-localhost production DB URL is configured."""
    with patch(
        "src.core.dependencies.settings.DATABASE_URL",
        "postgresql+asyncpg://postgres:pass@db.production.aws.loeger.com:5432/chores",
    ):
        response = await client.get("/api/v1/chores/templates", headers={})
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_chores_cross_tenant_idor_header_override_rejected(client: AsyncClient):
    """Verify that a user attempting to override X-Household-ID to an unauthorized tenant is blocked with 403 Forbidden."""
    import jwt

    home_authorized = str(uuid.uuid4())
    home_unauthorized = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    token = jwt.encode(
        {
            "sub": user_id,
            "household_id": home_authorized,
            "households": [home_authorized],
        },
        "secret",
        algorithm="HS256",
    )

    auth_headers = {
        "Authorization": f"Bearer {token}",
        "X-Household-ID": home_unauthorized,
    }

    response = await client.get("/api/v1/chores/templates", headers=auth_headers)
    assert response.status_code == 403
    assert "forbidden" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_chores_authorized_household_header_override_allowed(client: AsyncClient):
    """Verify that a user selecting a household present in their authorized JWT claims succeeds."""
    import jwt

    home_a = str(uuid.uuid4())
    home_b = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    token = jwt.encode(
        {
            "sub": user_id,
            "household_id": home_a,
            "households": [home_a, home_b],
        },
        "secret",
        algorithm="HS256",
    )

    auth_headers = {
        "Authorization": f"Bearer {token}",
        "X-Household-ID": home_b,
    }

    response = await client.get("/api/v1/chores/templates", headers=auth_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_mock_auth_fallback_fails_with_production_keycloak_url(client: AsyncClient):
    """Verify that mock fallback is disabled when a non-localhost production Keycloak URL is configured."""
    with patch(
        "src.core.dependencies.settings.KEYCLOAK_URL",
        "https://auth.production.loeger-os.com/auth",
    ):
        response = await client.get("/api/v1/chores/templates", headers={})
        assert response.status_code == 401
