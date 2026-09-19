
# Guide: New Backend App Scaffolding & Quality Standards (`.ai/guidelines/new-app-scaffolding.md`)

This guide provides the mandatory, step-by-step instructions for scaffolding and registering a new backend microservice within the **Alfheim** monorepo. Every new service must adhere strictly to our developer tooling (`uv`, `ruff`, `ty`), async testing architecture (`pytest`, `aiosqlite`, `respx`), multi-tenant security invariants, and standalone Docker build configurations.

---

## 1. Directory Structure & Feature-Driven Design (FDD)

Every backend application is located under `apps/<app-name>/backend/` and follows Feature-Driven Design (FDD):

```text
apps/<app-name>/backend/
├── .dockerignore                  # Standardized Docker ignore rules (MUST exclude .venv, uv.lock, etc.)
├── Dockerfile                     # Multi-stage standalone Alpine container build
├── pyproject.toml                 # Package manifest & service dependencies
├── README.md                      # Service documentation, endpoints, and local commands
├── main.py                        # Service entrypoint (or inside src/main.py)
├── src/
│   ├── conftest.py                # Shared async Pytest fixtures & in-memory SQLite engine
│   ├── core/                      # Global infrastructure
│   │   ├── config.py              # Pydantic Settings & environment loader
│   │   ├── database.py            # Async SQLAlchemy/SQLModel engine & session generator
│   │   ├── dependencies.py        # Optional re-exports of backend_shared.household
│   │   └── storage.py             # RustFS S3 async client (if storage is needed)
│   ├── features/                  # Feature Modules (Mandatory 6-file pattern)
│   │   └── <feature_name>/
│   │       ├── models.py          # SQLModel / SQLAlchemy database entities
│   │       ├── schemas.py         # Pydantic v2 DTOs (Request / Response validation)
│   │       ├── service.py         # Pure domain business logic & database queries
│   │       ├── router.py          # FastAPI REST endpoints (delegates to service.py)
│   │       ├── mcp_tools.py       # FastMCP tool declarations for AI agents
│   │       ├── exceptions.py      # Domain custom exceptions & HTTP status maps
│   │       └── tests/             # Feature-specific unit & integration tests
│   │           ├── test_unit.py
│   │           └── test_household_isolation.py
│   └── tests/                     # Service-wide cross-cutting tests
└── tests/                         # Root tests (if not colocated in src/)
```

---

## 2. Workspace Integration (`uv`)

All backend services are managed centrally via the root `uv` workspace.

### A. Root `pyproject.toml` Registration
The root `pyproject.toml` automatically globs `apps/*/backend`. If creating a service in a non-standard path, explicitly add it to `members`:

```toml
# /pyproject.toml
[tool.uv.workspace]
members = [
    "apps/*/backend",
]
```

### B. Service `pyproject.toml` Template
Each service must define its own `pyproject.toml` with standard dependencies and dev groups:

```toml
# apps/<app-name>/backend/pyproject.toml
[project]
name = "<app-name>-backend"
version = "0.1.0"
description = "FastAPI backend service for <App Name>"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sqlmodel>=0.0.22",
    "pydantic-settings>=2.6.0",
    "asyncpg>=0.30.0",
    "aiosqlite>=0.20.0",
    "python-jose[cryptography]>=3.3.0",
    "httpx>=0.27.2",
    "opentelemetry-api>=1.27.0",
    "opentelemetry-sdk>=1.27.0",
    "opentelemetry-instrumentation-fastapi>=0.48b0",
    "opentelemetry-exporter-otlp>=1.27.0",
]

[dependency-groups]
dev = [
    "pytest>=8.3.3",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=6.0.0",
    "respx>=0.22.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["src", "tests"]
python_files = "test_*.py"
```

After updating `pyproject.toml`, run from repository root:
```bash
uv sync --all-packages --all-groups
```

---

## 3. Developer Tooling & Quality Gates (`ruff`, `ty`, `pre-commit`)

