import uuid

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession


@pytest.fixture(autouse=True)
async def seed_equipment(db_session: AsyncSession):
    """Seed default system equipment dynamically for equipment tests."""
    from src.features.equipment.seeder import seed_default_equipment

    await seed_default_equipment(db_session)
    await db_session.commit()


async def test_startup_seeds_system_equipment(client: AsyncClient):
    response = await client.get("/api/v1/equipment")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 10
    assert all(item["scope"] == "system" for item in data)


async def test_create_household_equipment(client: AsyncClient):
    payload = {"name": "Adjustable Bench", "category": "bench", "scope": "household"}
    response = await client.post("/api/v1/equipment", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Adjustable Bench"
    assert data["scope"] == "household"


async def test_create_system_equipment_via_api_rejected(client: AsyncClient):
    payload = {"name": "Hack", "scope": "system"}
    response = await client.post("/api/v1/equipment", json=payload)
    assert response.status_code == 400


async def test_get_equipment_by_id(client: AsyncClient):
    create_res = await client.post("/api/v1/equipment", json={"name": "Cable Row", "scope": "household"})
    equipment_id = create_res.json()["id"]

    response = await client.get(f"/api/v1/equipment/{equipment_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Cable Row"

    fake_id = uuid.uuid4()
    response = await client.get(f"/api/v1/equipment/{fake_id}")
    assert response.status_code == 404


async def test_update_equipment(client: AsyncClient):
    create_res = await client.post("/api/v1/equipment", json={"name": "Old Name", "scope": "household"})
    equipment_id = create_res.json()["id"]

    patch_res = await client.patch(f"/api/v1/equipment/{equipment_id}", json={"name": "New Name"})
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "New Name"


async def test_update_system_equipment_returns_404(client: AsyncClient):
    list_res = await client.get("/api/v1/equipment")
    system_id = list_res.json()[0]["id"]

    patch_res = await client.patch(f"/api/v1/equipment/{system_id}", json={"name": "Hacked"})
    assert patch_res.status_code == 404


async def test_delete_equipment(client: AsyncClient):
    create_res = await client.post("/api/v1/equipment", json={"name": "Temp Item", "scope": "household"})
    equipment_id = create_res.json()["id"]

    del_res = await client.delete(f"/api/v1/equipment/{equipment_id}")
    assert del_res.status_code == 204

    get_res = await client.get(f"/api/v1/equipment/{equipment_id}")
    assert get_res.status_code == 404
