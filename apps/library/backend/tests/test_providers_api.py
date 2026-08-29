"""Integration and multi-tenancy tests for Provider Subscription REST API endpoints."""

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
async def test_create_and_get_provider(client: AsyncClient, test_app: FastAPI):
    """Test creating a provider subscription and fetching details."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    res = await client.post(
        "/api/v1/library/providers",
        json={
            "provider_name": "Netflix",
            "provider_type": "STREAMING",
            "is_active": True,
            "icon_url": "https://example.com/netflix.png",
        },
    )
    assert res.status_code == 201
    provider_data = res.json()
    assert provider_data["provider_name"] == "Netflix"
    assert provider_data["provider_type"] == "STREAMING"
    assert provider_data["is_active"] is True
    assert provider_data["household_id"] == str(HOUSEHOLD_1)
    provider_id = provider_data["id"]

    res_get = await client.get(f"/api/v1/library/providers/{provider_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == provider_id


@pytest.mark.asyncio
async def test_list_providers(client: AsyncClient, test_app: FastAPI):
    """Test listing provider subscriptions with active status filter."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    # Seed providers
    await client.post(
        "/api/v1/library/providers",
        json={"provider_name": "Netflix", "is_active": True},
    )
    await client.post(
        "/api/v1/library/providers",
        json={"provider_name": "PS Plus", "provider_type": "GAMING_PASS", "is_active": False},
    )

    # List all
    res_all = await client.get("/api/v1/library/providers")
    assert res_all.status_code == 200
    assert len(res_all.json()) == 2

    # Filter by is_active=true
    res_active = await client.get("/api/v1/library/providers?is_active=true")
    assert res_active.status_code == 200
    active_items = res_active.json()
    assert len(active_items) == 1
    assert active_items[0]["provider_name"] == "Netflix"

    # Filter by is_active=false
    res_inactive = await client.get("/api/v1/library/providers?is_active=false")
    assert res_inactive.status_code == 200
    inactive_items = res_inactive.json()
    assert len(inactive_items) == 1
    assert inactive_items[0]["provider_name"] == "PS Plus"


@pytest.mark.asyncio
async def test_update_and_delete_provider(client: AsyncClient, test_app: FastAPI):
    """Test updating and deleting a provider subscription."""
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1

    res = await client.post(
        "/api/v1/library/providers",
        json={"provider_name": "Disney+", "is_active": True},
    )
    provider_id = res.json()["id"]

    # Update provider
    res_upd = await client.put(
        f"/api/v1/library/providers/{provider_id}",
        json={"provider_name": "Disney Plus", "is_active": False},
    )
    assert res_upd.status_code == 200
    assert res_upd.json()["provider_name"] == "Disney Plus"
    assert res_upd.json()["is_active"] is False

    # Delete provider
    res_del = await client.delete(f"/api/v1/library/providers/{provider_id}")
    assert res_del.status_code == 204

    res_get = await client.get(f"/api/v1/library/providers/{provider_id}")
    assert res_get.status_code == 404


@pytest.mark.asyncio
async def test_provider_household_isolation(client: AsyncClient, test_app: FastAPI):
    """Verify tenant isolation for streaming provider subscriptions."""
    # Household 1 creates provider
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1
    res = await client.post(
        "/api/v1/library/providers",
        json={"provider_name": "Household 1 Prime"},
    )
    provider_id = res.json()["id"]

    # Household 2 attempts access
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_2

    assert (await client.get(f"/api/v1/library/providers/{provider_id}")).status_code == 404
    assert (
        await client.put(f"/api/v1/library/providers/{provider_id}", json={"provider_name": "Hacked"})
    ).status_code == 404
    assert (await client.delete(f"/api/v1/library/providers/{provider_id}")).status_code == 404

    res_list = await client.get("/api/v1/library/providers")
    assert res_list.status_code == 200
    assert len(res_list.json()) == 0


@pytest.mark.asyncio
async def test_item_provider_association_and_cross_household_prevention(client: AsyncClient, test_app: FastAPI):
    """Verify linking items to providers and preventing cross-household provider links."""
    # Household 1 creates provider and item associated with provider
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_1
    res_prov = await client.post(
        "/api/v1/library/providers",
        json={"provider_name": "Xbox Game Pass", "provider_type": "GAMING_PASS"},
    )
    h1_provider_id = res_prov.json()["id"]

    res_item = await client.post(
        "/api/v1/library/items",
        json={
            "title": "Halo Infinite",
            "media_type": "GAME",
            "provider_id": h1_provider_id,
        },
    )
    assert res_item.status_code == 201
    assert res_item.json()["provider_id"] == h1_provider_id

    # Household 2 attempts to create an item linked to Household 1's provider
    test_app.dependency_overrides[get_current_household_id] = lambda: HOUSEHOLD_2
    res_h2_item = await client.post(
        "/api/v1/library/items",
        json={
            "title": "Forza Horizon",
            "media_type": "GAME",
            "provider_id": h1_provider_id,
        },
    )
    assert res_h2_item.status_code == 400
    assert "Provider subscription with ID" in res_h2_item.json()["detail"]