All services automatically inherit centralized tooling configurations:

### A. Ruff Linter & Formatter
- **Configuration**: Root [`ruff.toml`](../../ruff.toml) enforces Python 3.12 target with rules: `E`, `W`, `F`, `I`, `B`, `UP`, `ASYNC`, `FAST`, `T20`.
- **Run Commands**:
  ```bash
  # Check code across monorepo
  uv run ruff check .

  # Auto-fix lint violations
  uv run ruff check --fix .

  # Verify formatting
  uv run ruff format --check .
  ```

### B. Static Type Checking (`ty`)
- All Python code must be statically typed. Type annotations on route handlers, service methods, and schemas are strictly validated using `ty`:
  ```bash
  # Run workspace-wide type check
  uv run ty check

  # Run type check for specific service
  uv run ty check apps/<app-name>/backend
  ```

### C. Pre-Commit Git Hooks
- Run before creating any commit:
  ```bash
  uv run pre-commit run --all-files
  ```

---

## 4. Mandatory Testing Standards & In-Memory Database

Every service **MUST** provide a comprehensive async test suite that runs against an in-memory SQLite database (`aiosqlite`) without relying on a live PostgreSQL or Docker container.

### A. Shared `conftest.py` Pattern
Place in `src/conftest.py` (or `app/tests/conftest.py`):

```python
"""Shared Pytest fixtures for <app-name>-backend."""

import os
import pytest
from collections.abc import AsyncGenerator
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

# Disable telemetry and enforce test mode
os.environ["TESTING"] = "true"
os.environ["OTEL_ENABLED"] = "false"
# configure_household_auth() in main.py requires the internal token at import time
os.environ.setdefault("ALFHEIM_INTERNAL_TOKEN", "test-internal-token")

import uuid

from backend_shared.household.testing import make_test_token, override_membership

from src.main import app  # adjust import to your service entrypoint
from src.core.database import get_session

TEST_USER_SUB = "user-1"
TEST_HOUSEHOLD_ID = uuid.uuid4()

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(name="engine", scope="session")
def engine_fixture():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    return engine


@pytest.fixture(name="init_db", autouse=True)
async def init_db_fixture(engine):
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest.fixture(name="session")
async def session_fixture(engine) -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session


@pytest.fixture(name="client")
async def client_fixture(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def get_session_override():
        yield session

    app.dependency_overrides[get_session] = get_session_override
    # Stub the core/household membership API; JWT decoding stays real.
    override_membership(app, {(TEST_HOUSEHOLD_ID, TEST_USER_SUB): "OWNER"})
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="auth_headers")
def auth_headers_fixture() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {make_test_token(TEST_USER_SUB)}",
        "X-Household-ID": str(TEST_HOUSEHOLD_ID),
    }
```

> [!WARNING]
> **Do NOT override the `event_loop` fixture**: `pytest-asyncio` >= 0.24 automatically manages the asyncio event loop with `asyncio_mode = "auto"`. Custom `event_loop` fixtures are deprecated.

### B. Inter-Service HTTP Mocking with `respx`
If your service communicates with other Alfheim microservices (e.g. Pantry calling Shopping), use `respx` to mock external HTTP calls:

```python
import respx
import httpx
import pytest


@pytest.mark.asyncio
@respx.mock
async def test_outbound_service_call(client: AsyncClient, auth_headers: dict[str, str]):
    # Mock external shopping service response
    respx.post("http://shopping-backend:8000/api/v1/items").mock(
        return_value=httpx.Response(201, json={"id": "mock-item-id", "name": "Milk"})
    )

    # auth_headers: Authorization (make_test_token) + X-Household-ID (a UUID the
    # test user is a member of via override_membership). Forward both downstream.
    response = await client.post("/api/v1/trigger-sync", headers=auth_headers)
    assert response.status_code == 200
    assert respx.calls.last.request.headers["X-Household-ID"] == auth_headers["X-Household-ID"]
```

---

