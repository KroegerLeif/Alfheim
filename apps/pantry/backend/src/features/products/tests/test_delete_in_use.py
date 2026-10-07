import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.locations.models import Location
from src.features.locations.seeder import seed_default_locations


@pytest.fixture(autouse=True)
async def seed_locations(db_session: AsyncSession):
    """Seed the Backlog system location used by the stock transactions."""
    await seed_default_locations(db_session)
    await db_session.commit()


async def _backlog_id(db_session: AsyncSession) -> str:
    return str((await db_session.exec(select(Location).where(Location.is_system))).one().id)


async def test_delete_product_with_stock_returns_409_with_count(client: AsyncClient, db_session: AsyncSession):
    """A product that has stock or ledger history cannot be deleted; the 409 carries code and count."""
    product = (await client.post("/api/v1/products", json={"name": "Rice", "base_unit": "g"})).json()
    tx = await client.post(
        "/api/v1/inventory/transactions",
        json={
            "product_id": product["id"],
            "location_id": await _backlog_id(db_session),
            "transaction_type": "in",
            "quantity_input": 500,
            "unit_input": "g",
        },
    )
    assert tx.status_code == 201

    response = await client.delete(f"/api/v1/products/{product['id']}")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "product_in_use"
    assert detail["item_count"] == 2  # one stock line plus one ledger entry
    assert (await client.get(f"/api/v1/products/{product['id']}")).status_code == 200


async def test_create_product_persists_minimum_stock(client: AsyncClient):
    """The minimum stock threshold sent on create is stored (low-stock alerts depend on it)."""
    response = await client.post("/api/v1/products", json={"name": "Salt", "base_unit": "g", "minimum_stock": 250})
    assert response.status_code == 201
    assert response.json()["minimum_stock"] == 250

    fetched = await client.get(f"/api/v1/products/{response.json()['id']}")
    assert fetched.json()["minimum_stock"] == 250
