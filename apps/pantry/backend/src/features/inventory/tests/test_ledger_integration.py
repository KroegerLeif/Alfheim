import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.products.models import Product
from src.features.locations.models import Location

@pytest.fixture(autouse=True)
async def seed_ledger_data(db_session: AsyncSession):
    """Seed locations, products, and initial inventory levels for ledger tests."""
    from src.features.locations.seeder import seed_default_locations
    from src.features.products.seeder import seed_default_products
    from src.features.inventory.seeder import seed_default_inventory

    await seed_default_locations(db_session)
    await seed_default_products(db_session)
    await seed_default_inventory(db_session)
    await db_session.commit()

async def test_record_in_transaction_standard_unit(client: AsyncClient, db_session: AsyncSession):
    """Verify that posting an 'in' transaction with standard units adds stock correctly."""
    prod_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = prod_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    payload = {
        "product_id": str(spaghetti.id),
        "location_id": str(backlog.id),
        "transaction_type": "in",
        "quantity_input": 200.0,
        "unit_input": "g",
        "notes": "Added standard stock",
    }
    response = await client.post("/api/v1/inventory/transactions", json=payload)
    assert response.status_code == 201
    ledger_data = response.json()
    assert ledger_data["quantity"] == 200.0
    assert ledger_data["quantity_input"] == 200.0

    state_res = await client.get("/api/v1/inventory/state")
    states = {item["product_id"]: item for item in state_res.json()}
    assert states[str(spaghetti.id)]["quantity"] == 700.0

async def test_record_in_transaction_flexible_unit(client: AsyncClient, db_session: AsyncSession):
    """Verify that posting an 'in' transaction with a custom unit (l -> ml) normalizes correctly."""
    prod_res = await db_session.exec(select(Product).where(Product.barcode == "7394376615967"))
    oatly = prod_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    payload = {
        "product_id": str(oatly.id),
        "location_id": str(backlog.id),
        "transaction_type": "in",
        "quantity_input": 1.5,
        "unit_input": "l",
        "notes": "Added 1.5 liters of Oatly",
    }
    response = await client.post("/api/v1/inventory/transactions", json=payload)
    assert response.status_code == 201
    ledger_data = response.json()
    assert ledger_data["quantity"] == 1500.0
    assert ledger_data["quantity_input"] == 1.5

    state_res = await client.get("/api/v1/inventory/state")
    states = {item["product_id"]: item for item in state_res.json()}
    assert states[str(oatly.id)]["quantity"] == 4500.0

async def test_record_out_transaction_sufficient_stock(client: AsyncClient, db_session: AsyncSession):
    """Verify posting an 'out' transaction correctly decrements state cache stock."""
    prod_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = prod_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    payload = {
        "product_id": str(spaghetti.id),
        "location_id": str(backlog.id),
        "transaction_type": "out",
        "quantity_input": 200.0,
        "unit_input": "g",
    }
    response = await client.post("/api/v1/inventory/transactions", json=payload)
    assert response.status_code == 201
    ledger_data = response.json()
    assert ledger_data["quantity"] == -200.0

    state_res = await client.get("/api/v1/inventory/state")
    states = {item["product_id"]: item for item in state_res.json()}
    assert states[str(spaghetti.id)]["quantity"] == 300.0

async def test_record_out_transaction_insufficient_stock(client: AsyncClient, db_session: AsyncSession):
    """Verify that posting an 'out' transaction exceeding available stock returns HTTP 400."""
    prod_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = prod_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    payload = {
        "product_id": str(spaghetti.id),
        "location_id": str(backlog.id),
        "transaction_type": "out",
        "quantity_input": 1000.0,
        "unit_input": "g",
    }
    response = await client.post("/api/v1/inventory/transactions", json=payload)
    assert response.status_code == 400
    assert "Insufficient stock" in response.json()["detail"]

