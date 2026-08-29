# Budget Backend Service

FastAPI backend microservice for the Alfheim Budget & Treasury application (`apps/budget/backend`).

## 🛠️ Tech Stack

- **Framework**: Python 3.12, FastAPI, SQLModel (Async SQLAlchemy)
- **Database**: PostgreSQL 16 (via `asyncpg`)
- **Storage**: RustFS / S3 Object Storage for receipt images
- **Dependencies**: `uv` workspace member, integrated with `packages/backend-shared` (OpenTelemetry, Keycloak JWT, tenant isolation)

## 📁 Domain Features (`src/features/`)

Following Feature-Driven Design (FDD), domain logic is partitioned into self-contained feature subdirectories:

- `accounts/`: Bank and cash account management, balance tracking, account types.
- `pots/`: Virtual sinking funds and goal allocation pots with target tracking.
- `plans/`: Envelope-based monthly and event-driven budget planning.
- `transactions/`: Immutable ledger for income and expense transactions with receipt attachments.

## 🔐 Multi-Tenancy & Auth

- Authorization is enforced via Keycloak OIDC JWT tokens.
- All endpoints validate and require the `X-Household-ID` request header, isolating financial records per household context.

## ⚙️ Environment Variables

- `DATABASE_URL`: Async PostgreSQL connection string.
- `KEYCLOAK_URL`: Keycloak backend authentication URL.
- `KEYCLOAK_PUBLIC_URL`: Keycloak public issuer URL.
- `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`: Receipt storage settings.
- `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`: Telemetry export settings.

## 🧪 Local Testing & Quality Commands

```bash
# Install dependencies
uv sync

# Run API server locally
uv run uvicorn src.main:app --reload

# Run tests and coverage
PYTHONPATH=. uv run pytest --cov

# Lint and type check
uv run ruff check .
uv run ruff format --check .
uv run ty check .
```
