import pytest
import pytest_asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.features.locations.dependencies import MOCK_HOME_ID
from src.features.locations import Location  # noqa: F401
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
    """Automatically create and drop tables for each test function, and seed the default backlog."""
    # Ensure models are imported so SQLModel.metadata is populated

    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # Seed the system location
    async with db_session_factory() as session:


        from src.features.locations import seed_default_locations
        await seed_default_locations(session)

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
async def test_startup_seeds_backlog(client: AsyncClient):
    """Verify that the default 'Backlog' system location is seeded on startup."""
    response = await client.get("/api/v1/locations")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Backlog"
    assert data[0]["is_system"] is True
    assert data[0]["home_id"] == str(MOCK_HOME_ID)


@pytest.mark.asyncio
async def test_create_location(client: AsyncClient):
    """Verify that a new location can be created successfully."""
    payload = {"name": "Fridge", "description": "Kitchen refrigerator"}
    response = await client.post("/api/v1/locations", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Fridge"
    assert data["description"] == "Kitchen refrigerator"
    assert data["is_system"] is False
    assert "id" in data
    assert "owner_id" in data
    assert "home_id" in data


@pytest.mark.asyncio
async def test_list_and_filter_locations(client: AsyncClient):
    """Verify listing locations and filtering them by name."""
    # Create two additional locations
    await client.post("/api/v1/locations", json={"name": "Fridge", "description": "Kitchen"})
    await client.post("/api/v1/locations", json={"name": "Basement", "description": "Shelves"})

    # List all (should include Backlog, Fridge, Basement)
    response = await client.get("/api/v1/locations")
    assert response.status_code == 200
    all_locations = response.json()
    assert len(all_locations) == 3

    # Filter by name "Fridge"
    response = await client.get("/api/v1/locations?name=Fridge")
    assert response.status_code == 200
    filtered = response.json()
    assert len(filtered) == 1
    assert filtered[0]["name"] == "Fridge"


@pytest.mark.asyncio
async def test_get_location_by_id(client: AsyncClient):
    """Verify retrieving a single location by its UUID."""
    # Create one
    create_res = await client.post("/api/v1/locations", json={"name": "Pantry Shelf"})
    loc_id = create_res.json()["id"]

    # Get by ID
    response = await client.get(f"/api/v1/locations/{loc_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Pantry Shelf"

    # Get non-existent
    fake_id = uuid.uuid4()
    response = await client.get(f"/api/v1/locations/{fake_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_location(client: AsyncClient):
    """Verify modifying a location's attributes (PATCH)."""
    # Create one
    create_res = await client.post("/api/v1/locations", json={"name": "Cabinet", "description": "Old"})
    loc_id = create_res.json()["id"]

    # Update description and name
    patch_res = await client.patch(f"/api/v1/locations/{loc_id}", json={"name": "Kitchen Cabinet", "description": "Updated"})
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["name"] == "Kitchen Cabinet"
    assert data["description"] == "Updated"


@pytest.mark.asyncio
async def test_system_location_modification_blocked(client: AsyncClient):
    """Verify that editing or deleting a system location (Backlog) is rejected."""
    # Fetch seeded backlog
    res = await client.get("/api/v1/locations")
    backlog_id = res.json()[0]["id"]

    # Try updating
    patch_res = await client.patch(f"/api/v1/locations/{backlog_id}", json={"name": "Main Backlog"})
    assert patch_res.status_code == 400
    assert "System locations cannot be modified" in patch_res.json()["detail"]

    # Try deleting
    del_res = await client.delete(f"/api/v1/locations/{backlog_id}")
    assert del_res.status_code == 400
    assert "System locations cannot be modified" in del_res.json()["detail"]


@pytest.mark.asyncio
async def test_delete_location(client: AsyncClient):
    """Verify deleting a custom location."""
    # Create one
    create_res = await client.post("/api/v1/locations", json={"name": "Temporary Shelf"})
    loc_id = create_res.json()["id"]

    # Delete it
    del_res = await client.delete(f"/api/v1/locations/{loc_id}")
    assert del_res.status_code == 204

    # Verify it is gone
    get_res = await client.get(f"/api/v1/locations/{loc_id}")
    assert get_res.status_code == 404
