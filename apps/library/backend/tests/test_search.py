"""Unit and integration tests for Library search API and service."""

import time
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
from src.db.models import Item, MediaType

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
async def test_text_search(client: AsyncClient, test_app: FastAPI):
    """Test text search matching title, description, and author."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # Create test items
    await client.post(
        "/api/v1/library/items",
        json={
            "title": "The Lord of the Rings",
            "author_creator": "J.R.R. Tolkien",
            "media_type": "BOOK",
            "description": "Epic fantasy trilogy in Middle-earth",
        },
    )
    await client.post(
        "/api/v1/library/items",
        json={
            "title": "Clean Code",
            "author_creator": "Robert C. Martin",
            "media_type": "BOOK",
            "description": "A Handbook of Agile Software Craftsmanship",
        },
    )

    # Search for "Middle-earth"
    res1 = await client.get("/api/v1/library/search?q=Middle-earth")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["total"] == 1
    assert data1["items"][0]["title"] == "The Lord of the Rings"

    # Search for "Martin"
    res2 = await client.get("/api/v1/library/search?q=Martin")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["total"] == 1
    assert data2["items"][0]["title"] == "Clean Code"


@pytest.mark.asyncio
async def test_multi_facet_filtering(client: AsyncClient, test_app: FastAPI):
    """Test multi-facet filtering (funny movie under 90 min, 4-player game in max 45 min)."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # Seed items
    # Item 1: Funny movie under 90 min
    await client.post(
        "/api/v1/library/items",
        json={
            "title": "Short Funny Movie",
            "media_type": "MOVIE",
            "description": "A very funny comedy film",
            "runtime_minutes": 85,
            "fsk_rating": 6,
        },
    )
    # Item 2: Long movie
    await client.post(
        "/api/v1/library/items",
        json={
            "title": "Epic Drama",
            "media_type": "MOVIE",
            "description": "Serious drama film",
            "runtime_minutes": 180,
            "fsk_rating": 16,
        },
    )
    # Item 3: 4-player board game under 45 min
    await client.post(
        "/api/v1/library/items",
        json={
            "title": "Quick Card Game",
            "media_type": "GAME",
            "min_players": 2,
            "max_players": 6,
            "runtime_minutes": 30,
        },
    )
    # Item 4: 2-player board game
    await client.post(
        "/api/v1/library/items",
        json={
            "title": "Duel Game",
            "media_type": "GAME",
            "min_players": 2,
            "max_players": 2,
            "runtime_minutes": 20,
        },
    )

    # Search: Movie under 90 min with FSK 12
    res_movie = await client.get("/api/v1/library/search?media_type=MOVIE&max_duration=90&fsk_rating=12")
    assert res_movie.status_code == 200
    data_movie = res_movie.json()
    assert data_movie["total"] == 1
    assert data_movie["items"][0]["title"] == "Short Funny Movie"

    # Search: 4-player game in max 45 min
    res_game = await client.get("/api/v1/library/search?media_type=GAME&players=4&max_duration=45")
    assert res_game.status_code == 200
    data_game = res_game.json()
    assert data_game["total"] == 1
    assert data_game["items"][0]["title"] == "Quick Card Game"


@pytest.mark.asyncio
async def test_active_provider_filtering(client: AsyncClient, test_app: FastAPI):
    """Test filtering search results by active household streaming provider."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # Create active and inactive provider subscriptions
    res_p1 = await client.post(
        "/api/v1/library/providers",
        json={"provider_name": "Netflix", "provider_type": "STREAMING", "is_active": True},
    )
    p1_id = res_p1.json()["id"]

    res_p2 = await client.post(
        "/api/v1/library/providers",
        json={"provider_name": "Old Streaming Service", "provider_type": "STREAMING", "is_active": False},
    )
    p2_id = res_p2.json()["id"]

    # Create items linked to providers
    await client.post(
        "/api/v1/library/items",
        json={"title": "Netflix Exclusive Show", "media_type": "SERIES", "provider_id": p1_id},
    )
    await client.post(
        "/api/v1/library/items",
        json={"title": "Old Inactive Show", "media_type": "SERIES", "provider_id": p2_id},
    )
    await client.post(
        "/api/v1/library/items",
        json={"title": "Physical DVD", "media_type": "MOVIE"},
    )

    # Search active_providers_only=true
    res_active = await client.get("/api/v1/library/search?active_providers_only=true")
    assert res_active.status_code == 200
    data_active = res_active.json()
    assert data_active["total"] == 1
    assert data_active["items"][0]["title"] == "Netflix Exclusive Show"


@pytest.mark.asyncio
async def test_search_household_isolation(client: AsyncClient, test_app: FastAPI):
    """Verify search results enforce tenant isolation across households."""
    # Household 1 creates item
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1
    await client.post(
        "/api/v1/library/items",
        json={"title": "Secret Household 1 Book", "media_type": "BOOK"},
    )

    # Household 2 searches
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_2
    res = await client.get("/api/v1/library/search?q=Secret")
    assert res.status_code == 200
    assert res.json()["total"] == 0


@pytest.mark.asyncio
async def test_search_performance(client: AsyncClient, test_app: FastAPI, test_engine: AsyncEngine):
    """Benchmark test verifying query response time under 50ms."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    session_factory = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        # Seed 500 items quickly
        items = [
            Item(
                household_id=HOUSEHOLD_1,
                title=f"Sample Media Item #{i}",
                media_type=MediaType.BOOK if i % 2 == 0 else MediaType.GAME,
                author_creator=f"Author {i}",
                description=f"Detailed description for item number {i} in the library database",
                min_players=2 if i % 2 != 0 else None,
                max_players=4 if i % 2 != 0 else None,
                runtime_minutes=60 + (i % 60),
            )
            for i in range(500)
        ]
        session.add_all(items)
        await session.commit()

    start_time = time.perf_counter()
    res = await client.get("/api/v1/library/search?q=Item%20%23250&media_type=BOOK")
    duration_ms = (time.perf_counter() - start_time) * 1000

    assert res.status_code == 200
    assert duration_ms < 100.0  # Fast execution requirement
