# AGENTS.md — apps/maintenance/backend

Python backend: Equipment inventory, recurring maintenance steps, service history. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, service layer, household auth, tests): [Python and FastAPI](../../../docs/en/reference/conventions/python-fastapi.md).
Tier-2 scaffolding: [Create a new FDD service](../../../docs/en/tutorials/create-new-fdd-service.md).

## Commands

```bash
uv run pytest apps/maintenance/backend --cov=app   # tests, run from the repo root
uv run ruff check apps/maintenance/backend && uv run ruff format --check apps/maintenance/backend
uv run ty check apps/maintenance/backend
./scripts/verify.sh --python                   # full gate, must exit 0
```

## Specific to this app

- Database: postgres-core, database `alfheim_maintenance`. Schema changes need an Alembic migration in `alembic/versions/`.
- Source root is `app/` (not `src/`); features live in `app/features/{devices,maintenance,tasks}`.
- There is no local `household` table: `household_id` comes from `require_household` and is indexed on `device`.

Reference page with the data model invariants: [docs/en/reference/apps/maintenance.md](../../../docs/en/reference/apps/maintenance.md).
