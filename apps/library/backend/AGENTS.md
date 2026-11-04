# AGENTS.md — apps/library/backend

Python backend: Media catalog, loans, metadata lookup, game manuals, streaming subscriptions. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, service layer, household auth, tests): [Python and FastAPI](../../../docs/en/reference/conventions/python-fastapi.md).
Tier-2 scaffolding: [Create a new FDD service](../../../docs/en/tutorials/create-new-fdd-service.md).

## Commands

```bash
uv run pytest apps/library/backend --cov=src   # tests, run from the repo root
uv run ruff check apps/library/backend && uv run ruff format --check apps/library/backend
uv run ty check apps/library/backend
./scripts/verify.sh --python                   # full gate, must exit 0
```

## Specific to this app

- Database: postgres-core, database `alfheim_library`. Schema changes need an Alembic migration in `alembic/versions/`.
- Game manuals and other binaries go to RustFS via `backend_shared.storage` helpers, never to Postgres.
- External metadata keys (`GOOGLE_BOOKS_API_KEY`, `TMDB_API_KEY`) are optional; the feature must degrade cleanly when they are empty.

Reference page with the data model invariants: [docs/en/reference/apps/library.md](../../../docs/en/reference/apps/library.md).
