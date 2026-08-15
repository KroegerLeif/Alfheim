from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.features.chore_management.models import (  # noqa: F401
    ChoreInstance,
    ChoreTemplate,
    HouseholdStreak,
)
from src.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

test_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    """Create all database tables for the duration of the test session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session for a single test case.

    Automatically rolls back the transaction at the end of the test.
    """
    async with test_engine.connect() as conn:
        transaction = await conn.begin()
        async with AsyncSession(conn, expire_on_commit=False) as session:
            yield session
        await transaction.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an asynchronous HTTPX client configured to make calls to the FastAPI app.

    Overrides the db session dependency on the app.
    """

    async def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db_session] = _get_test_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_db_session, None)
