# Budget & Treasury Application (`apps/budget/`)

> **TL;DR:** Multi-tenant household financial management, account balance tracking, sinking fund pots, monthly envelope plans, and transaction ledger with receipt attachment support.

---

## 📋 Table of Contents
- [Purpose & Core Value](#purpose--core-value)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Ingress Routing & Environment Configuration](#ingress-routing--environment-configuration)
- [Local Development & Commands](#local-development--commands)
- [Domain Features](#domain-features)
- [Testing & Quality Gates](#testing--quality-gates)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Fragmented household accounts | Centralized balance tracking (Checking, Savings, Cash, Credit) |
| Savings goal allocation | Virtual sinking fund pots with percentage/fixed target tracking |
| Unplanned expenses | Envelope-style monthly & event budget plans |
| Expense audit trail | Categorized transaction ledger with RustFS S3 receipt image attachments |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy), RustFS S3 integration, and OpenTelemetry.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_budget` database, owned by `budget_user`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `budget-backend` | 8000 | `/budget/api/v1` | FastAPI REST API & Telemetry |
| `budget-frontend` | 3000 | `alfheim.loegien.localhost/budget` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://budget_user:postgres@postgres-core:5432/alfheim_budget` | Async PostgreSQL connection string |
| `S3_ENDPOINT_URL` | `http://rustfs:9000` | S3-compatible object storage endpoint |
| `S3_BUCKET_NAME` | `budget-receipts` | S3 bucket for receipt images |
| `NEXT_PUBLIC_BUDGET_API_URL` | `http://api.alfheim.loegien.localhost/budget/api/v1` | Browser API gateway endpoint |

---

## 🚀 Local Development & Commands

### 1. Run via Docker Compose
```bash
docker compose up -d
```

### 2. Run Backend Locally
```bash
cd backend
uv sync
uv run uvicorn src.main:app --reload --port 8000
```

### 3. Run Frontend Locally
```bash
cd frontend
pnpm install
pnpm dev
```

---

## 📁 Domain Features (`src/features/`)

- `accounts`: Bank, cash, and credit account management, balance tracking, and account types.
- `pots`: Virtual sinking funds and goal allocation pots with target progress tracking.
- `plans`: Envelope-based monthly and event-driven budget planning.
- `transactions`: Immutable ledger for income and expense transactions with receipt attachments.

---

## 🧪 Testing & Quality Gates

```bash
# Execute Backend Pytest Suite & Coverage
cd backend && uv run pytest --cov

# Execute Frontend Typecheck & Vitest Suite
cd frontend && pnpm check-types && pnpm test
```