## 5. Zero-Trust Multi-Tenancy & Auth Invariants

Alfheim enforces strict tenant isolation from the `X-Household-ID` header, confirmed on every request with the household app (`core/household`). Zitadel only authenticates and issues **no** household or role claims: never read `household_id`, `active_household_id`, `households` or `realm_access.roles` from the JWT. See ADR 0006 (`docs/en/explanation/decisions/0006-household-authorization-via-membership-api.md`).

### A. Auth Context Dependency (`backend_shared.household`)
Never write your own header or claim parser. Use the shared dependency:

```python
# src/main.py
from backend_shared.household import close_membership_client, configure_household_auth

configure_household_auth(settings)  # validates ALFHEIM_INTERNAL_TOKEN, registers OIDC settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_membership_client()
```

```python
# src/features/<domain>/router.py
from fastapi import Depends
from backend_shared.household import HouseholdContext, require_household, require_role


@router.get("/items")
async def list_items(ctx: HouseholdContext = Depends(require_household)):
    return await service.list_items(household_id=ctx.household_id, user_id=ctx.user_id)


@router.delete("/items/{item_id}")
async def delete_item(item_id: uuid.UUID, ctx: HouseholdContext = Depends(require_role("OWNER", "ADMIN"))):
    ...
```

`require_household` validates the JWT, requires a UUID `X-Household-ID`, and asks `GET {HOUSEHOLD_INTERNAL_URL}/internal/v1/memberships/{householdId}/{userSub}` (cached 30 s for members, 5 s for non-members, fails closed). Errors: `401 unauthenticated`, `400 household_required` / `household_invalid`, `403 household_forbidden` / `household_role_forbidden`, `503 household_service_unavailable`, always as `{"detail": {"code", "message"}}`. Roles come from the membership response.

**MCP tools** are wrapped by `MCPAuthenticationMiddleware(mcp_app, settings=settings)` and read the household with `get_mcp_household_context()`. A tool **must not** declare `household_id`, `home_id` or `user_id` parameters: the LLM must never choose the tenant.

**Outbound calls** to another Alfheim app forward the caller's `Authorization` and `X-Household-ID` headers; the target app authorizes the caller itself.

**Go backends** follow the chat backend: `middleware.RequireHousehold` (`apps/chat/backend/internal/shared/middleware/household.go`) with `internal/shared/householdclient`, same error contract.

**Frontends** take the household from `useActiveHousehold()` (`@alfheim/shared`), render behind `HouseholdGate`, and send only `X-Household-ID` via `applyHouseholdHeaders`.

### B. Mandatory Household Isolation Test Template
Every service that stores household data **MUST** include integration tests verifying that Tenant A cannot read, mutate, or delete Tenant B's records. Stub the membership API with `override_membership` from `backend_shared.household.testing` (the `client` fixture above already grants one membership; tests override it as needed) and send `Authorization: Bearer {make_test_token(sub)}`. Also cover `403 household_forbidden` for a non-member, `400 household_required` without the header, and `503 household_service_unavailable` when the membership API is down:

