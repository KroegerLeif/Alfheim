"""Integration and multi-tenancy tests for Lending REST API endpoints."""

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
async def test_lend_and_return_item(client: AsyncClient, test_app: FastAPI):
    """Test lending an available item and returning it."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # Create an item
    create_res = await client.post(
        "/api/v1/library/items",
        json={"title": "Dune", "media_type": "BOOK"},
    )
    assert create_res.status_code == 201
    item_id = create_res.json()["id"]

    # Lend item to Alice
    lend_res = await client.post(
        f"/api/v1/library/items/{item_id}/lend",
        json={
            "contact_name": "Alice",
            "notes": "Handle with care",
        },
    )
    assert lend_res.status_code == 201
    lend_data = lend_res.json()
    assert lend_data["contact_name"] == "Alice"
    assert lend_data["status"] == "LENT_OUT"
    assert lend_data["item_id"] == item_id
    assert lend_data["returned_at"] is None

    # Check item status updated to LENT_OUT
    get_item_res = await client.get(f"/api/v1/library/items/{item_id}")
    assert get_item_res.status_code == 200
    assert get_item_res.json()["status"] == "LENT_OUT"

    # Return item
    return_res = await client.post(
        f"/api/v1/library/items/{item_id}/return",
        json={"notes": "Returned in pristine condition"},
    )
    assert return_res.status_code == 200
    return_data = return_res.json()
    assert return_data["status"] == "AVAILABLE"
    assert return_data["returned_at"] is not None
    assert "Returned in pristine condition" in return_data["notes"]

    # Check item status updated back to AVAILABLE
    get_item_res2 = await client.get(f"/api/v1/library/items/{item_id}")
    assert get_item_res2.status_code == 200
    assert get_item_res2.json()["status"] == "AVAILABLE"


@pytest.mark.asyncio
async def test_lend_item_error_cases(client: AsyncClient, test_app: FastAPI):
    """Test error handling when lending/returning items."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # Lend non-existent item
    random_id = uuid.uuid4()
    lend_404 = await client.post(
        f"/api/v1/library/items/{random_id}/lend",
        json={"contact_name": "Bob"},
    )
    assert lend_404.status_code == 404

    # Return non-existent item
    return_404 = await client.post(f"/api/v1/library/items/{random_id}/return")
    assert return_404.status_code == 404

    # Create item
    item_res = await client.post(
        "/api/v1/library/items",
        json={"title": "Monopoly", "media_type": "GAME"},
    )
    item_id = item_res.json()["id"]

    # Attempt to return an available item
    return_avail_err = await client.post(f"/api/v1/library/items/{item_id}/return")
    assert return_avail_err.status_code == 400
    assert "not currently lent out" in return_avail_err.json()["detail"]

    # Lend item once
    await client.post(
        f"/api/v1/library/items/{item_id}/lend",
        json={"contact_name": "Charlie"},
    )

    # Attempt to lend already lent-out item
    lend_already_err = await client.post(
        f"/api/v1/library/items/{item_id}/lend",
        json={"contact_name": "Dave"},
    )
    assert lend_already_err.status_code == 400
    assert "already lent out" in lend_already_err.json()["detail"]


@pytest.mark.asyncio
async def test_lending_history_filtering_and_pagination(client: AsyncClient, test_app: FastAPI):
    """Test retrieving, filtering, and paginating lending record history."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # Create two items
    book_res = await client.post("/api/v1/library/items", json={"title": "Book 1", "media_type": "BOOK"})
    game_res = await client.post("/api/v1/library/items", json={"title": "Game 1", "media_type": "GAME"})

    book_id = book_res.json()["id"]
    game_id = game_res.json()["id"]

    # Lend book to Alice and return
    await client.post(f"/api/v1/library/items/{book_id}/lend", json={"contact_name": "Alice"})
    await client.post(f"/api/v1/library/items/{book_id}/return")

    # Lend game to Bob (remains LENT_OUT)
    await client.post(f"/api/v1/library/items/{game_id}/lend", json={"contact_name": "Bob"})

    # Fetch all lending history
    hist_all = await client.get("/api/v1/library/lending/history")
    assert hist_all.status_code == 200
    all_data = hist_all.json()
    assert all_data["total"] == 2
    assert len(all_data["records"]) == 2

    # Filter by item_id
    hist_book = await client.get(f"/api/v1/library/lending/history?item_id={book_id}")
    assert hist_book.status_code == 200
    assert hist_book.json()["total"] == 1
    assert hist_book.json()["records"][0]["item_id"] == book_id

    # Filter by contact_name
    hist_contact = await client.get("/api/v1/library/lending/history?contact_name=Bob")
    assert hist_contact.status_code == 200
    assert hist_contact.json()["total"] == 1
    assert hist_contact.json()["records"][0]["contact_name"] == "Bob"

    # Filter by status=LENT_OUT
    hist_status = await client.get("/api/v1/library/lending/history?status=LENT_OUT")
    assert hist_status.status_code == 200
    assert hist_status.json()["total"] == 1
    assert hist_status.json()["records"][0]["status"] == "LENT_OUT"

    # Pagination
    page_res = await client.get("/api/v1/library/lending/history?skip=0&limit=1")
    assert page_res.status_code == 200
    assert len(page_res.json()["records"]) == 1
    assert page_res.json()["total"] == 2


@pytest.mark.asyncio
async def test_lending_household_isolation(client: AsyncClient, test_app: FastAPI):
    """Test tenant multi-tenancy isolation for lending endpoints."""
    # Household 1 creates item and lends it
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    item_res = await client.post(
        "/api/v1/library/items",
        json={"title": "Secret Book", "media_type": "BOOK"},
    )
    item_id = item_res.json()["id"]

    await client.post(
        f"/api/v1/library/items/{item_id}/lend",
        json={"contact_name": "Household 1 Contact"},
    )

    # Household 2 attempts actions on Household 1's item
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_2

    # Attempt lending
    lend_h2 = await client.post(
        f"/api/v1/library/items/{item_id}/lend",
        json={"contact_name": "Unauthorized User"},
    )
    assert lend_h2.status_code == 404

    # Attempt returning
    return_h2 = await client.post(f"/api/v1/library/items/{item_id}/return")
    assert return_h2.status_code == 404

    # Query lending history as Household 2
    hist_h2 = await client.get("/api/v1/library/lending/history")
    assert hist_h2.status_code == 200
    assert hist_h2.json()["total"] == 0
    assert len(hist_h2.json()["records"]) == 0
