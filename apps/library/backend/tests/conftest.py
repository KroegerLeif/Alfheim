"""Shared fixtures for library backend testing."""

import uuid
from collections.abc import AsyncGenerator

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from src.api.dependencies import get_current_household_id
from src.db.database import get_db_session
from src.main import app

DEFAULT_TEST_HOUSEHOLD_ID = uuid.UUID("4eeb7681-8419-4c52-b800-6fef6c7ee51b")


@pytest_asyncio.fixture
async def test_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create in-memory SQLite engine with StaticPool for tests."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session_factory(test_engine: AsyncEngine) -> async_sessionmaker:
    """Create async sessionmaker bound to in-memory test engine."""
    return async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


@pytest_asyncio.fixture
async def db_session(test_session_factory: async_sessionmaker) -> AsyncGenerator[AsyncSession, None]:
    """Provide database session."""
    async with test_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def test_app(db_session: AsyncSession) -> AsyncGenerator[FastAPI, None]:
    """Use the main application with dependency overrides."""

    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def _get_test_household_id() -> uuid.UUID:
        return DEFAULT_TEST_HOUSEHOLD_ID

    app.dependency_overrides[get_db_session] = _get_test_db
    app.dependency_overrides[get_current_household_id] = _get_test_household_id
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(test_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Create AsyncClient bound to test app."""
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://testserver",
    ) as ac:
        yield ac
