# AGENTS.md — apps/workout/backend

Python backend: Exercise catalog, plans, live sessions with offline sync, FastMCP agent tools. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, service layer, household auth, tests): [Python and FastAPI](../../../docs/en/reference/conventions/python-fastapi.md).
Tier-2 scaffolding: [Create a new FDD service](../../../docs/en/tutorials/create-new-fdd-service.md).

## Commands

```bash
uv run pytest apps/workout/backend --cov=src   # tests, run from the repo root
uv run ruff check apps/workout/backend && uv run ruff format --check apps/workout/backend
uv run ty check apps/workout/backend
./scripts/verify.sh --python                   # full gate, must exit 0
```

## Specific to this app

- Database: postgres-core, database `alfheim_workout`. Schema changes need an Alembic migration in `alembic/versions/`.
- Sessions are structural clones of a plan; never add live foreign keys into `plan_exercises` or `plan_sets`.
- `POST /sessions/{id}/sets/sync` is idempotent through `client_idempotency_key`; keep the partial unique index intact.
- A resource that exists but is invisible to the caller returns 404; a household the caller is not a member of returns `403 household_forbidden` from the auth dependency.

Reference page with the data model invariants: [docs/en/reference/apps/workout.md](../../../docs/en/reference/apps/workout.md).
