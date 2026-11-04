# AGENTS.md — apps/budget/backend

Python backend: Household finances: accounts, sinking-fund pots, monthly plans, transaction ledger. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, service layer, household auth, tests): [Python and FastAPI](../../../docs/en/reference/conventions/python-fastapi.md).
Tier-2 scaffolding: [Create a new FDD service](../../../docs/en/tutorials/create-new-fdd-service.md).

## Commands

```bash
uv run pytest apps/budget/backend --cov=src   # tests, run from the repo root
uv run ruff check apps/budget/backend && uv run ruff format --check apps/budget/backend
uv run ty check apps/budget/backend
./scripts/verify.sh --python                   # full gate, must exit 0
```

## Specific to this app

- Database: postgres-core, database `alfheim_budget`. Schema changes need an Alembic migration in `alembic/versions/`.
- Receipt files go to RustFS through the backend. The presigned PUT upload here is legacy (#802); do not copy it.
- Features: `accounts`, `plans`, `pots`, `transactions`.

Reference page with the data model invariants: [docs/en/reference/apps/budget.md](../../../docs/en/reference/apps/budget.md).
