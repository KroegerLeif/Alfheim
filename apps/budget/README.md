# Budget & Treasury Application (`apps/budget/`)

The **Budget App** is the household financial management and treasury tracking service for the Alfheim monorepo. It manages bank accounts, virtual sinking fund pots, monthly/event budget allocation plans, and immutable transaction ledgers with receipt attachment support.

---

## 🎯 Purpose & Value Proposition

| Need | Solution |
| :--- | :--- |
| Fragmented household accounts | Centralized account balance tracking (Checking, Savings, Cash, Credit) |
| Savings goal allocation | Virtual sinking fund pots with percentage/fixed target tracking |
| Unplanned expenses | Envelope-style monthly & event budget plans |
| Expense audit trail | Categorized transaction ledger with receipt image attachments |

---

## 🏗️ Architecture Overview

```
apps/budget/
├── backend/          # FastAPI microservice (Accounts, Pots, Plans, Transactions)
├── frontend/         # Next.js 16 App Router MFE (Port 3000, routed at /budget)
└── compose.yml       # Container orchestration (budget-db, budget-backend, budget-frontend)
```

The application follows the **Feature-Driven Design (FDD)** paradigm with multi-tenant household isolation.

---

## 🌐 Ingress Routing & Ports

| Service | Internal Port | Host Mapping / Gateway Route | Protocol / Description |
| :--- | :--- | :--- | :--- |
| `budget-db` | 5432 | `5436:5432` | PostgreSQL 16 database |
| `budget-backend` | 8000 | `/budget/api/v1` or `/api/v1/budget` | FastAPI REST API & Telemetry |
| `budget-frontend` | 3000 | `alfheim.loegien.localhost/budget` | Next.js MFE |

---

## 🔑 Environment Variables

Key configuration parameters (see `.env.example`):

- `DATABASE_URL`: PostgreSQL connection string (`postgresql+asyncpg://postgres:postgres@budget-db:5432/budget`).
- `KEYCLOAK_URL`: Internal Keycloak identity server endpoint (`http://keycloak:8080/auth`).
- `KEYCLOAK_PUBLIC_URL`: Browser-accessible Keycloak endpoint (`http://api.alfheim.loegien.localhost/auth`).
- `S3_ACCESS_KEY` / `S3_SECRET_KEY`: S3 storage credentials.
- `S3_ENDPOINT_URL`: RustFS / MinIO storage endpoint (`http://rustfs:9000`).
- `S3_BUCKET_NAME`: Receipt attachments bucket (`budget-receipts`).
- `NEXT_PUBLIC_BUDGET_API_URL`: MFE API gateway endpoint (`http://api.alfheim.loegien.localhost/budget/api/v1`).

---

## 🚀 Local Run & Test Commands

### Run via Docker Compose
```bash
docker compose up -d
```

### Backend Development
```bash
cd apps/budget/backend
uv sync
uv run uvicorn src.main:app --reload --port 8000
PYTHONPATH=. uv run pytest --cov
```

### Frontend Development
```bash
cd apps/budget/frontend
pnpm install
pnpm dev
pnpm test
```
