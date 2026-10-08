import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.locations.models import Location
from src.features.locations.seeder import seed_default_locations


@pytest.fixture(autouse=True)
async def seed_locations(db_session: AsyncSession):
    """Seed the Backlog system location."""
    await seed_default_locations(db_session)
    await db_session.commit()


async def _stock_up(client: AsyncClient, location_id: str, quantity: float = 3.0) -> str:
    product = (await client.post("/api/v1/products", json={"name": "Rice", "base_unit": "g"})).json()
    response = await client.post(
        "/api/v1/inventory/transactions",
        json={
            "product_id": product["id"],
            "location_id": location_id,
            "transaction_type": "in",
            "quantity_input": quantity,
            "unit_input": "g",
        },
    )
    assert response.status_code == 201
    return product["id"]


async def test_delete_location_with_stock_returns_409_with_count(client: AsyncClient):
    """A location that still holds stock cannot be deleted; the 409 carries a stable code and the count."""
    location = (await client.post("/api/v1/locations", json={"name": "Cellar"})).json()
    await _stock_up(client, location["id"])

    response = await client.delete(f"/api/v1/locations/{location['id']}")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "location_in_use"
    # One stock line plus the ledger entry that created it.
    assert detail["item_count"] == 2
    assert "Cellar" in detail["message"]
    assert (await client.get(f"/api/v1/locations/{location['id']}")).status_code == 200


async def test_delete_location_with_only_history_is_still_refused(client: AsyncClient):
    """The immutable ledger keeps referencing the location after the stock is gone."""
    location = (await client.post("/api/v1/locations", json={"name": "Cellar"})).json()
    product_id = await _stock_up(client, location["id"], quantity=3.0)
    out = await client.post(
        "/api/v1/inventory/transactions",
        json={
            "product_id": product_id,
            "location_id": location["id"],
            "transaction_type": "out",
            "quantity_input": 3.0,
            "unit_input": "g",
        },
    )
    assert out.status_code == 201

    response = await client.delete(f"/api/v1/locations/{location['id']}")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "location_in_use"
    assert detail["item_count"] == 2  # two ledger entries, no stock line left


async def test_delete_unused_location_still_works_without_backlog(client: AsyncClient, db_session: AsyncSession):
    """Deleting an empty custom location no longer depends on the fallback location."""
    location = (await client.post("/api/v1/locations", json={"name": "Spare shelf"})).json()
    backlog = (await db_session.exec(select(Location).where(Location.is_system))).one()
    await db_session.delete(backlog)
    await db_session.commit()

    assert (await client.delete(f"/api/v1/locations/{location['id']}")).status_code == 204
