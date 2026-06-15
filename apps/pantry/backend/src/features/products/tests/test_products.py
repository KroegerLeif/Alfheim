import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.features.locations.dependencies import MOCK_HOME_ID
from src.features.products.models import BaseUnit
from src.features.products.schemas import ProductCreate, ProductNutritionCreate
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

    # Seed global products
    async with db_session_factory() as session:
        from src.features.products.seeder import seed_default_products
        await seed_default_products(session)

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
async def test_startup_seeds_products(client: AsyncClient):
    """Verify that default global products are seeded on startup."""
    response = await client.get("/api/v1/products")
    assert response.status_code == 200
    data = response.json()

    # The 3 products from default_products.json
    assert len(data) >= 3
    barcodes = {prod["barcode"] for prod in data if prod.get("barcode")}
    assert "7394376615967" in barcodes  # Oatly
    assert "8013383000570" in barcodes  # Spaghetti
    assert "4006381333931" in barcodes  # Volvic

    for prod in data:
        assert prod["is_global"] is True
        assert prod["home_id"] is None
        assert "nutrition" not in prod  # Core list query excludes nutrition payload


@pytest.mark.asyncio
async def test_create_personal_product(client: AsyncClient):
    """Verify that a home user can create a personal/local product blueprint."""
    payload = {
        "name": "Oma's Strawberry Jam",
        "brand": "Homemade",
        "barcode": None,
        "base_unit": "g",
        "image_url": "http://jam.jpg",
        "nutrition": {
            "calories": 250,
            "fat": 0.1,
            "saturated_fat": 0,
            "carbohydrates": 60,
            "sugars": 55,
            "protein": 0.4,
            "salt": 0.01,
        },
    }
    response = await client.post("/api/v1/products", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "Oma's Strawberry Jam"
    assert data["brand"] == "Homemade"
    assert data["barcode"] is None
    assert data["base_unit"] == "g"
    assert data["is_global"] is False
    assert data["home_id"] == str(MOCK_HOME_ID)
    assert "id" in data

    # Verify nutrition details are isolated and fetched on-demand
    prod_id = data["id"]
    nutrition_response = await client.get(f"/api/v1/products/{prod_id}/nutrition")
    assert nutrition_response.status_code == 200
    nut_data = nutrition_response.json()
    assert nut_data["calories"] == 250
    assert nut_data["sugars"] == 55
    assert nut_data["product_id"] == prod_id


@pytest.mark.asyncio
async def test_create_duplicate_barcode_clash(client: AsyncClient):
    """Verify barcode uniqueness is globally enforced."""
    # Oats is already seeded with barcode "7394376615967"
    payload = {
        "name": "Duplicate Oatly",
        "barcode": "7394376615967",
        "base_unit": "ml",
    }
    response = await client.post("/api/v1/products", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_and_search_products(client: AsyncClient):
    """Verify filtering and search options for products list."""
    # List all
    response = await client.get("/api/v1/products")
    assert response.status_code == 200
    data = response.json()
    orig_len = len(data)

    # Add a personal product
    await client.post(
        "/api/v1/products",
        json={"name": "Organic Honey", "brand": "BeeNice", "base_unit": "g"},
    )

    # List again
    response = await client.get("/api/v1/products")
    data = response.json()
    assert len(data) == orig_len + 1

    # Search by name "Honey"
    response = await client.get("/api/v1/products?name=honey")
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Organic Honey"

    # Search by barcode
    response = await client.get("/api/v1/products?barcode=7394376615967")
    data = response.json()
    assert len(data) == 1
    assert data[0]["brand"] == "Oatly"


@pytest.mark.asyncio
async def test_update_personal_product(client: AsyncClient):
    """Verify updating fields on a local product."""
    create_res = await client.post(
        "/api/v1/products",
        json={"name": "Almond Milk", "brand": "Alpro", "base_unit": "ml"},
    )
    prod_id = create_res.json()["id"]

    patch_res = await client.patch(
        f"/api/v1/products/{prod_id}",
        json={"name": "Unsweetened Almond Milk", "brand": "Alpro Premium"},
    )
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["name"] == "Unsweetened Almond Milk"
    assert data["brand"] == "Alpro Premium"


@pytest.mark.asyncio
async def test_update_global_product_blocked(client: AsyncClient):
    """Verify global products cannot be updated by home spaces."""
    list_res = await client.get("/api/v1/products")
    global_prod_id = list_res.json()[0]["id"]

    patch_res = await client.patch(
        f"/api/v1/products/{global_prod_id}",
        json={"name": "Hacked Global Product"},
    )
    assert patch_res.status_code == 400
    assert "Global products cannot be modified" in patch_res.json()["detail"]


@pytest.mark.asyncio
async def test_delete_personal_product_cascade(client: AsyncClient):
    """Verify that deleting a product cascades to its nutrition profile."""
    # Create product with nutrition
    create_res = await client.post(
        "/api/v1/products",
        json={
            "name": "Choco Bar",
            "base_unit": "g",
            "nutrition": {"calories": 500, "fat": 30},
        },
    )
    prod_id = create_res.json()["id"]

    # Delete product
    delete_res = await client.delete(f"/api/v1/products/{prod_id}")
    assert delete_res.status_code == 204

    # Verify product is deleted
    get_res = await client.get(f"/api/v1/products/{prod_id}")
    assert get_res.status_code == 404

    # Verify nutrition is also cleaned up
    get_nut_res = await client.get(f"/api/v1/products/{prod_id}/nutrition")
    assert get_nut_res.status_code == 404


@pytest.mark.asyncio
async def test_delete_global_product_blocked(client: AsyncClient):
    """Verify that global products cannot be deleted by home spaces."""
    list_res = await client.get("/api/v1/products")
    global_prod_id = list_res.json()[0]["id"]

    del_res = await client.delete(f"/api/v1/products/{global_prod_id}")
    assert del_res.status_code == 400
    assert "Global products cannot be deleted" in del_res.json()["detail"]


@pytest.mark.asyncio
async def test_update_nutrition_profile(client: AsyncClient):
    """Verify updating/adding nutrition details on-demand."""
    # 1. Product without nutrition
    create_res = await client.post(
        "/api/v1/products",
        json={"name": "Sea Salt", "base_unit": "g"},
    )
    prod_id = create_res.json()["id"]

    # Add nutrition profile
    patch_nut_res = await client.patch(
        f"/api/v1/products/{prod_id}/nutrition",
        json={"salt": 98.0, "calories": 0},
    )
    assert patch_nut_res.status_code == 200
    data = patch_nut_res.json()
    assert data["salt"] == 98.0
    assert data["calories"] == 0
    assert data["product_id"] == prod_id

    # 2. Verify update nutrition on global product is blocked
    list_res = await client.get("/api/v1/products")
    global_prod_id = list_res.json()[0]["id"]
    patch_global_nut = await client.patch(
        f"/api/v1/products/{global_prod_id}/nutrition",
        json={"calories": 999},
    )
    assert patch_global_nut.status_code == 400
    assert "Global product nutrition cannot be modified" in patch_global_nut.json()["detail"]


@pytest.mark.asyncio
async def test_barcode_lookup_cache_hit(client: AsyncClient):
    """Verify barcode lookup serves from local database if cached."""
    # Oatly is seeded with barcode "7394376615967"
    response = await client.get("/api/v1/products/barcode/7394376615967")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Oatly Barista Edition"
    assert data["brand"] == "Oatly"
    assert data["is_global"] is True


@pytest.mark.asyncio
@patch("src.features.products.router.off_client.get_by_barcode")
async def test_barcode_lookup_cache_miss_ingested(mock_get: AsyncMock, client: AsyncClient):
    """Verify cache miss triggers Open Food Facts client and auto-ingests data."""
    # Mock Open Food Facts lookup return payload
    mock_get.return_value = ProductCreate(
        name="Cola Zero",
        brand="Coca Cola",
        barcode="5449000131805",
        base_unit=BaseUnit.ML,
        image_url="http://cola.jpg",
        nutrition=ProductNutritionCreate(calories=0.3, sugar=0.0),
    )

    response = await client.get("/api/v1/products/barcode/5449000131805")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Cola Zero"
    assert data["brand"] == "Coca Cola"
    assert data["is_global"] is True  # Ingested from OFF should be global

    # Verify it was persisted locally
    local_check = await client.get(f"/api/v1/products/{data['id']}")
    assert local_check.status_code == 200
    assert local_check.json()["barcode"] == "5449000131805"


@pytest.mark.asyncio
@patch("src.features.products.router.off_client.get_by_barcode")
async def test_barcode_lookup_not_found(mock_get: AsyncMock, client: AsyncClient):
    """Verify that if OFF doesn't have the barcode, a 404 is returned."""
    mock_get.return_value = None

    response = await client.get("/api/v1/products/barcode/1234567890123")
    assert response.status_code == 404
    assert "could not be found or ingested" in response.json()["detail"]
