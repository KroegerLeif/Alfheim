import os
import uuid
from collections.abc import AsyncGenerator

# Test context for backend_shared.household (configure_household_auth runs when app.main is imported).
os.environ.setdefault("TESTING", "true")

import pytest_asyncio
from app.core.database import get_db_session
from app.features.devices.models import Device  # noqa: F401
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent  # noqa: F401
from app.main import app
from backend_shared.household.testing import StaticMembershipLookup, make_test_token, override_membership
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

#: Household (owned by core/household) and user the default ``client`` acts as.
TEST_HOUSEHOLD_ID = uuid.UUID("5b1f3c3e-6f0a-4f7e-9a51-1d2c3b4a5e6f")
TEST_USER_SUB = "maintenance-test-user"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

test_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def auth_headers(household_id: uuid.UUID | str = TEST_HOUSEHOLD_ID, sub: str = TEST_USER_SUB) -> dict[str, str]:
    """Bearer test token plus ``X-Household-ID`` for ``sub`` acting in ``household_id``."""
    return {"Authorization": f"Bearer {make_test_token(sub)}", "X-Household-ID": str(household_id)}


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.connect() as conn:
        transaction = await conn.begin()
        async with AsyncSession(conn, expire_on_commit=False) as session:
            yield session
        await transaction.rollback()


@pytest_asyncio.fixture
async def membership(db_session: AsyncSession) -> AsyncGenerator[StaticMembershipLookup, None]:
    """Stubbed household membership API: ``TEST_USER_SUB`` is OWNER of ``TEST_HOUSEHOLD_ID``."""

    async def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db_session] = _get_test_db
    lookup = override_membership(app, {(TEST_HOUSEHOLD_ID, TEST_USER_SUB): "OWNER"})
    yield lookup
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(membership: StaticMembershipLookup) -> AsyncGenerator[AsyncClient, None]:
    """Client authenticated as ``TEST_USER_SUB`` acting in ``TEST_HOUSEHOLD_ID``."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth_headers()) as ac:
        yield ac


@pytest_asyncio.fixture
async def anon_client(membership: StaticMembershipLookup) -> AsyncGenerator[AsyncClient, None]:
    """Client without default credentials (each test supplies its own headers)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
