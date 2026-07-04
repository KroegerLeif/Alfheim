import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import MOCK_HOME_ID
from src.features.products.models import Product
from src.features.locations.models import Location
from src.features.inventory.models import InventoryState

@pytest.fixture(autouse=True)
async def seed_inventory_data(db_session: AsyncSession):
    """Seed locations, products, and default inventory for testing."""
    from src.features.locations.seeder import seed_default_locations
    from src.features.products.seeder import seed_default_products
    from src.features.inventory.seeder import seed_default_inventory

    await seed_default_locations(db_session)
    await seed_default_products(db_session)
    await seed_default_inventory(db_session)
    await db_session.commit()

async def test_startup_seeds_inventory(client: AsyncClient):
    """Verify that default inventory levels are correctly seeded on startup."""
    response = await client.get("/api/v1/inventory/state")
    assert response.status_code == 200
    data = response.json()

    assert len(data) == 2

    products = {item["product"]["barcode"]: item for item in data if item.get("product")}
    assert "8013383000570" in products  # Spaghetti
    assert "7394376615967" in products  # Oatly

    spaghetti_state = products["8013383000570"]
    assert spaghetti_state["quantity"] == 500.0
    assert spaghetti_state["location"]["name"] == "Backlog"

async def test_get_low_stock_items(client: AsyncClient, db_session: AsyncSession):
    """Verify that the low stock query aggregates quantity and compares it against minimum_stock."""
    spag_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = spag_res.one()
    spaghetti.minimum_stock = 600.0

    oatly_res = await db_session.exec(select(Product).where(Product.barcode == "7394376615967"))
    oatly = oatly_res.one()
    oatly.minimum_stock = 2000.0

    new_prod = Product(
        name="Zero Stock Product",
        brand="Brand X",
        base_unit="piece",
        minimum_stock=10.0,
        is_global=False,
        home_id=MOCK_HOME_ID
    )
    db_session.add(new_prod)
    await db_session.commit()
    await db_session.refresh(new_prod)
    new_prod_id = new_prod.id

    response = await client.get("/api/v1/inventory/low-stock")
    assert response.status_code == 200
    data = response.json()

    low_stock_product_ids = {item["product"]["id"] for item in data}
    assert str(spaghetti.id) in low_stock_product_ids
    assert str(new_prod_id) in low_stock_product_ids
    assert str(oatly.id) not in low_stock_product_ids

    items = {item["product"]["id"]: item for item in data}
    assert items[str(spaghetti.id)]["current_stock"] == 500.0
    assert items[str(new_prod_id)]["current_stock"] == 0.0

async def test_get_expiration_summary(client: AsyncClient, db_session: AsyncSession):
    """Verify that the expiration summary correctly categorizes stock by expiration date."""
    from datetime import date, timedelta

    spag_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = spag_res.one()
    oatly_res = await db_session.exec(select(Product).where(Product.barcode == "7394376615967"))
    oatly = oatly_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    existing_states = await db_session.exec(select(InventoryState))
    for state in existing_states.all():
        await db_session.delete(state)
    await db_session.commit()

    expired_state = InventoryState(
        product_id=spaghetti.id,
        location_id=backlog.id,
        quantity=100.0,
        expiration_date=date.today() - timedelta(days=5),
    )
    db_session.add(expired_state)

    valid_state = InventoryState(
        product_id=oatly.id,
        location_id=backlog.id,
        quantity=200.0,
        expiration_date=date.today() + timedelta(days=10),
    )
    db_session.add(valid_state)

    infinite_state = InventoryState(
        product_id=spaghetti.id,
        location_id=backlog.id,
        quantity=300.0,
        batch_code="infinite-batch",
        expiration_date=date(9999, 12, 31),
    )
    db_session.add(infinite_state)

    untracked_state = InventoryState(
        product_id=oatly.id,
        location_id=backlog.id,
        quantity=400.0,
        batch_code="untracked-batch",
        expiration_date=None,
    )
    db_session.add(untracked_state)

    await db_session.commit()

    response = await client.get("/api/v1/inventory/expiration-summary")
    assert response.status_code == 200
    data = response.json()

    assert len(data["expired"]) == 1
    assert len(data["valid"]) == 2
    assert len(data["untracked"]) == 1

    assert data["expired"][0]["quantity"] == 100.0

    valid_quantities = {item["quantity"] for item in data["valid"]}
    assert 200.0 in valid_quantities
    assert 300.0 in valid_quantities

    assert data["untracked"][0]["quantity"] == 400.0
