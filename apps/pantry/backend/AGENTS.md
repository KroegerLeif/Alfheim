# AGENTS.md — apps/pantry/backend

Python backend: Household inventory ledger, stock states, expirations, barcode lookup. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, service layer, household auth, tests): [Python and FastAPI](../../../docs/en/reference/conventions/python-fastapi.md).
Tier-2 scaffolding: [Create a new FDD service](../../../docs/en/tutorials/create-new-fdd-service.md).

## Commands

```bash
uv run pytest apps/pantry/backend --cov=src   # tests, run from the repo root
uv run ruff check apps/pantry/backend && uv run ruff format --check apps/pantry/backend
uv run ty check apps/pantry/backend
./scripts/verify.sh --python                   # full gate, must exit 0
```

## Specific to this app

- Database: postgres-core, database `alfheim_pantry`. Schema changes need an Alembic migration in `alembic/versions/`.
- `inventory_transactions` is an immutable ledger: never update or delete rows. Normalize units with Pint before writing `quantity`.
- Guard `inventory_states` writes with `SELECT FOR UPDATE`. The `Backlog` system location cannot be renamed or deleted.
- Products with a valid EAN/UPC are global (`is_global = true`), the only data shared across households.

Reference page with the data model invariants: [docs/en/reference/apps/pantry.md](../../../docs/en/reference/apps/pantry.md).
