import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.features.products.models import Product
from src.features.locations.models import Location
from src.main import app

# Use an in-memory SQLite database for test runs
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, future=True)
db_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db_session():
    """Override database session dependency to use test session factory."""
    async with db_session_factory() as session:
        yield session


@pytest_asyncio.fixture(autouse=True, scope="function")
async def setup_db():
    """Automatically create and drop tables for each test function, and seed defaults."""
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # Seed global locations, products, and default inventory
    async with db_session_factory() as session:
        from src.features.locations.seeder import seed_default_locations
        from src.features.products.seeder import seed_default_products
        from src.features.inventory.seeder import seed_default_inventory

        await seed_default_locations(session)
        await seed_default_products(session)
        await seed_default_inventory(session)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    """ASGI test client fixture."""
    app.dependency_overrides[get_db_session] = override_get_db_session
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.pop(get_db_session, None)


@pytest.mark.asyncio
async def test_startup_seeds_inventory(client: AsyncClient):
    """Verify that default inventory levels are correctly seeded on startup."""
    response = await client.get("/api/v1/inventory/state")
    assert response.status_code == 200
    data = response.json()

    # The 2 inventory state items seeded: Spaghetti (500 g) and Oatly (3000 ml)
    assert len(data) == 2

    products = {item["product"]["barcode"]: item for item in data if item.get("product")}
    assert "8013383000570" in products  # Spaghetti
    assert "7394376615967" in products  # Oatly

    # Verify quantities and relations are loaded
    spaghetti_state = products["8013383000570"]
    assert spaghetti_state["quantity"] == 500.0
    assert spaghetti_state["location"]["name"] == "Backlog"

    oatly_state = products["7394376615967"]
    assert oatly_state["quantity"] == 3000.0
    assert oatly_state["location"]["name"] == "Backlog"


@pytest.mark.asyncio
async def test_record_in_transaction_standard_unit(client: AsyncClient):
    """Verify that posting an 'in' transaction with standard units adds stock correctly."""
    # Find Spaghetti product
    async with db_session_factory() as session:
        prod_res = await session.exec(select(Product).where(Product.barcode == "8013383000570"))
        spaghetti = prod_res.one()
        loc_res = await session.exec(select(Location).where(Location.name == "Backlog"))
        backlog = loc_res.one()

    # Add 200 more grams
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
    assert ledger_data["unit_input"] == "g"

    # Verify state cache shows 500 + 200 = 700 g
    state_res = await client.get("/api/v1/inventory/state")
    states = {item["product_id"]: item for item in state_res.json()}
    assert states[str(spaghetti.id)]["quantity"] == 700.0


@pytest.mark.asyncio
async def test_record_in_transaction_flexible_unit(client: AsyncClient):
    """Verify that posting an 'in' transaction with a custom unit (l -> ml) normalizes correctly."""
    async with db_session_factory() as session:
        prod_res = await session.exec(select(Product).where(Product.barcode == "7394376615967"))
        oatly = prod_res.one()
        loc_res = await session.exec(select(Location).where(Location.name == "Backlog"))
        backlog = loc_res.one()

    # Add 1.5 liters of Oatly (base unit is ml)
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
    assert ledger_data["quantity"] == 1500.0  # normalized strictly to ml
    assert ledger_data["quantity_input"] == 1.5
    assert ledger_data["unit_input"] == "l"

    # Verify state cache shows 3000 + 1500 = 4500 ml
    state_res = await client.get("/api/v1/inventory/state")
    states = {item["product_id"]: item for item in state_res.json()}
    assert states[str(oatly.id)]["quantity"] == 4500.0


@pytest.mark.asyncio
async def test_record_out_transaction_sufficient_stock(client: AsyncClient):
    """Verify posting an 'out' transaction correctly decrements state cache stock."""
    async with db_session_factory() as session:
        prod_res = await session.exec(select(Product).where(Product.barcode == "8013383000570"))
        spaghetti = prod_res.one()
        loc_res = await session.exec(select(Location).where(Location.name == "Backlog"))
        backlog = loc_res.one()

    # Consume 200 grams of Spaghetti
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
    assert ledger_data["quantity"] == -200.0  # logged negative in ledger

    # Verify state cache shows 500 - 200 = 300 g
    state_res = await client.get("/api/v1/inventory/state")
    states = {item["product_id"]: item for item in state_res.json()}
    assert states[str(spaghetti.id)]["quantity"] == 300.0


