---
title: "Python and FastAPI Conventions"
description: "Canonical conventions for Alfheim Python backends: feature module layout, shared service layer, household authorization, tooling and tests."
sidebar:
  label: "Python & FastAPI"
---

> **TL;DR:** Canonical conventions for every Python backend (`apps/*/backend`, `packages/backend-shared`). Nested `AGENTS.md` files link here instead of repeating these rules.

---

## Stack

Python 3.12+, FastAPI, FastMCP, SQLModel / SQLAlchemy (async), Pydantic v2, Alembic. The `uv` workspace in the root `pyproject.toml` globs `apps/*/backend`. Shared code lives in `backend_shared`.

## Feature module layout

Each domain is a feature module under `src/features/<domain>/`:

| File | Owns | Must not contain |
| --- | --- | --- |
| `models.py` | ORM entities and table definitions | HTTP logic, Pydantic schemas, business rules |
| `schemas.py` | Pydantic v2 request and response models (`Create…Request`, `Update…Request`, `…Response`) | Database access |
| `service.py` | Business logic, queries, third-party calls; takes an `AsyncSession` and plain values | FastAPI requests, headers, MCP contexts |
| `router.py` | `APIRouter` endpoints, dependency injection, delegation to `service.py` | Queries, calculations, domain validation |
| `mcp_tools.py` | FastMCP tool registrations for AI agents | Queries, calculations, tenant parameters |
| `exceptions.py` | Domain exceptions and their HTTP mapping | |

REST routes and MCP tools that perform the same operation both call the same `service.py` function. Export a feature's public interface through `__init__.py` with `__all__`.

## Household authorization

Authorization rules are in [Authentication and security](../../explanation/authentication-security.md) and [ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md). In code:

- `main.py` calls `configure_household_auth(settings)` and `await close_membership_client()` on shutdown.
- Every household-scoped route depends on `backend_shared.household.require_household`, or `require_role("OWNER", "ADMIN")` where a role is needed, and passes `ctx.household_id` and `ctx.user_id` to the service. Never parse `X-Household-ID` or JWT claims yourself.
- The standard role matrix lives in `backend_shared.household.permissions`: `require_writer` (`WRITE_ROLES`: OWNER, ADMIN, MEMBER; GUEST stays read-only) for state-changing routes and `require_admin` (`ADMIN_ROLES`: OWNER, ADMIN) for household-wide configuration and destructive routes. MCP tools apply the same tuples with `backend_shared.mcp_permissions.mcp_requires_role`. The role always comes from the membership API through `require_household`, never from a JWT claim. Keep an app-local `core/permissions.py` only for app-specific rules.
- Error bodies use `{"detail": {"code", "message"}}`: `401 unauthenticated`, `400 household_required` / `household_invalid`, `403 household_forbidden` / `household_role_forbidden`, `503 household_service_unavailable`.
- MCP apps are created with `mount_mcp(app, mcp, settings=settings)` (endpoint exactly `/mcp`, wrapped in `MCPAuthenticationMiddleware`). Tools read the tenant with `get_mcp_household_context()` and never declare `household_id`, `home_id` or `user_id` parameters.
- Outbound calls to another Alfheim app forward the caller's `Authorization` and `X-Household-ID`; the target app authorizes the caller itself.

## Tooling and gates

`ruff.toml` at the repository root sets the lint and format rules for the whole workspace. Run the gate with `./scripts/verify.sh --python`, which runs these checks:

```bash
uv run ruff check .
uv run ruff format --check .
uv run ty check
uv run pytest --cov
```

All Python code is fully type-annotated. App backends keep at least 95 % line coverage.

## Tests

- Tests run against in-memory SQLite (`aiosqlite`) with `asyncio_mode = "auto"`; never override the `event_loop` fixture.
- Set `TESTING=true`, `OTEL_ENABLED=false` and a dummy `ALFHEIM_INTERNAL_TOKEN` before importing the app.
- Stub the membership API with `override_membership` and mint tokens with `make_test_token` from `backend_shared.household.testing`.
- Mock calls to other Alfheim services with `respx` and assert that `X-Household-ID` is forwarded.
- Every service that stores household data ships a household-isolation suite: Tenant A cannot read, change or delete Tenant B's rows (404), a non-member gets `403 household_forbidden`, a missing header gets `400 household_required`, and an unreachable membership API gets `503`.

Copy-ready `conftest.py` and isolation-test templates are in [Create a new FDD microservice](../../tutorials/create-new-fdd-service.md#reference-templates).

## Persistence

Schema changes go through Alembic. Every backend runs `alembic upgrade head` at startup under a Postgres advisory lock; `create_all` is not used in production. See [Schema migrations](../../explanation/schema-migrations.md).

The database plumbing lives in `backend_shared`; a backend only supplies its models, settings and lock key:

| File in the backend | Contents |
| --- | --- |
| `alembic.ini` | Only the `[alembic]` section (`script_location`, `prepend_sys_path`, `path_separator`, `file_template`). CLI logging is configured by `run_env`. |
| `alembic/env.py` | `load_models()` and one call: `run_env(SQLModel.metadata, database_url=settings.DATABASE_URL)`. Pass `include_object=ignore_indexes({...})` for indexes created with raw SQL. |
| `alembic/script.py.mako` | The revision template. It stays per backend because Alembic only reads it from the script directory. |
| `core/migrations.py` | `MIGRATION_LOCK_KEY` (a constant `pg_advisory_xact_lock` key; never change a released one) and `load_models()`, which imports every model module. |
| `core/database.py` | `engine, async_session_factory = create_engine_and_session(settings)`, `get_db_session`, and `run_migrations(engine)`, which calls `backend_shared.db.run_migrations` with the loader, lock key, backend directory and `SQLModel.metadata`. |

`backend_shared.db.run_migrations` adopts a legacy `create_all` database by stamping revision `0001`, then upgrades to head in one transaction. Tests build their Alembic configuration with `backend_shared.migrations.alembic_config(BACKEND_DIR)`.
