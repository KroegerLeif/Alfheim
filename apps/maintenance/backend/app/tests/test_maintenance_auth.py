from unittest.mock import patch

import pytest
from app.features.devices.models import Household
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession


@pytest.mark.asyncio
async def test_maintenance_health(client: AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_device_creation_and_retrieval(client: AsyncClient, db_session: AsyncSession):
    # 1. Create a household
    h1 = Household(name="Zurich Apartment", address="Bahnhofstrasse 12, Zurich")
    db_session.add(h1)
    await db_session.commit()
    await db_session.refresh(h1)

    # 2. Create device
    payload = {
        "name": "Dyson Purifier",
        "model": "TP02",
        "serial": "SN-12345",
        "category": "Appliances",
        "location": "Living Room",
        "status": "active",
        "service_interval_months": 6,
        "notes": "Change filter",
        "household_id": h1.id,
        "steps": [
            {
                "title": "Clean Mesh",
                "description": "Vacuum filter mesh",
                "recurrence": 1,
            }
        ],
    }

    response = await client.post("/api/v1/devices", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Dyson Purifier"
    assert data["household_id"] == h1.id
    assert len(data["steps"]) == 1

    # 3. Retrieve devices
    get_res = await client.get(f"/api/v1/devices?household_id={h1.id}")
    assert get_res.status_code == 200
    assert len(get_res.json()) >= 1


@pytest.mark.asyncio
async def test_unauthorized_access_in_production(client: AsyncClient):
    """Verify that mock auth fallback fails when ENVIRONMENT == 'production'."""
    with patch("app.core.dependencies.settings.ENVIRONMENT", "production"):
        response = await client.get("/api/v1/devices", headers={})
        assert response.status_code == 401
        assert "missing authorization header" in response.text.lower() or "unauthorized" in response.text.lower()


@pytest.mark.asyncio
async def test_mock_auth_fallback_fails_with_production_database_url(client: AsyncClient):
    """Verify that mock fallback fails when DATABASE_URL points to non-localhost production database."""
    with patch(
        "app.core.dependencies.settings.DATABASE_URL",
        "postgresql+asyncpg://postgres:secret@db.prod.internal.loeger.com:5432/maintenance",
    ):
        response = await client.get("/api/v1/devices", headers={})
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_maintenance_cross_tenant_idor_header_override_rejected(client: AsyncClient):
    """Verify that a user attempting to override X-Household-ID to an unauthorized tenant is blocked with 403 Forbidden."""
    import jwt

    token = jwt.encode(
        {
            "sub": "user-123",
            "household_id": 1,
            "households": [1],
        },
        "secret",
        algorithm="HS256",
    )

    auth_headers = {
        "Authorization": f"Bearer {token}",
        "X-Household-ID": "999",
    }

    response = await client.get("/api/v1/devices", headers=auth_headers)
    assert response.status_code == 403
    assert "forbidden" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_maintenance_authorized_household_header_override_allowed(client: AsyncClient):
    """Verify that a user selecting a household present in their authorized JWT claims succeeds."""
    import jwt

    token = jwt.encode(
        {
            "sub": "user-123",
            "household_id": 1,
            "households": [1, 2],
        },
        "secret",
        algorithm="HS256",
    )

    auth_headers = {
        "Authorization": f"Bearer {token}",
        "X-Household-ID": "2",
    }

    response = await client.get("/api/v1/devices", headers=auth_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_mock_auth_fallback_fails_with_production_keycloak_url(client: AsyncClient):
    """Verify that mock fallback fails when KEYCLOAK_URL points to non-localhost production Keycloak."""
    with patch(
        "app.core.dependencies.settings.KEYCLOAK_URL",
        "https://auth.production.loeger-os.com/auth",
    ):
        response = await client.get("/api/v1/devices", headers={})
        assert response.status_code == 401
