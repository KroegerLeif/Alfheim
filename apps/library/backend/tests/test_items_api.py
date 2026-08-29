"""Integration and multi-tenancy tests for Item REST API endpoints."""

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
async def test_create_and_get_item(client: AsyncClient, test_app: FastAPI):
    """Test creating a media item and fetching item details."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    res = await client.post(
        "/api/v1/library/items",
        json={
            "title": "Clean Code",
            "media_type": "BOOK",
            "author_creator": "Robert C. Martin",
            "is_cookbook": False,
        },
    )
    assert res.status_code == 201
    item_data = res.json()
    assert item_data["title"] == "Clean Code"
    assert item_data["media_type"] == "BOOK"
    assert item_data["status"] == "AVAILABLE"
    assert item_data["household_id"] == str(HOUSEHOLD_1)
    item_id = item_data["id"]

    res_get = await client.get(f"/api/v1/library/items/{item_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == item_id


@pytest.mark.asyncio
async def test_list_items_with_filters_and_pagination(client: AsyncClient, test_app: FastAPI):
    """Test item list filtering (media_type, is_cookbook) and pagination."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # Seed items
    await client.post(
        "/api/v1/library/items",
        json={"title": "The Hobbit", "media_type": "BOOK", "is_cookbook": False},
    )
    await client.post(
        "/api/v1/library/items",
        json={"title": "Italian Pasta", "media_type": "BOOK", "is_cookbook": True},
    )
    await client.post(
        "/api/v1/library/items",
        json={"title": "Catan", "media_type": "GAME", "is_cookbook": False, "min_players": 3, "max_players": 4},
    )

    # Filter by media_type=BOOK
    res_books = await client.get("/api/v1/library/items?media_type=BOOK")
    assert res_books.status_code == 200
    data_books = res_books.json()
    assert data_books["total"] == 2
    assert len(data_books["items"]) == 2

    # Filter by is_cookbook=true
    res_cookbooks = await client.get("/api/v1/library/items?is_cookbook=true")
    assert res_cookbooks.status_code == 200
    data_cookbooks = res_cookbooks.json()
    assert data_cookbooks["total"] == 1
    assert data_cookbooks["items"][0]["title"] == "Italian Pasta"

    # Test pagination
    res_page = await client.get("/api/v1/library/items?skip=0&limit=2")
    assert res_page.status_code == 200
    assert len(res_page.json()["items"]) == 2
    assert res_page.json()["total"] == 3


@pytest.mark.asyncio
async def test_update_and_delete_item(client: AsyncClient, test_app: FastAPI):
    """Test updating and deleting an item."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    res = await client.post(
        "/api/v1/library/items",
        json={"title": "Inception", "media_type": "MOVIE", "runtime_minutes": 148},
    )
    item_id = res.json()["id"]

    # Update item
    res_upd = await client.put(
        f"/api/v1/library/items/{item_id}",
        json={"title": "Inception Director's Cut", "fsk_rating": 12},
    )
    assert res_upd.status_code == 200
    assert res_upd.json()["title"] == "Inception Director's Cut"
    assert res_upd.json()["fsk_rating"] == 12

    # Delete item
    res_del = await client.delete(f"/api/v1/library/items/{item_id}")
    assert res_del.status_code == 204

    res_get = await client.get(f"/api/v1/library/items/{item_id}")
    assert res_get.status_code == 404


@pytest.mark.asyncio
async def test_item_household_isolation(client: AsyncClient, test_app: FastAPI):
    """Verify tenant isolation for library items."""
    # Household 1 creates item
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1
    res = await client.post(
        "/api/v1/library/items",
        json={"title": "Private Diary", "media_type": "BOOK"},
    )
    item_id = res.json()["id"]

    # Household 2 attempts access
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_2

    assert (await client.get(f"/api/v1/library/items/{item_id}")).status_code == 404
    assert (await client.put(f"/api/v1/library/items/{item_id}", json={"title": "Hacked"})).status_code == 404
    assert (await client.delete(f"/api/v1/library/items/{item_id}")).status_code == 404

    res_list = await client.get("/api/v1/library/items")
    assert res_list.status_code == 200
    assert res_list.json()["total"] == 0
