# AGENTS.md — apps/shopping/backend

Python backend: Shared and personal shopping lists, stock-in sync with Pantry. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, service layer, household auth, tests): [Python and FastAPI](../../../docs/en/reference/conventions/python-fastapi.md).
Tier-2 scaffolding: [Create a new FDD service](../../../docs/en/tutorials/create-new-fdd-service.md).

## Commands

```bash
uv run pytest apps/shopping/backend --cov=src   # tests, run from the repo root
uv run ruff check apps/shopping/backend && uv run ruff format --check apps/shopping/backend
uv run ty check apps/shopping/backend
./scripts/verify.sh --python                   # full gate, must exit 0
```

## Specific to this app

- Database: postgres-core, database `alfheim_shopping`. Schema changes need an Alembic migration in `alembic/versions/`.
- Per household at most one `is_default` list, per owner at most one `is_personal` list; the API never deletes a protected list.
- The UI decides which lists are protected only from `is_personal` and `is_default`, never from the list name.
- Calls to Pantry forward the caller's bearer token and `X-Household-ID`.

Reference page with the data model invariants: [docs/en/reference/apps/shopping.md](../../../docs/en/reference/apps/shopping.md).
