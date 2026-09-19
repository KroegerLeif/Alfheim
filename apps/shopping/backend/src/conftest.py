from collections.abc import AsyncGenerator, Callable, Generator

import httpx
import pytest
import pytest_asyncio
from backend_shared.household import get_membership_lookup
from backend_shared.household.testing import (
    DEFAULT_TEST_HOUSEHOLD_ID,
    DEFAULT_TEST_SUB,
    StaticMembershipLookup,
    make_test_token,
    override_membership,
)
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.features.shopping_lists.clients import household_client

# Import FastAPI application entrypoint
from src.main import app

# Default caller (backend_shared.household.testing defaults): DEFAULT_TEST_SUB owns DEFAULT_TEST_HOUSEHOLD_ID.
TEST_USER_SUB = DEFAULT_TEST_SUB
TEST_HOUSEHOLD_ID = DEFAULT_TEST_HOUSEHOLD_ID


def _auth_headers(sub: str = TEST_USER_SUB, household_id: object = TEST_HOUSEHOLD_ID) -> dict[str, str]:
    """Return the Authorization + X-Household-ID headers for ``sub`` acting in ``household_id``."""
    return {"Authorization": f"Bearer {make_test_token(sub)}", "X-Household-ID": str(household_id)}


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


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    """Create all database tables for the duration of the test session."""
    from src.features.history.models import ShoppingHistory  # noqa: F401
    from src.features.shopping_lists.models import ShoppingItem, ShoppingList  # noqa: F401

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


class HouseholdApiStub:
    """In-memory stand-in for the household app's ``GET /api/v1/households/me``."""

    def __init__(self) -> None:
        self.status_code = 200
        self.households: list[dict] = [
            {
                "id": str(TEST_HOUSEHOLD_ID),
                "name": "Test Home",
                "slug": "test-home",
                "role": "OWNER",
                "is_default": True,
            }
        ]
        self.requests: list[httpx.Request] = []

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.url.path != "/api/v1/households/me":
            return httpx.Response(404)
        if not request.headers.get("Authorization", "").startswith("Bearer "):
            return httpx.Response(401, json={"error": "unauthorized"})
        return httpx.Response(self.status_code, json=self.households)


@pytest.fixture(autouse=True)
def household_api(monkeypatch: pytest.MonkeyPatch) -> HouseholdApiStub:
    """Serve the household app's public API from memory (no network) for every test."""
    stub = HouseholdApiStub()
    monkeypatch.setattr(household_client, "transport", httpx.MockTransport(stub.handle))
    return stub


@pytest.fixture
def auth_headers() -> Callable[..., dict[str, str]]:
    """Factory for ``Authorization`` + ``X-Household-ID`` headers: ``auth_headers(sub=..., household_id=...)``."""
    return _auth_headers


@pytest.fixture
def membership() -> Generator[StaticMembershipLookup, None, None]:
    """Stub the household membership API: the default test user OWNs the default test household.

    Tests add or remove memberships with ``membership.set(household_id, sub, role)``.
    """
    lookup = override_membership(app, {(TEST_HOUSEHOLD_ID, TEST_USER_SUB): "OWNER"})
    yield lookup
    app.dependency_overrides.pop(get_membership_lookup, None)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession, membership: StaticMembershipLookup) -> AsyncGenerator[AsyncClient, None]:
    """Provide an asynchronous HTTPX client configured to make calls to the FastAPI app.

    Overrides the db session dependency on the app and sends the default test
    user's bearer token and household header with every request (per-request
    headers override them).
    """

    async def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db_session] = _get_test_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=_auth_headers()) as ac:
        yield ac
    app.dependency_overrides.pop(get_db_session, None)
