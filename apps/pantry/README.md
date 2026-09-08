# Digital Pantry Application (`apps/pantry/`)

> **TL;DR:** Multi-tenant household inventory, stock tracking, expiration alert, and barcode lookup service for Alfheim.

---

## 📋 Table of Contents
- [Purpose & Core Value](#purpose--core-value)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Ingress Routing & Environment Configuration](#ingress-routing--environment-configuration)
- [Local Development & Commands](#local-development--commands)
- [Domain Model & Key Concepts](#domain-model--key-concepts)
- [Testing & Quality Gates](#testing--quality-gates)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Don't know what's in the pantry | Real-time stock tracking with location-aware batch management |
| Food expires unnoticed | Expiration date tracking with urgency-sorted alerts feed |
| Restocking is reactive | Minimum stock quotas with automatic shopping list sync |
| No consumption visibility | Monthly consumption analytics (OUT/WASTE movements) |
| Multiple storage areas | Multi-location storage layout (Fridge, Cabinet, Backlog) |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy), Pint unit conversion, and FastMCP AI tools.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_pantry` database, owned by `pantry_user`).

### FDD Domain Features (`src/features/`)
- `locations`: Physical and virtual storage places (Cabinet, Fridge, Pantry). System default locations (Backlog) are protected against accidental deletion.
- `categories`: Tag classification groups for products.
- `products`: Master product blueprints (EAN/UPC barcode lookup, brand, base unit). Barcoded items promote to global system templates. Open Food Facts API integration.
- `inventory`: Stock ledger transactions (IN, OUT, WASTE) and live inventory state cache. Enforces ACID safety write locks (`SELECT FOR UPDATE`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `pantry-backend` | 8000 | `/pantry/api/v1` | FastAPI REST API & FastMCP Server |
| `pantry-frontend` | 3000 | `alfheim.loegien.localhost/pantry` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://pantry_user:postgres@postgres-core:5432/alfheim_pantry` | Async PostgreSQL connection string |
| `KEYCLOAK_URL` | `http://keycloak:8080/auth` | Internal Keycloak auth endpoint |
| `NEXT_PUBLIC_PANTRY_API_URL` | `http://api.alfheim.loegien.localhost/pantry/api/v1` | Browser API gateway endpoint |

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

## 🔑 Domain Model & Key Concepts

- **Product Blueprint** (`products`): Master data definition (name, brand, barcode, base unit, min stock quota).
- **Inventory State** (`inventory_states`): Live stock cache for a `(product, location, batch_code)` tuple.
- **Transaction Ledger** (`inventory_transactions`): Immutable audit log recording every IN, OUT, and WASTE stock movement.

---

## 🧪 Testing & Quality Gates

```bash
# Execute Backend Pytest Suite & Coverage
cd backend && uv run pytest --cov

# Execute Frontend Typecheck & Vitest Suite
cd frontend && pnpm check-types && pnpm test
```
