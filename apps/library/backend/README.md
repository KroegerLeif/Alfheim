# Library Backend Service

FastAPI backend microservice for the Alfheim Media & Library application (`apps/library/backend`).

## 🛠️ Stack & Architecture

- **Framework**: Python 3.12, FastAPI, SQLModel (Async SQLAlchemy)
- **Database**: PostgreSQL 16 (via `asyncpg`)
- **Workspace Dependencies**: `uv` workspace member, integrated with `packages/backend-shared` for telemetry and health monitoring.

## 📁 Domain Layout (`src/`)

- `src/api/`: REST API routers (`books`, `media`, `loans`, `progress`).
- `src/db/`: Database session dependency and engine initialization.
- `src/schemas/`: Pydantic / SQLModel data transfer objects and database entities.
- `src/services/`: Core domain business logic and OpenLibrary API client integrations.

## ⚙️ Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (`postgresql+asyncpg://postgres:postgres@library-db:5432/library`).
- `OTEL_ENABLED`: Enables OpenTelemetry trace propagation (`true`/`false`).
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry OTLP collector endpoint (`http://otel-collector:4317`).

## 🧪 Local Run & Testing

```bash
# Sync workspace virtual environment
uv sync

# Run server locally
uv run uvicorn src.main:app --reload

# Execute tests and coverage
PYTHONPATH=. uv run pytest --cov

# Linting & static analysis
uv run ruff check .
uv run ruff format --check .
uv run ty check .
```