@pytest.mark.asyncio
async def test_record_out_transaction_insufficient_stock(client: AsyncClient):
    """Verify that posting an 'out' transaction exceeding available stock returns HTTP 400."""
    async with db_session_factory() as session:
        prod_res = await session.exec(select(Product).where(Product.barcode == "8013383000570"))
        spaghetti = prod_res.one()
        loc_res = await session.exec(select(Location).where(Location.name == "Backlog"))
        backlog = loc_res.one()

    # Try to consume 1000 grams (we only have 500)
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


@pytest.mark.asyncio
async def test_out_transaction_to_zero_deletes_cache_row(client: AsyncClient):
    """Verify that when a stock level drops to exactly zero, the state cache row is physically deleted."""
    async with db_session_factory() as session:
        prod_res = await session.exec(select(Product).where(Product.barcode == "8013383000570"))
        spaghetti = prod_res.one()
        loc_res = await session.exec(select(Location).where(Location.name == "Backlog"))
        backlog = loc_res.one()

    # Consume all 500 grams of Spaghetti
    payload = {
        "product_id": str(spaghetti.id),
        "location_id": str(backlog.id),
        "transaction_type": "out",
        "quantity_input": 500.0,
        "unit_input": "g",
    }
    response = await client.post("/api/v1/inventory/transactions", json=payload)
    assert response.status_code == 201

    # Verify Spaghetti state cache row is physically deleted from the cache table
    state_res = await client.get("/api/v1/inventory/state")
    states = [item for item in state_res.json() if item["product_id"] == str(spaghetti.id)]
    assert len(states) == 0


@pytest.mark.asyncio
async def test_reconciliation_transaction(client: AsyncClient):
    """Verify reconciliation transaction sets the absolute stock level and records the delta in the ledger."""
    async with db_session_factory() as session:
        prod_res = await session.exec(select(Product).where(Product.barcode == "8013383000570"))
        spaghetti = prod_res.one()
        loc_res = await session.exec(select(Location).where(Location.name == "Backlog"))
        backlog = loc_res.one()

    # Reconcile physical stock to exactly 1200 g (starting at 500 g)
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
    assert ledger_data["quantity"] == 700.0  # delta recorded: 1200 - 500 = 700
    assert ledger_data["quantity_input"] == 1200.0

    # Verify state cache shows exactly 1200 g
    state_res = await client.get("/api/v1/inventory/state")
    states = {item["product_id"]: item for item in state_res.json()}
    assert states[str(spaghetti.id)]["quantity"] == 1200.0


@pytest.mark.asyncio
async def test_incompatible_dimensions_fails(client: AsyncClient):
    """Verify that posting a transaction with incompatible unit dimensions returns HTTP 400."""
    async with db_session_factory() as session:
        prod_res = await session.exec(select(Product).where(Product.barcode == "8013383000570"))
        spaghetti = prod_res.one()  # base unit is g
        loc_res = await session.exec(select(Location).where(Location.name == "Backlog"))
        backlog = loc_res.one()

    # Try to add Spaghetti in milliliters (ml) which is dimensionally incompatible with g
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


@pytest.mark.asyncio
async def test_unrecognized_unit_validation_fails(client: AsyncClient):
    """Verify that posting a completely unrecognized unit fails syntactic validation (HTTP 422)."""
    async with db_session_factory() as session:
        prod_res = await session.exec(select(Product).where(Product.barcode == "8013383000570"))
        spaghetti = prod_res.one()
        loc_res = await session.exec(select(Location).where(Location.name == "Backlog"))
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


@pytest.mark.asyncio
async def test_count_based_product_flexible_units(client: AsyncClient):
    """Verify that a product with base_unit 'piece' can accept 'pack' and normalizes correctly."""
    # 1. Create a product with base_unit piece
    create_prod_res = await client.post(
        "/api/v1/products",
        json={"name": "Canned Tomatoes", "brand": "Mutti", "base_unit": "piece"},
    )
    assert create_prod_res.status_code == 201
    tomatoes = create_prod_res.json()

    async with db_session_factory() as session:
        loc_res = await session.exec(select(Location).where(Location.name == "Backlog"))
        backlog = loc_res.one()

    # 2. Add 2 packs (should convert to 2 pieces since 1 pack = 1 piece)
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
    assert ledger_data["quantity"] == 2.0  # converted to base unit: piece
    assert ledger_data["unit_input"] == "pack"

    # 3. Query state cache
    state_res = await client.get("/api/v1/inventory/state")
    states = {item["product_id"]: item for item in state_res.json()}
    assert states[tomatoes["id"]]["quantity"] == 2.0
