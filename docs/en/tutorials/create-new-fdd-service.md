---
title: "Create a New FDD Microservice"
description: "Step-by-step guide to scaffolding, implementing, and registering a new Feature-Driven Design (FDD) microservice application in the Alfheim monorepo."
sidebar:
  order: 3
---

> **TL;DR:** Step-by-step guide to scaffolding, implementing, and registering a new Feature-Driven Design (FDD) microservice application in the Alfheim monorepo.

---

## 📋 Table of Contents
- [Overview](#overview)
- [Step 1: Scaffold Directory Structure](#step-1-scaffold-directory-structure)
- [Step 2: Implement Backend Feature Domains](#step-2-implement-backend-feature-domains)
- [Step 3: Implement Microfrontend](#step-3-implement-microfrontend)
- [Step 4: Register Service in Caddy & Dashboard](#step-4-register-service-in-caddy--dashboard)
- [Step 5: Write Tests & Verify Quality Gates](#step-5-write-tests--verify-quality-gates)
- [Reference templates](#reference-templates)
- [Checklist](#checklist)

---

## Overview

New microservices in `apps/<new-app>` consist of a paired FastAPI (or Go) backend and Next.js 16 microfrontend. This tutorial walks through creating a new service called `recipes`.

---

## Step 1: Scaffold Directory Structure

1. Create application directories under `apps/recipes/`:
   ```bash
   mkdir -p apps/recipes/backend/src/features/catalog
   mkdir -p apps/recipes/frontend/src/app/[locale]
   ```

2. Create `apps/recipes/compose.yml` defining the backend/frontend services. New apps do not get a
   dedicated database container: they share the consolidated `postgres-core` cluster, like
   `budget` and `library`. Add `recipes` to the `SERVICES` array in
   `infrastructure/postgres/init-multiple-dbs.sh`
   (`"alfheim_recipes:${RECIPES_POSTGRES_USER:-recipes_user}:${RECIPES_POSTGRES_PASSWORD:-postgres}"`)
   so the database and its least-privilege owner are created idempotently, and point
   `DATABASE_URL` at `postgres-core:5432/alfheim_recipes`.

3. Declare the networks in `compose.yml`: `gateway-net` for ingress traffic and an
   isolated `app-recipes-net` where the backend reaches `postgres-core`. Both are external
   networks pre-created by `scripts/up.sh`; add `app-recipes-net` to the network list in its
   pre-flight stage. For telemetry, connect the backend to `observability-internal` and set
   `OTEL_ENABLED=true`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317`,
   `OTEL_EXPORTER_OTLP_INSECURE=true` and `OTEL_SERVICE_NAME=recipes-backend`.
4. Add an `apps/recipes/.env.example` with placeholder values only.

---

## Step 2: Implement Backend Feature Domains

Follow Feature-Driven Design (FDD) in `apps/recipes/backend/src/features/catalog/`:

1. Define SQLModel database tables in `models.py`.
2. Define Pydantic request/response models in `schemas.py`.
3. Implement business logic in `service.py`.
4. Create FastAPI REST routes in `router.py`, with every household-scoped route depending on
   `backend_shared.household.require_household` (or `require_role(...)` where a route needs a
   specific role). Never parse `X-Household-ID` or a JWT household/role claim yourself — Zitadel
   issues neither. Call `configure_household_auth(settings)` in `main.py` and
   `await close_membership_client()` on shutdown. See
   [ADR 0006](../explanation/decisions/0006-household-authorization-via-membership-api.md) and
   [Python and FastAPI conventions](../reference/conventions/python-fastapi.md).
5. Export public interfaces explicitly in `__init__.py`:
   ```python
   # src/features/catalog/__init__.py
   from .models import Recipe
   from .service import RecipeService

   __all__ = ["Recipe", "RecipeService"]
   ```
6. Wire the app's own `HOUSEHOLD_INTERNAL_URL` (default `http://household-backend:8080`) and
   `ALFHEIM_INTERNAL_TOKEN` into `compose.yml` and `compose.prod.yaml`, and make the backend
   depend on `household-backend` being healthy. Without a valid, matching
   `ALFHEIM_INTERNAL_TOKEN` every household-scoped request fails closed with
   `503 household_service_unavailable`.
7. Set up schema migrations with the shared scaffold from `backend_shared`. Copy `alembic.ini`
   (the `[alembic]` section only) and `alembic/script.py.mako` from an existing backend, then
   add the three small files that are specific to the service:
   ```python
   # src/core/migrations.py
   MIGRATION_LOCK_KEY = 7_265_008  # next free pg_advisory_xact_lock key; never change it later


   def load_models() -> None:
       """Import every model module so all tables are registered on ``SQLModel.metadata``."""
       from src.features.catalog.models import Recipe  # noqa: F401
   ```
   ```python
   # alembic/env.py
   from backend_shared.migrations import run_env
   from sqlmodel import SQLModel
   from src.core.config import settings
   from src.core.migrations import load_models

   load_models()
   run_env(SQLModel.metadata, database_url=settings.DATABASE_URL)
   ```
   `src/core/database.py` creates `engine, async_session_factory =
   create_engine_and_session(settings)` and wraps `backend_shared.db.run_migrations` (see the
   [Python and FastAPI conventions](../reference/conventions/python-fastapi.md#persistence)).
   `main.py` awaits it on startup. Generate the first revision with
   `uv run alembic revision --autogenerate -m "initial schema"` and set its revision ID to `0001`.

---

## Step 3: Implement Microfrontend

1. Configure Next.js App Router in `apps/recipes/frontend/src/app/[locale]/page.tsx`.
2. Import shared UI primitives from `@alfheim/shared`, including `HouseholdProvider` (mounted by
   the shared `AppShell`) and `HouseholdGate`, which every household-scoped page renders behind.
   Use `useActiveHousehold()` for the active household id — never read
   `localStorage.alfheim_active_household_id` directly — and include it in every household-scoped
   TanStack Query key.
3. Send only `X-Household-ID` (via `applyHouseholdHeaders`, never `X-Household-Role`) on API
   calls, and report household errors with `reportHouseholdErrorResponse`.
4. Enforce the strict 200 lines of code (LOC) limit per `.tsx` source file.
5. Set up the Next.js project like the existing apps: `basePath: '/recipes'`, `output: 'standalone'`
   and `transpilePackages: ['@alfheim/shared']` in `next.config.ts`, `@alfheim/shared` as a
   `workspace:*` dependency, `src/proxy.ts` for locale routing (not the deprecated
   `middleware.ts`), and an `i18n.ts` that merges `getSharedMessages(locale)`.
6. Add the app's strings to `packages/shared/src/features/i18n/locales/{en,de,pl}/recipes.json`
   and register the file in the shared locale builder. All three locales must be complete.
   The conventions are in [Next.js and Tailwind conventions](../reference/conventions/nextjs-tailwind.md).

---

## Step 4: Register Service in Caddy & Dashboard

1. **Caddy Ingress**: Add both a frontend and an API route in `infrastructure/caddy/Caddyfile`,
   following the existing per-app pattern (see the `budget` or `library` entries). On the frontend
   domain:
   ```caddy
   redir /recipes /recipes/en 302
   redir /recipes/ /recipes/en 302

   handle /recipes* {
       reverse_proxy recipes-frontend:3000
   }

   handle_path /api/v1/recipes* {
       rewrite * /api/v1/recipes{path}
       reverse_proxy recipes-backend:8000
   }
   handle_path /recipes/api/v1* {
       rewrite * /api/v1/recipes{path}
       reverse_proxy recipes-backend:8000
   }
   ```
   Add the matching native + prefix-stripped alias on the `api.*` API Gateway domain as well (see
   [Ingress Matrix](../reference/ingress-matrix.md)).

2. **Control Plane Registry**: Register `recipes` in `core/dashboard/backend/internal/features/apps/tier1_core_registry.go`. Integrations that are not part of this monorepo are Tier 2 entries in `deploy/stack-apps.yaml`; see the [classification guidelines](../reference/apps-catalog.md#-application-classification-guidelines).
3. **Application Catalog**: Add `recipes` to [`docs/en/reference/apps-catalog.md`](../reference/apps-catalog.md).
4. **Identity provider**: Register the frontend in the Zitadel console as a `User Agent` application
   with PKCE and redirect URIs `<base-url>/recipes/*`. Backends validate tokens through the
   `OIDC_ISSUER_URL` discovery document and need no further client configuration.
5. **Stack boot**: Add a `STAGE` block to `scripts/up.sh` before the observability stage that
   starts `recipes-backend` and then `recipes-frontend`, waiting for each with `wait_healthy`,
   and add the app to the final summary. Boot services one after another.
6. **Reference page**: Add `docs/en/reference/apps/recipes.md` (purpose, routes, env vars,
   household scoping, MCP tools if any, known issues) — see any existing app reference page for
   the expected shape.

---

## Step 5: Write Tests & Verify Quality Gates

1. Write Pytest backend tests in `apps/recipes/backend/src/features/catalog/tests/`, including a
   household-isolation suite (`backend_shared.household.testing.override_membership`) that proves
   Tenant A cannot read, write or delete Tenant B's data, and covers
   `403 household_forbidden` / `400 household_required` / `503 household_service_unavailable`.
2. Run workspace verification suite:
   ```bash
   ./scripts/verify.sh --python --frontend
   ```

---

## Reference templates

### Backend `pyproject.toml`

```toml
[project]
name = "recipes-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi", "uvicorn[standard]", "sqlmodel", "pydantic-settings", "asyncpg",
    "httpx", "opentelemetry-sdk", "opentelemetry-instrumentation-fastapi",
    "opentelemetry-exporter-otlp",
]

[dependency-groups]
dev = ["pytest", "pytest-asyncio", "pytest-cov", "respx", "aiosqlite"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["src", "tests"]
```

Pin versions the way the existing backends do. The root workspace globs `apps/*/backend`; run
`uv sync --all-packages --all-groups` after editing.

### `conftest.py`

```python
"""Shared Pytest fixtures for recipes-backend."""

import os
import uuid
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

os.environ["TESTING"] = "true"
os.environ["OTEL_ENABLED"] = "false"
# configure_household_auth() needs the internal token at import time
os.environ.setdefault("ALFHEIM_INTERNAL_TOKEN", "test-internal-token")

from backend_shared.household.testing import make_test_token, override_membership

from src.core.database import get_session
from src.main import app

TEST_USER_SUB = "user-1"
TEST_HOUSEHOLD_ID = uuid.uuid4()


@pytest.fixture(name="engine", scope="session")
def engine_fixture():
    return create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


@pytest.fixture(autouse=True)
async def init_db(engine):
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
    override_membership(app, {(TEST_HOUSEHOLD_ID, TEST_USER_SUB): "OWNER"})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="auth_headers")
def auth_headers_fixture() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {make_test_token(TEST_USER_SUB)}",
        "X-Household-ID": str(TEST_HOUSEHOLD_ID),
    }
```

### Household isolation test

```python
import uuid

import pytest
from backend_shared.household.testing import make_test_token, override_membership
from httpx import AsyncClient

from src.main import app

SUB = "user-1"


def headers(household_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_test_token(SUB)}", "X-Household-ID": str(household_id)}


@pytest.mark.asyncio
async def test_tenant_b_cannot_touch_tenant_a_data(client: AsyncClient):
    tenant_a, tenant_b = uuid.uuid4(), uuid.uuid4()
    # The same user belongs to both households; data must still not leak between them.
    override_membership(app, {(tenant_a, SUB): "OWNER", (tenant_b, SUB): "OWNER"})

    created = await client.post("/api/v1/items", json={"name": "Secret"}, headers=headers(tenant_a))
    assert created.status_code == 201
    item_id = created.json()["id"]

    assert (await client.get(f"/api/v1/items/{item_id}", headers=headers(tenant_b))).status_code == 404
    listing = await client.get("/api/v1/items", headers=headers(tenant_b))
    assert all(i["id"] != item_id for i in listing.json())
    assert (await client.delete(f"/api/v1/items/{item_id}", headers=headers(tenant_b))).status_code == 404


@pytest.mark.asyncio
async def test_non_member_is_forbidden(client: AsyncClient):
    override_membership(app, {})
    res = await client.get("/api/v1/items", headers=headers(uuid.uuid4()))
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.asyncio
async def test_missing_household_header(client: AsyncClient):
    res = await client.get("/api/v1/items", headers={"Authorization": f"Bearer {make_test_token(SUB)}"})
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "household_required"
```

### Backend `Dockerfile` and `.dockerignore`

Build each backend standalone so the workspace lockfile does not leak into the image:

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --no-dev --no-install-project
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv uv sync --no-dev

FROM python:3.12-alpine
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/main.py /app/main.py
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/api/v1/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`.dockerignore` excludes `.venv`, `uv.lock`, `__pycache__`, `.pytest_cache`, `.ruff_cache`,
`.coverage`, `.env*`, `*.sqlite3` and `.git`.

---

## Checklist

- [ ] Backend under `apps/<app>/backend/` follows the
      [Python and FastAPI conventions](../reference/conventions/python-fastapi.md).
- [ ] `pyproject.toml`, `Dockerfile`, `.dockerignore` and `conftest.py` created from the templates.
- [ ] Every household-scoped route depends on `require_household` or `require_role`; MCP tools take
      no tenant parameters.
- [ ] `HOUSEHOLD_INTERNAL_URL` and `ALFHEIM_INTERNAL_TOKEN` are wired in `compose.yml` and
      `compose.prod.yaml`; the backend waits for a healthy `household-backend`.
- [ ] Household isolation tests pass.
- [ ] Alembic migration for every table; `postgres-core` init script updated.
- [ ] Frontend follows the [Next.js and Tailwind conventions](../reference/conventions/nextjs-tailwind.md)
      with strings in all three locales.
- [ ] Caddy routes, dashboard registry, `scripts/up.sh` stage, apps catalog and app reference page added.
- [ ] Service added to the `.github/workflows/python-ci.yml` test matrix.
- [ ] `./scripts/verify.sh --python --frontend` exits 0.
