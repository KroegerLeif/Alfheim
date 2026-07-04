import asyncio
from collections.abc import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

# Import FastAPI application entrypoint
from src.main import app
from src.core.database import get_db_session

# Import all models to register them on SQLModel.metadata
from src.features.locations.models import Location  # noqa: F401
from src.features.categories.models import Category  # noqa: F401
from src.features.products.models import Product, ProductNutrition  # noqa: F401
from src.features.inventory.models import InventoryLedger, InventoryState  # noqa: F401

# Setup in-memory SQLite database engine for test runs
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

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()

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
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
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
