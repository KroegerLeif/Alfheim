import pytest
from unittest.mock import patch
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from app.features.devices.models import Household


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
async def test_unauthorized_access(client: AsyncClient):
    def fake_getenv(key, default=None):
        if key in ("PYTEST_CURRENT_TEST", "TESTING"):
            return None
        return default

    with patch("os.getenv", side_effect=fake_getenv):
        with patch("app.core.config.settings.ENVIRONMENT", "production"):
            response = await client.get("/api/v1/devices", headers={})
            assert response.status_code == 401
            assert "unauthorized" in response.text.lower() or "missing authorization header" in response.text.lower()
