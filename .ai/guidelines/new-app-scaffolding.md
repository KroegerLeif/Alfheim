
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
│   │   ├── dependencies.py        # Auth context & Keycloak JWT / X-Household-ID resolver
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
- **Configuration**: Root [`ruff.toml`](file:///Users/leifkroeger/Dev/loeger-os/ruff.toml) enforces Python 3.12 target with rules: `E`, `W`, `F`, `I`, `B`, `UP`, `ASYNC`, `FAST`, `T20`.
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

from src.main import app  # adjust import to your service entrypoint
from src.core.database import get_session

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
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
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
async def test_outbound_service_call(client: AsyncClient):
    # Mock external shopping service response
    respx.post("http://shopping-backend:8000/api/v1/items").mock(
        return_value=httpx.Response(201, json={"id": "mock-item-id", "name": "Milk"})
    )

    response = await client.post("/api/v1/trigger-sync", headers={"X-Household-ID": "test-home"})
    assert response.status_code == 200
```

---

## 5. Zero-Trust Multi-Tenancy & Auth Invariants

Alfheim enforces strict tenant isolation based on Keycloak JWT claims and the `X-Household-ID` header.

### A. Auth Context Dependency (`src/core/dependencies.py`)
```python
import uuid
from fastapi import Header, HTTPException, status


async def get_current_household_id(
    x_household_id: str | None = Header(None, alias="X-Household-ID"),
) -> uuid.UUID:
    if not x_household_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Household-ID header",
        )
    try:
        return uuid.UUID(x_household_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Household-ID UUID format",
        )
```

### B. Mandatory Household Isolation Test Template
Every service that stores household data **MUST** include integration tests verifying that Tenant A cannot read, mutate, or delete Tenant B's records:

```python
"""Multi-tenant Household Isolation Test Suite."""

import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_household_isolation_cannot_access_other_tenant_data(client: AsyncClient):
    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())

    # 1. Tenant A creates a resource
    create_res = await client.post(
        "/api/v1/items",
        json={"name": "Secret Recipe", "quantity": 1},
        headers={"X-Household-ID": tenant_a},
    )
    assert create_res.status_code == 201
    item_id = create_res.json()["id"]

    # 2. Tenant B attempts to fetch Tenant A's resource -> MUST RETURN 404
    get_res = await client.get(
        f"/api/v1/items/{item_id}",
        headers={"X-Household-ID": tenant_b},
    )
    assert get_res.status_code == 404

    # 3. Tenant B lists resources -> MUST NOT contain Tenant A's item
    list_res = await client.get(
        "/api/v1/items",
        headers={"X-Household-ID": tenant_b},
    )
    assert list_res.status_code == 200
    items = list_res.json()
    assert all(i["id"] != item_id for i in items)

    # 4. Tenant B attempts to delete Tenant A's resource -> MUST RETURN 404
    del_res = await client.delete(
        f"/api/v1/items/{item_id}",
        headers={"X-Household-ID": tenant_b},
    )
    assert del_res.status_code == 404
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
- [ ] `uv run ruff check .` and `uv run ruff format --check .` pass cleanly.
- [ ] `uv run ty check apps/<app-name>/backend` passes.
- [ ] `uv run pytest --cov` achieves >= 80% coverage.
- [ ] `Dockerfile` and `.dockerignore` created using the standalone `uv sync` pattern.
- [ ] Service added to `.github/workflows/python-ci.yml` test matrix.
