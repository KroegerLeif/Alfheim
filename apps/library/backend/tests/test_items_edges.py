"""Integration tests for media items router edge cases and input validation failures."""

import uuid

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Location, ProviderSubscription

DEFAULT_TEST_HOUSEHOLD_ID = uuid.UUID("4eeb7681-8419-4c52-b800-6fef6c7ee51b")


@pytest.mark.asyncio
async def test_item_not_found_and_ownership_validation_edges(client: AsyncClient, db_session: AsyncSession):
    """Verify 404 when item is missing and 400 when location/provider belong to another household."""
    fake_id = uuid.uuid4()

    # 1. GET nonexistent item -> 404
    res_get = await client.get(f"/api/v1/library/items/{fake_id}")
    assert res_get.status_code == 404

    # 2. PUT nonexistent item -> 404
    res_put = await client.put(f"/api/v1/library/items/{fake_id}", json={"title": "Updated"})
    assert res_put.status_code == 404

    # 3. DELETE nonexistent item -> 404
    res_del = await client.delete(f"/api/v1/library/items/{fake_id}")
    assert res_del.status_code == 404

    # 4. POST with location belonging to other household -> 400
    foreign_loc = Location(name="Foreign Shelf", household_id=uuid.uuid4())
    db_session.add(foreign_loc)
    await db_session.commit()
    await db_session.refresh(foreign_loc)

    res_loc_bad = await client.post(
        "/api/v1/library/items",
        json={"title": "Book A", "media_type": "BOOK", "location_id": str(foreign_loc.id)},
    )
    assert res_loc_bad.status_code == 400
    assert "does not exist in household" in res_loc_bad.json()["detail"]

    # 5. POST with provider belonging to other household -> 400
    foreign_prov = ProviderSubscription(provider_name="Foreign Net", household_id=uuid.uuid4(), is_active=True)
    db_session.add(foreign_prov)
    await db_session.commit()
    await db_session.refresh(foreign_prov)

    res_prov_bad = await client.post(
        "/api/v1/library/items",
        json={"title": "Movie A", "media_type": "MOVIE", "provider_id": str(foreign_prov.id)},
    )
    assert res_prov_bad.status_code == 400
    assert "does not exist in household" in res_prov_bad.json()["detail"]


@pytest.mark.asyncio
async def test_item_create_update_and_filtering_edges(client: AsyncClient, db_session: AsyncSession):
    """Verify item creation with owned location/provider, update edge cases, and query filters."""
    # Create owned location and provider
    loc = Location(name="Main Shelf", household_id=DEFAULT_TEST_HOUSEHOLD_ID)
    prov = ProviderSubscription(provider_name="Home Stream", household_id=DEFAULT_TEST_HOUSEHOLD_ID, is_active=True)
    db_session.add_all([loc, prov])
    await db_session.commit()
    await db_session.refresh(loc)
    await db_session.refresh(prov)

    # 1. Create item with valid location_id and provider_id
    res_create = await client.post(
        "/api/v1/library/items",
        json={
            "title": "Italian Cooking",
            "media_type": "BOOK",
            "is_cookbook": True,
            "location_id": str(loc.id),
            "provider_id": str(prov.id),
        },
    )
    assert res_create.status_code == 201

    item_id = res_create.json()["id"]

    # 2. Filter list by location_id, media_type, is_cookbook, status
    res_list = await client.get(
        f"/api/v1/library/items?location_id={loc.id}&media_type=BOOK&is_cookbook=true&status=AVAILABLE&skip=0&limit=10"
    )
    assert res_list.status_code == 200
    assert res_list.json()["total"] >= 1

    # 3. Update item with new location and provider
    new_loc = Location(name="Kitchen Counter", household_id=DEFAULT_TEST_HOUSEHOLD_ID)
    new_prov = ProviderSubscription(
        provider_name="Cooking Plus", household_id=DEFAULT_TEST_HOUSEHOLD_ID, is_active=True
    )
    db_session.add_all([new_loc, new_prov])
    await db_session.commit()
    await db_session.refresh(new_loc)
    await db_session.refresh(new_prov)

    res_update = await client.put(
        f"/api/v1/library/items/{item_id}",
        json={
            "title": "Modern Italian Cooking",
            "location_id": str(new_loc.id),
            "provider_id": str(new_prov.id),
        },
    )
    assert res_update.status_code == 200

    assert res_update.json()["title"] == "Modern Italian Cooking"
    assert res_update.json()["location_id"] == str(new_loc.id)

    # 4. Delete item
    res_delete = await client.delete(f"/api/v1/library/items/{item_id}")
    assert res_delete.status_code == 204

    # Verify deleted
    res_get_deleted = await client.get(f"/api/v1/library/items/{item_id}")
    assert res_get_deleted.status_code == 404