async def test_out_transaction_to_zero_deletes_cache_row(client: AsyncClient, db_session: AsyncSession):
    """Verify that when a stock level drops to exactly zero, the state cache row is physically deleted."""
    prod_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = prod_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    payload = {
        "product_id": str(spaghetti.id),
        "location_id": str(backlog.id),
        "transaction_type": "out",
        "quantity_input": 500.0,
        "unit_input": "g",
    }
    response = await client.post("/api/v1/inventory/transactions", json=payload)
    assert response.status_code == 201

    state_res = await client.get("/api/v1/inventory/state")
    states = [item for item in state_res.json() if item["product_id"] == str(spaghetti.id)]
    assert len(states) == 0

async def test_reconciliation_transaction(client: AsyncClient, db_session: AsyncSession):
    """Verify reconciliation transaction sets the absolute stock level and records the delta in the ledger."""
    prod_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = prod_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    payload = {
        "product_id": str(spaghetti.id),
        "location_id": str(backlog.id),
        "transaction_type": "reconciliation",
        "quantity_input": 1200.0,
        "unit_input": "g",
        "notes": "Inventory audit",
    }
    response = await client.post("/api/v1/inventory/transactions", json=payload)
    assert response.status_code == 201
    ledger_data = response.json()
    assert ledger_data["quantity"] == 700.0
    assert ledger_data["quantity_input"] == 1200.0

    state_res = await client.get("/api/v1/inventory/state")
    states = {item["product_id"]: item for item in state_res.json()}
    assert states[str(spaghetti.id)]["quantity"] == 1200.0

async def test_incompatible_dimensions_fails(client: AsyncClient, db_session: AsyncSession):
    """Verify that posting a transaction with incompatible unit dimensions returns HTTP 400."""
    prod_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = prod_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    payload = {
        "product_id": str(spaghetti.id),
        "location_id": str(backlog.id),
        "transaction_type": "in",
        "quantity_input": 500.0,
        "unit_input": "ml",
    }
    response = await client.post("/api/v1/inventory/transactions", json=payload)
    assert response.status_code == 400
    assert "dimensionally incompatible" in response.json()["detail"]

async def test_unrecognized_unit_validation_fails(client: AsyncClient, db_session: AsyncSession):
    """Verify that posting a completely unrecognized unit fails syntactic validation (HTTP 422)."""
    prod_res = await db_session.exec(select(Product).where(Product.barcode == "8013383000570"))
    spaghetti = prod_res.one()
    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    payload = {
        "product_id": str(spaghetti.id),
        "location_id": str(backlog.id),
        "transaction_type": "in",
        "quantity_input": 1.0,
        "unit_input": "random_fake_unit",
    }
    response = await client.post("/api/v1/inventory/transactions", json=payload)
    assert response.status_code == 422
    assert "Unrecognized unit of measurement" in response.json()["detail"][0]["msg"]

async def test_count_based_product_flexible_units(client: AsyncClient, db_session: AsyncSession):
    """Verify that a product with base_unit 'piece' can accept 'pack' and normalizes correctly."""
    create_prod_res = await client.post(
        "/api/v1/products",
        json={"name": "Canned Tomatoes", "brand": "Mutti", "base_unit": "piece"},
    )
    assert create_prod_res.status_code == 201
    tomatoes = create_prod_res.json()

    loc_res = await db_session.exec(select(Location).where(Location.name == "Backlog"))
    backlog = loc_res.one()

    payload = {
        "product_id": tomatoes["id"],
        "location_id": str(backlog.id),
        "transaction_type": "in",
        "quantity_input": 2.0,
        "unit_input": "pack",
        "notes": "Added 2 packs",
    }
    response = await client.post("/api/v1/inventory/transactions", json=payload)
    assert response.status_code == 201
    ledger_data = response.json()
    assert ledger_data["quantity"] == 2.0
    assert ledger_data["unit_input"] == "pack"

    state_res = await client.get("/api/v1/inventory/state")
    states = {item["product_id"]: item for item in state_res.json()}
    assert states[tomatoes["id"]]["quantity"] == 2.0
