# AGENTS.md — apps/chores/backend

Python backend: Chore templates, daily instances, points and household streaks. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, service layer, household auth, tests): [Python and FastAPI](../../../docs/en/reference/conventions/python-fastapi.md).
Tier-2 scaffolding: [Create a new FDD service](../../../docs/en/tutorials/create-new-fdd-service.md).

## Commands

```bash
uv run pytest apps/chores/backend --cov=src   # tests, run from the repo root
uv run ruff check apps/chores/backend && uv run ruff format --check apps/chores/backend
uv run ty check apps/chores/backend
./scripts/verify.sh --python                   # full gate, must exit 0
```

## Specific to this app

- Database: postgres-core, database `alfheim_chores`. Schema changes need an Alembic migration in `alembic/versions/`.
- The daily reset must stay idempotent and self-healing: `ensure_household_reset` runs on first read of the day and from the nightly scheduler in `src/main.py`.
- Do not drop the unique indexes `uq_chore_template_name_per_home` and `uq_chore_instance_template_per_date`; invariants are in the app reference.

Reference page with the data model invariants: [docs/en/reference/apps/chores.md](../../../docs/en/reference/apps/chores.md).
