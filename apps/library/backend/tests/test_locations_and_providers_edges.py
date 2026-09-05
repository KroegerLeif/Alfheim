"""Integration tests for locations hierarchy cycles and provider management edge cases."""

import uuid

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Location, ProviderSubscription

DEFAULT_TEST_HOUSEHOLD_ID = uuid.UUID("4eeb7681-8419-4c52-b800-6fef6c7ee51b")


@pytest.mark.asyncio
async def test_locations_router_edge_cases_and_cycles(client: AsyncClient, db_session: AsyncSession):
    """Verify location not found, self-parenting prevention, and circular ancestor detection."""
    fake_id = uuid.uuid4()

    # 1. GET / PUT / DELETE nonexistent location -> 404
    assert (await client.get(f"/api/v1/library/locations/{fake_id}")).status_code == 404
    assert (await client.put(f"/api/v1/library/locations/{fake_id}", json={"name": "New"})).status_code == 404
    assert (await client.delete(f"/api/v1/library/locations/{fake_id}")).status_code == 404

    # Create root location
    loc_a = Location(name="Room A", household_id=DEFAULT_TEST_HOUSEHOLD_ID)
    loc_b = Location(name="Cabinet B", household_id=DEFAULT_TEST_HOUSEHOLD_ID)
    db_session.add_all([loc_a, loc_b])
    await db_session.commit()
    await db_session.refresh(loc_a)
    await db_session.refresh(loc_b)

    # 2. Self-parenting -> 400
    res_self = await client.put(f"/api/v1/library/locations/{loc_a.id}", json={"parent_id": str(loc_a.id)})
    assert res_self.status_code == 400
    assert "cannot be its own parent" in res_self.json()["detail"]

    # 3. Set loc_b parent to loc_a
    res_parent = await client.put(f"/api/v1/library/locations/{loc_b.id}", json={"parent_id": str(loc_a.id)})
    assert res_parent.status_code == 200

    # 4. Now set loc_a parent to loc_b (cycle: A -> B -> A) -> 400
    res_cycle = await client.put(f"/api/v1/library/locations/{loc_a.id}", json={"parent_id": str(loc_b.id)})
    assert res_cycle.status_code == 400
    assert "cycle in hierarchy" in res_cycle.json()["detail"]

    # 5. Set parent to nonexistent location -> 404
    res_bad_parent = await client.put(f"/api/v1/library/locations/{loc_a.id}", json={"parent_id": str(uuid.uuid4())})
    assert res_bad_parent.status_code == 404

    # 6. Delete location successfully
    res_del = await client.delete(f"/api/v1/library/locations/{loc_b.id}")
    assert res_del.status_code == 204


@pytest.mark.asyncio
async def test_providers_router_edge_cases_and_toggle(client: AsyncClient, db_session: AsyncSession):
    """Verify provider not found, update, deletion, toggle, and active filtering."""
    fake_id = uuid.uuid4()

    # 1. Nonexistent provider endpoints -> 404
    assert (await client.get(f"/api/v1/library/providers/{fake_id}")).status_code == 404
    assert (await client.put(f"/api/v1/library/providers/{fake_id}", json={"provider_name": "Net"})).status_code == 404
    assert (await client.delete(f"/api/v1/library/providers/{fake_id}")).status_code == 404

    # Create active provider
    prov = ProviderSubscription(
        provider_name="Disney+",
        household_id=DEFAULT_TEST_HOUSEHOLD_ID,
        is_active=True,
    )
    db_session.add(prov)
    await db_session.commit()
    await db_session.refresh(prov)

    # 2. Update provider active -> inactive via PUT
    res_toggle1 = await client.put(f"/api/v1/library/providers/{prov.id}", json={"is_active": False})
    assert res_toggle1.status_code == 200
    assert res_toggle1.json()["is_active"] is False

    # 3. Filter is_active=True (should exclude inactive Disney+)
    res_active = await client.get("/api/v1/library/providers?is_active=true")
    assert res_active.status_code == 200
    assert not any(p["id"] == str(prov.id) for p in res_active.json())

    # 4. Update back -> active
    res_toggle2 = await client.put(f"/api/v1/library/providers/{prov.id}", json={"is_active": True})
    assert res_toggle2.status_code == 200
    assert res_toggle2.json()["is_active"] is True

    # 5. Update provider name
    res_update = await client.put(f"/api/v1/library/providers/{prov.id}", json={"provider_name": "Disney Plus Premium"})
    assert res_update.status_code == 200
    assert res_update.json()["provider_name"] == "Disney Plus Premium"

    # 6. Delete provider
    res_del = await client.delete(f"/api/v1/library/providers/{prov.id}")
    assert res_del.status_code == 204
