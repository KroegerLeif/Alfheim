import pytest
import pytest_asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.core.dependencies import MOCK_HOME_ID
from src.features.categories import Category  # noqa: F401
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

    # Seed global categories
    async with db_session_factory() as session:
        from src.features.categories import seed_default_categories
        await seed_default_categories(session)

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
async def test_startup_seeds_categories(client: AsyncClient):
    """Verify that the default global categories are seeded on startup."""
    response = await client.get("/api/v1/categories")
    assert response.status_code == 200
    data = response.json()
    
    # We should have the 6 default global categories
    assert len(data) == 6
    names = {cat["name"] for cat in data}
    expected_names = {"Drinks", "Batteries", "Spices", "Grains", "Canned Goods", "Snacks"}
    assert names == expected_names
    for cat in data:
        assert cat["is_global"] is True
        assert cat["home_id"] is None


@pytest.mark.asyncio
async def test_create_personal_category(client: AsyncClient):
    """Verify that a new personal category can be created successfully."""
    payload = {"name": "Fresh Veggies", "description": "Vegetables in the crisper drawer"}
    response = await client.post("/api/v1/categories", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Fresh Veggies"
    assert data["description"] == "Vegetables in the crisper drawer"
    assert data["is_global"] is False
    assert data["home_id"] == str(MOCK_HOME_ID)
    assert "id" in data


@pytest.mark.asyncio
async def test_create_personal_category_clash_global(client: AsyncClient):
    """Verify we cannot create a personal category with the same name as a global one."""
    payload = {"name": "Drinks", "description": "Custom drinks category"}
    response = await client.post("/api/v1/categories", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_personal_category_clash_personal(client: AsyncClient):
    """Verify we cannot create duplicate personal categories in the same home space."""
    payload = {"name": "Baking Goods"}
    res1 = await client.post("/api/v1/categories", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/categories", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_list_and_filter_categories(client: AsyncClient):
    """Verify listing and filtering active categories."""
    # Create a custom category
    await client.post("/api/v1/categories", json={"name": "Baking"})

    # List all (should include the 6 global + 1 custom = 7 total)
    response = await client.get("/api/v1/categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 7

    # Filter by name "Baking"
    response = await client.get("/api/v1/categories?name=Baking")
    assert response.status_code == 200
    filtered = response.json()
    assert len(filtered) == 1
    assert filtered[0]["name"] == "Baking"


@pytest.mark.asyncio
async def test_get_category_by_id(client: AsyncClient):
    """Verify getting details of a specific category by ID."""
    # 1. Get a global category ID from the list
    list_res = await client.get("/api/v1/categories")
    global_id = list_res.json()[0]["id"]

    get_res = await client.get(f"/api/v1/categories/{global_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == global_id

    # 2. Get a personal category by ID
    create_res = await client.post("/api/v1/categories", json={"name": "Condiments"})
    personal_id = create_res.json()["id"]

    get_personal = await client.get(f"/api/v1/categories/{personal_id}")
    assert get_personal.status_code == 200
    assert get_personal.json()["name"] == "Condiments"

    # 3. Get non-existent
    fake_id = uuid.uuid4()
    response = await client.get(f"/api/v1/categories/{fake_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_personal_category(client: AsyncClient):
    """Verify updating fields of a personal category."""
    create_res = await client.post("/api/v1/categories", json={"name": "Pasta", "description": "Dry pasta"})
    cat_id = create_res.json()["id"]

    # Partial update
    patch_res = await client.patch(f"/api/v1/categories/{cat_id}", json={"name": "Pasta & Grains", "description": "Updated"})
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["name"] == "Pasta & Grains"
    assert data["description"] == "Updated"


@pytest.mark.asyncio
async def test_update_global_category_blocked(client: AsyncClient):
    """Verify that global categories cannot be modified."""
    list_res = await client.get("/api/v1/categories")
    global_id = list_res.json()[0]["id"]

    patch_res = await client.patch(f"/api/v1/categories/{global_id}", json={"name": "New Global Name"})
    assert patch_res.status_code == 400
    assert "Global categories cannot be modified" in patch_res.json()["detail"]


@pytest.mark.asyncio
async def test_delete_personal_category(client: AsyncClient):
    """Verify deleting a personal category."""
    create_res = await client.post("/api/v1/categories", json={"name": "Sauces"})
    cat_id = create_res.json()["id"]

    del_res = await client.delete(f"/api/v1/categories/{cat_id}")
    assert del_res.status_code == 204

    # Verify it is gone
    get_res = await client.get(f"/api/v1/categories/{cat_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_delete_global_category_blocked(client: AsyncClient):
    """Verify that global categories cannot be deleted."""
    list_res = await client.get("/api/v1/categories")
    global_id = list_res.json()[0]["id"]

    del_res = await client.delete(f"/api/v1/categories/{global_id}")
    assert del_res.status_code == 400
    assert "Global categories cannot be deleted" in del_res.json()["detail"]
