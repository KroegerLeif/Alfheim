"""Integration and multi-tenancy tests for Location REST API endpoints."""

import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from src.api.dependencies import get_current_household_id
from src.api.v1 import router as api_v1_router
from src.db.database import get_db_session

HOUSEHOLD_1 = uuid.uuid4()
HOUSEHOLD_2 = uuid.uuid4()


@pytest_asyncio.fixture
async def test_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create in-memory SQLite engine for tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_app(test_engine: AsyncEngine) -> FastAPI:
    """Create test FastAPI application with db override."""
    app = FastAPI()
    app.include_router(api_v1_router)

    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = _get_test_db
    return app


@pytest_asyncio.fixture
async def client(test_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Create AsyncClient bound to test app."""
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://testserver",
    ) as client:
        yield client


@pytest.mark.asyncio
async def test_create_and_get_location(client: AsyncClient, test_app: FastAPI):
    """Test creating a location and fetching details."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # Create parent location
    res = await client.post(
        "/api/v1/library/locations",
        json={"name": "Living Room", "description": "Main living area"},
    )
    assert res.status_code == 201
    parent_data = res.json()
    assert parent_data["name"] == "Living Room"
    assert parent_data["household_id"] == str(HOUSEHOLD_1)
    parent_id = parent_data["id"]

    # Create child location
    res_child = await client.post(
        "/api/v1/library/locations",
        json={"name": "Bookshelf 1", "parent_id": parent_id},
    )
    assert res_child.status_code == 201
    child_data = res_child.json()
    assert child_data["parent_id"] == parent_id

    # Get location details
    res_get = await client.get(f"/api/v1/library/locations/{parent_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == parent_id


@pytest.mark.asyncio
async def test_list_locations_flat_and_tree(client: AsyncClient, test_app: FastAPI):
    """Test listing locations as flat array and hierarchical tree."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # Create hierarchy: Room -> Shelf
    res_room = await client.post(
        "/api/v1/library/locations",
        json={"name": "Living Room"},
    )
    room_id = res_room.json()["id"]

    await client.post(
        "/api/v1/library/locations",
        json={"name": "Shelf A", "parent_id": room_id},
    )

    # Flat list
    res_flat = await client.get("/api/v1/library/locations")
    assert res_flat.status_code == 200
    flat_data = res_flat.json()
    assert len(flat_data) == 2

    # Tree list
    res_tree = await client.get("/api/v1/library/locations?tree=true")
    assert res_tree.status_code == 200
    tree_data = res_tree.json()
    assert len(tree_data) == 1
    assert tree_data[0]["name"] == "Living Room"
    assert len(tree_data[0]["children"]) == 1
    assert tree_data[0]["children"][0]["name"] == "Shelf A"


@pytest.mark.asyncio
async def test_update_location_and_cycle_prevention(client: AsyncClient, test_app: FastAPI):
    """Test updating location fields and verifying cycle dependency rejection."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    res_1 = await client.post("/api/v1/library/locations", json={"name": "Level 1"})
    id_1 = res_1.json()["id"]

    res_2 = await client.post("/api/v1/library/locations", json={"name": "Level 2", "parent_id": id_1})
    id_2 = res_2.json()["id"]

    # Attempt setting self as parent
    res_self = await client.put(f"/api/v1/library/locations/{id_1}", json={"parent_id": id_1})
    assert res_self.status_code == 400

    # Attempt cycle (setting Level 1 parent to Level 2)
    res_cycle = await client.put(f"/api/v1/library/locations/{id_1}", json={"parent_id": id_2})
    assert res_cycle.status_code == 400


@pytest.mark.asyncio
async def test_delete_location(client: AsyncClient, test_app: FastAPI):
    """Test deleting a location."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    res = await client.post("/api/v1/library/locations", json={"name": "Temp Box"})
    loc_id = res.json()["id"]

    res_del = await client.delete(f"/api/v1/library/locations/{loc_id}")
    assert res_del.status_code == 204

    res_get = await client.get(f"/api/v1/library/locations/{loc_id}")
    assert res_get.status_code == 404


@pytest.mark.asyncio
async def test_location_household_isolation(client: AsyncClient, test_app: FastAPI):
    """Verify strictly isolated tenant access for locations."""
    # Household 1 creates location
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1
    res = await client.post("/api/v1/library/locations", json={"name": "Secret Vault"})
    loc_id = res.json()["id"]

    # Household 2 attempts to fetch, update, delete Household 1 location
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_2

    assert (await client.get(f"/api/v1/library/locations/{loc_id}")).status_code == 404
    assert (await client.put(f"/api/v1/library/locations/{loc_id}", json={"name": "Hacked"})).status_code == 404
    assert (await client.delete(f"/api/v1/library/locations/{loc_id}")).status_code == 404

    # Household 2 list should be empty
    res_list = await client.get("/api/v1/library/locations")
    assert res_list.status_code == 200
    assert len(res_list.json()) == 0
