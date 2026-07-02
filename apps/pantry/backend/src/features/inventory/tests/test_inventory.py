import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.core.dependencies import MOCK_HOME_ID
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


@pytest.mark.asyncio
async def test_get_low_stock_items(client: AsyncClient):
    """Verify that the low stock query aggregates quantity and compares it against minimum_stock."""
    # Find Spaghetti and Oatly products
    async with db_session_factory() as session:
        # Update minimum stock values for products to test thresholds
        spag_res = await session.exec(select(Product).where(Product.barcode == "8013383000570"))
        spaghetti = spag_res.one()
        spaghetti.minimum_stock = 600.0  # Currently has 500.0, so should be low stock

        oatly_res = await session.exec(select(Product).where(Product.barcode == "7394376615967"))
        oatly = oatly_res.one()
        oatly.minimum_stock = 2000.0  # Currently has 3000.0, so should NOT be low stock

        # Create a new local product with minimum_stock = 10.0 and NO stock at all
        new_prod = Product(
            name="Zero Stock Product",
            brand="Brand X",
            base_unit="piece",
            minimum_stock=10.0,
            is_global=False,
            home_id=MOCK_HOME_ID
        )
        session.add(new_prod)
        await session.commit()
        await session.refresh(new_prod)
        new_prod_id = new_prod.id

    # Query low stock items
    response = await client.get("/api/v1/inventory/low-stock")
    assert response.status_code == 200
    data = response.json()

    # Spaghetti (500 < 600) and Zero Stock Product (0 < 10) should be low stock.
    # Oatly (3000 >= 2000) should NOT be in the list.
    low_stock_product_ids = {item["product"]["id"] for item in data}
    assert str(spaghetti.id) in low_stock_product_ids
    assert str(new_prod_id) in low_stock_product_ids
    assert str(oatly.id) not in low_stock_product_ids

    # Verify returned quantities
    items = {item["product"]["id"]: item for item in data}
    assert items[str(spaghetti.id)]["current_stock"] == 500.0
    assert items[str(new_prod_id)]["current_stock"] == 0.0


@pytest.mark.asyncio
async def test_get_expiration_summary(client: AsyncClient):
    """Verify that the expiration summary correctly categorizes stock by expiration date."""
    from datetime import date, timedelta
    from src.features.inventory.models import InventoryState

    # Get products and location to set custom stock records
    async with db_session_factory() as session:
        spag_res = await session.exec(select(Product).where(Product.barcode == "8013383000570"))
        spaghetti = spag_res.one()
        oatly_res = await session.exec(select(Product).where(Product.barcode == "7394376615967"))
        oatly = oatly_res.one()
        loc_res = await session.exec(select(Location).where(Location.name == "Backlog"))
        backlog = loc_res.one()

        # Delete all existing InventoryState records to start clean
        existing_states = await session.exec(select(InventoryState))
        for state in existing_states.all():
            await session.delete(state)
        await session.commit()

        # Add 1: Expired item (expiration_date in the past)
        expired_state = InventoryState(
            product_id=spaghetti.id,
            location_id=backlog.id,
            quantity=100.0,
            expiration_date=date.today() - timedelta(days=5),
        )
        session.add(expired_state)

        # Add 2: Valid item (expiration_date in the future)
        valid_state = InventoryState(
            product_id=oatly.id,
            location_id=backlog.id,
            quantity=200.0,
            expiration_date=date.today() + timedelta(days=10),
        )
        session.add(valid_state)

        # Add 3: Infinite item (sentinel expiration date '9999-12-31')
        infinite_state = InventoryState(
            product_id=spaghetti.id,
            location_id=backlog.id,
            quantity=300.0,
            batch_code="infinite-batch",
            expiration_date=date(9999, 12, 31),
        )
        session.add(infinite_state)

        # Add 4: Untracked item (expiration_date is None)
        untracked_state = InventoryState(
            product_id=oatly.id,
            location_id=backlog.id,
            quantity=400.0,
            batch_code="untracked-batch",
            expiration_date=None,
        )
        session.add(untracked_state)

        await session.commit()

    # Query expiration summary
    response = await client.get("/api/v1/inventory/expiration-summary")
    assert response.status_code == 200
    data = response.json()

    # Verify categorization counts
    assert len(data["expired"]) == 1
    assert len(data["valid"]) == 2  # Future date + 9999-12-31 sentinel date
    assert len(data["untracked"]) == 1

    # Verify details
    assert data["expired"][0]["quantity"] == 100.0

    valid_quantities = {item["quantity"] for item in data["valid"]}
    assert 200.0 in valid_quantities
    assert 300.0 in valid_quantities

    assert data["untracked"][0]["quantity"] == 400.0

