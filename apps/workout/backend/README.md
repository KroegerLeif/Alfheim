# Workout Tracker Backend

Backend microservice and MCP server for the Alfheim Workout Tracker app.

## Stack

- Python 3.12, FastAPI, SQLModel (async SQLAlchemy), Pydantic v2
- FastMCP for the AI-agent tool surface
- `uv` workspace member (`apps/workout/backend`), depends on `packages/backend-shared` for
  Keycloak JWT/household auth, OpenTelemetry, and storage helpers.

## Features (`src/features/`)

- `equipment` — CRUD for gear scoped `system` / `household` / `user`.
- `exercises` — exercise catalog, muscle taxonomy, per-user default weights and favorites.
- `plans` — multi-day split routines with a relative weight engine (`absolute` / `default` / `offset`).
- `session` — live workout execution logs, cloned from plan state at start for historical immutability,
  plus offline-sync ack endpoints.
- `analytics` — muscle-volume, streak, and household-leaderboard read-only aggregations.
- `mcp` — cross-feature composite MCP tools (documented exception to the per-feature 6-file rule).

## Local development

```bash
uv sync
uv run uvicorn src.main:app --reload
uv run pytest --cov=src --cov-report=term-missing
uv run ruff check .
uv run ruff format --check .
uv run ty check .
```

## Multi-tenancy

Every route and MCP tool requires household context (`X-Household-ID` header for REST,
explicit `household_id` parameter for MCP tools) and filters all queries by it. See
`packages/backend-shared/src/backend_shared/dependencies.py` for the auth/tenancy mechanics.
