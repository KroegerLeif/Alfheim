"""Deleting a location or provider that items still reference must return a clean 409 (issue #558)."""

import uuid

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Item, Location, MediaType, ProviderSubscription

HOUSEHOLD_ID = uuid.UUID("4eeb7681-8419-4c52-b800-6fef6c7ee51b")
OTHER_HOUSEHOLD_ID = uuid.uuid4()


def _item(**fields) -> Item:
    return Item(household_id=HOUSEHOLD_ID, title="Dune", media_type=MediaType.BOOK, **fields)


@pytest.mark.asyncio
async def test_delete_location_with_items_returns_409_and_keeps_everything(
    client: AsyncClient, db_session: AsyncSession
):
    location = Location(household_id=HOUSEHOLD_ID, name="Shelf")
    db_session.add(location)
    await db_session.commit()
    item = _item(location_id=location.id)
    db_session.add(item)
    await db_session.commit()

    response = await client.delete(f"/api/v1/library/locations/{location.id}")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "location_in_use"
    assert detail["item_count"] == 1
    assert (await client.get(f"/api/v1/library/locations/{location.id}")).status_code == 200
    kept = (await client.get(f"/api/v1/library/items/{item.id}")).json()
    assert kept["location_id"] == str(location.id)


@pytest.mark.asyncio
async def test_delete_location_counts_items_in_descendants(client: AsyncClient, db_session: AsyncSession):
    room = Location(household_id=HOUSEHOLD_ID, name="Room")
    db_session.add(room)
    await db_session.commit()
    shelf = Location(household_id=HOUSEHOLD_ID, name="Shelf", parent_id=room.id)
    db_session.add(shelf)
    await db_session.commit()
    box = Location(household_id=HOUSEHOLD_ID, name="Box", parent_id=shelf.id)
    db_session.add(box)
    await db_session.commit()
    db_session.add_all([_item(location_id=box.id), _item(location_id=box.id)])
    await db_session.commit()

    response = await client.delete(f"/api/v1/library/locations/{room.id}")

    assert response.status_code == 409
    assert response.json()["detail"]["item_count"] == 2
    assert (await client.get(f"/api/v1/library/locations/{box.id}")).status_code == 200


@pytest.mark.asyncio
async def test_delete_location_succeeds_once_items_moved(client: AsyncClient, db_session: AsyncSession):
    location = Location(household_id=HOUSEHOLD_ID, name="Shelf")
    db_session.add(location)
    await db_session.commit()
    item = _item(location_id=location.id)
    db_session.add(item)
    await db_session.commit()

    moved = await client.put(f"/api/v1/library/items/{item.id}", json={"location_id": None})
    assert moved.status_code == 200
    assert (await client.delete(f"/api/v1/library/locations/{location.id}")).status_code == 204


@pytest.mark.asyncio
async def test_delete_empty_location_tree_removes_children(client: AsyncClient, db_session: AsyncSession):
    room = Location(household_id=HOUSEHOLD_ID, name="Room")
    db_session.add(room)
    await db_session.commit()
    shelf = Location(household_id=HOUSEHOLD_ID, name="Shelf", parent_id=room.id)
    db_session.add(shelf)
    await db_session.commit()

    assert (await client.delete(f"/api/v1/library/locations/{room.id}")).status_code == 204
    assert (await client.get(f"/api/v1/library/locations/{shelf.id}")).status_code == 404


@pytest.mark.asyncio
async def test_delete_location_ignores_items_of_other_households(client: AsyncClient, db_session: AsyncSession):
    location = Location(household_id=HOUSEHOLD_ID, name="Shelf")
    db_session.add(location)
    await db_session.commit()
    foreign = Item(
        household_id=OTHER_HOUSEHOLD_ID,
        title="Foreign",
        media_type=MediaType.BOOK,
        location_id=location.id,
    )
    db_session.add(foreign)
    await db_session.commit()

    assert (await client.delete(f"/api/v1/library/locations/{location.id}")).status_code == 204


@pytest.mark.asyncio
async def test_delete_provider_with_items_returns_409(client: AsyncClient, db_session: AsyncSession):
    provider = ProviderSubscription(household_id=HOUSEHOLD_ID, provider_name="Netflix")
    db_session.add(provider)
    await db_session.commit()
    item = _item(provider_id=provider.id)
    db_session.add(item)
    await db_session.commit()

    response = await client.delete(f"/api/v1/library/providers/{provider.id}")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "provider_in_use"
    assert detail["item_count"] == 1
    assert (await client.get(f"/api/v1/library/providers/{provider.id}")).status_code == 200
    assert (await client.get(f"/api/v1/library/items/{item.id}")).json()["provider_id"] == str(provider.id)


@pytest.mark.asyncio
async def test_delete_provider_succeeds_once_items_unlinked(client: AsyncClient, db_session: AsyncSession):
    provider = ProviderSubscription(household_id=HOUSEHOLD_ID, provider_name="Netflix")
    db_session.add(provider)
    await db_session.commit()
    item = _item(provider_id=provider.id)
    db_session.add(item)
    await db_session.commit()

    unlinked = await client.put(f"/api/v1/library/items/{item.id}", json={"provider_id": None})
    assert unlinked.status_code == 200
    assert (await client.delete(f"/api/v1/library/providers/{provider.id}")).status_code == 204


@pytest.mark.asyncio
async def test_integrity_error_handler_returns_conflict_payload():
    """Constraint violations that slip past the explicit checks become a 409, not a bare 500."""
    from sqlalchemy.exc import IntegrityError
    from src.main import integrity_error_exception_handler
    from starlette.requests import Request

    request = Request({"type": "http", "method": "DELETE", "path": "/api/v1/library/locations/x", "headers": []})
    response = await integrity_error_exception_handler(
        request, IntegrityError("DELETE FROM locations", {}, Exception("foreign key constraint"))
    )

    assert response.status_code == 409
    assert b'"code":"conflict"' in response.body
