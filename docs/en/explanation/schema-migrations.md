---
title: "Schema Migrations"
description: "How the Python backends create and upgrade their PostgreSQL schemas with Alembic at startup, for fresh installs and for databases created before migrations existed."
---

> **TL;DR:** Every Python backend (budget, chores, library, maintenance, pantry, shopping, workout) owns its schema through Alembic revisions that run automatically at startup, under a PostgreSQL advisory lock. `SQLModel.metadata.create_all` is no longer part of the production startup path.

---

## 📋 Table of Contents
- [Why migrations](#why-migrations)
- [What happens at startup](#what-happens-at-startup)
- [Existing installations](#existing-installations)
- [Writing a new revision](#writing-a-new-revision)
- [Running Alembic by hand](#running-alembic-by-hand)
- [Testing](#testing)

---

## Why migrations

`create_all` only creates tables that are missing. It never alters a table that already exists, so every model change that touched an existing table (a new column, a changed unique index, a foreign key rule) silently did nothing on installations that had run an older release. Alembic revisions make those changes explicit, ordered and testable.

## What happens at startup

Each backend calls `run_migrations(engine)` (in `src/core/migrations.py`; `src/db/migrations.py` for the library) from `init_db()` before it serves traffic:

1. A PostgreSQL advisory lock (`pg_advisory_xact_lock`) is taken so replicas that boot together migrate one after the other.
2. If the database has application tables but no `alembic_version` table, it is treated as a legacy installation (see below).
3. `alembic upgrade head` runs in the same transaction. PostgreSQL DDL is transactional, so a failing revision leaves the schema untouched and the backend does not start.

Revision `0001` is the baseline and creates the full schema as it was when migrations were introduced. Later revisions are small and idempotent.

## Existing installations

Databases created by `create_all` have no `alembic_version` table. On their first start after the update the backend:

1. creates any application table that is missing (existing tables are not touched),
2. stamps revision `0001`, and
3. runs the later revisions, which bring older table shapes up to date and are no-ops for tables that are already current.

Revisions that exist for this purpose:

| App | Revision | Effect on a legacy database |
| --- | --- | --- |
| budget | `0002` | Recreates the `transactions.account_id` / `pot_id` foreign keys with `ON DELETE RESTRICT` |
| pantry | `0002` | Replaces the global unique `ix_products_barcode` with a plain index plus the household-scoped and shared-catalog unique indexes |
| shopping | `0002` | Adds `is_default`, `is_personal` and `position` to `shopping_lists`, backfills `NULL` and enforces `NOT NULL`; replaces the former startup `ALTER TABLE` statements |
| maintenance | `0002` | Moves the pre-UUID integer-household tables, with their rows, into the `legacy_maintenance` schema and creates the current tables |
| library | `0002` | Creates the `pg_trgm` extension and the full-text and trigram search indexes on `items` |

The maintenance conversion cannot map integer household ids to UUID households, so the old rows are kept but not served. See [Troubleshooting](../how-to/troubleshooting.md#symptom-5-old-maintenance-data-is-missing-after-the-update).

## Writing a new revision

1. Change the model.
2. Generate a draft against an up-to-date, empty PostgreSQL database and review it by hand:

   ```bash
   cd apps/<app>/backend
   DATABASE_URL=postgresql+asyncpg://postgres:pw@localhost:5432/scratch uv run alembic upgrade head
   DATABASE_URL=postgresql+asyncpg://postgres:pw@localhost:5432/scratch uv run alembic revision --autogenerate -m "describe the change"
   ```

3. Keep the revision idempotent when it alters a table whose older shape may exist without the change (inspect the database before altering), and give it a working `downgrade`. Do not edit revisions that have been released.
4. Run `uv run alembic check`: it must report `No new upgrade operations detected`.

## Running Alembic by hand

`alembic.ini` and `alembic/env.py` live in `apps/<app>/backend`. The CLI reads the connection string from `DATABASE_URL` (the same setting the service uses), so `alembic upgrade head`, `alembic current` and `alembic check` work against any reachable database.

## Testing

Each backend has a `test_migrations.py`. The SQLite tests always run. The PostgreSQL tests (upgrade matches the models, downgrade to base, legacy databases, concurrent startups) run when `ALFHEIM_MIGRATION_TEST_DATABASE_URL` points at a disposable database; its `public` schema is dropped and recreated:

```bash
docker run -d --rm -p 55432:5432 -e POSTGRES_PASSWORD=pg postgres:16-alpine
ALFHEIM_MIGRATION_TEST_DATABASE_URL='postgresql+asyncpg://postgres:pg@localhost:55432/postgres' \
  uv run --directory apps/pantry/backend pytest -q
```
