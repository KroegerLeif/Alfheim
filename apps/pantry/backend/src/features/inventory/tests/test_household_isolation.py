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
    """Verify that unauthenticated requests fail when ENVIRONMENT == 'production'."""
    with patch("src.core.dependencies.settings.ENVIRONMENT", "production"):
        response = await client.get("/api/v1/locations", headers={})
        assert response.status_code == 401
        assert "missing authorization header" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_pantry_mock_fallback_fails_with_production_database_url(client: AsyncClient):
    """Verify that mock fallback fails when DATABASE_URL points to non-localhost production database."""
    with patch(
        "src.core.dependencies.settings.DATABASE_URL",
        "postgresql+asyncpg://postgres:pass@db.production.aws.loeger.com:5432/pantry",
    ):
        response = await client.get("/api/v1/locations", headers={})
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_pantry_cross_tenant_idor_header_override_rejected(client: AsyncClient):
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

    response = await client.get("/api/v1/locations", headers=auth_headers)
    assert response.status_code == 403
    assert "forbidden" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_pantry_authorized_household_header_override_allowed(client: AsyncClient):
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

    response = await client.get("/api/v1/locations", headers=auth_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_pantry_mock_fallback_fails_with_production_keycloak_url(client: AsyncClient):
    """Verify that mock fallback fails when KEYCLOAK_URL points to non-localhost production Keycloak."""
    with patch(
        "src.core.dependencies.settings.KEYCLOAK_URL",
        "https://auth.production.loeger-os.com/auth",
    ):
        response = await client.get("/api/v1/locations", headers={})
        assert response.status_code == 401