```python
"""Multi-tenant Household Isolation Test Suite."""

import uuid

import pytest
from backend_shared.household.testing import make_test_token, override_membership
from httpx import AsyncClient

from src.main import app

SUB = "user-1"


def headers(household_id: uuid.UUID, sub: str = SUB) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_test_token(sub)}", "X-Household-ID": str(household_id)}


@pytest.mark.asyncio
async def test_household_isolation_cannot_access_other_tenant_data(client: AsyncClient):
    tenant_a, tenant_b = uuid.uuid4(), uuid.uuid4()
    # The same user is a member of both households; data must still not leak across them.
    override_membership(app, {(tenant_a, SUB): "OWNER", (tenant_b, SUB): "OWNER"})

    # 1. Tenant A creates a resource
    create_res = await client.post(
        "/api/v1/items", json={"name": "Secret Recipe", "quantity": 1}, headers=headers(tenant_a)
    )
    assert create_res.status_code == 201
    item_id = create_res.json()["id"]

    # 2. Tenant B attempts to fetch Tenant A's resource -> MUST RETURN 404
    assert (await client.get(f"/api/v1/items/{item_id}", headers=headers(tenant_b))).status_code == 404

    # 3. Tenant B lists resources -> MUST NOT contain Tenant A's item
    list_res = await client.get("/api/v1/items", headers=headers(tenant_b))
    assert list_res.status_code == 200
    assert all(i["id"] != item_id for i in list_res.json())

    # 4. Tenant B attempts to delete Tenant A's resource -> MUST RETURN 404
    assert (await client.delete(f"/api/v1/items/{item_id}", headers=headers(tenant_b))).status_code == 404


@pytest.mark.asyncio
async def test_non_member_is_forbidden(client: AsyncClient):
    override_membership(app, {})  # the user belongs to no household
    res = await client.get("/api/v1/items", headers=headers(uuid.uuid4()))
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_missing_household_header(client: AsyncClient):
    res = await client.get("/api/v1/items", headers={"Authorization": f"Bearer {make_test_token(SUB)}"})
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "household_required"
```

---

## 6. Code Coverage Visibility & Thresholds

Coverage is enforced during test execution and in CI:

### A. Running Tests with Coverage Locally
```bash
# Run tests for specific service
cd apps/<app-name>/backend
uv run pytest --cov=src --cov-report=term-missing --cov-report=xml

# Target threshold: >= 80% line coverage
```

### B. CI Quality Gate
The `.github/workflows/python-ci.yml` pipeline executes `pytest --cov` in parallel across all matrix services and fails if any test suite fails.

---

## 7. Containerization & Dockerfile Standards

To avoid workspace lockfile synchronization issues during standalone container builds, follow these exact Docker specifications:

### A. `.dockerignore` Template
Create `apps/<app-name>/backend/.dockerignore`:

```gitignore
.venv
__pycache__
*.pyc
*.pyo
*.pyd
.pytest_cache
.ruff_cache
.coverage
htmlcov
*.egg-info
dist
build
.git
.gitignore
.env
.env.*
*.sqlite3
*.db
uv.lock
```

### B. Standalone `Dockerfile` Template
Create `apps/<app-name>/backend/Dockerfile`:

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Install dependencies first (leverages Docker cache)
COPY pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --no-install-project

# Copy application source and install project
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev

# Final runtime image
FROM python:3.12-alpine

WORKDIR /app

# Copy virtualenv and application from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/main.py /app/main.py

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/api/v1/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 8. App Scaffolding Checklist

- [ ] Directory created at `apps/<app-name>/backend/` with FDD 6-file structure.
- [ ] Registered in root `pyproject.toml` (`[tool.uv.workspace]`).
- [ ] Service `pyproject.toml` created with dev dependencies (`pytest`, `pytest-asyncio`, `pytest-cov`, `respx`).
- [ ] `conftest.py` implemented with in-memory `aiosqlite` and `asyncio_mode = "auto"`.
- [ ] Household isolation integration test implemented.
- [ ] Every household-scoped route depends on `require_household` (or `require_role`); no JWT household or role claims are parsed.
- [ ] MCP tools declare no `household_id` / `home_id` / `user_id` parameters and read `get_mcp_household_context()`.
- [ ] `HOUSEHOLD_INTERNAL_URL` and `ALFHEIM_INTERNAL_TOKEN` are wired into the backend service, which depends on a healthy `household-backend`.
- [ ] `uv run ruff check .` and `uv run ruff format --check .` pass cleanly.
- [ ] `uv run ty check apps/<app-name>/backend` passes.
- [ ] `uv run pytest --cov` achieves >= 80% coverage.
- [ ] `Dockerfile` and `.dockerignore` created using the standalone `uv sync` pattern.
- [ ] Service added to `.github/workflows/python-ci.yml` test matrix.
