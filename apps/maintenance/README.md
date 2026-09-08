# Home Maintenance Tracker Application (`apps/maintenance/`)

> **TL;DR:** Home equipment inventory, recurring maintenance scheduling, interactive service checklists, and historical repair logs for Alfheim.

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
| Equipment tracking | Household device inventory (HVAC, Appliances, Vehicles, Filters) |
| Preventative maintenance | Time-based and usage-based recurring maintenance schedules |
| Complex repair steps | Guided interactive maintenance checklists with step verification |
| Repair history & costs | Historical service logs, contractor notes, and parts cost tracking |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy) and FastMCP AI tools.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Dedicated PostgreSQL 16 container (`maintenance-db`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `maintenance-db` | 5432 | Internal `app-maintenance-net` | PostgreSQL 16 Database |
| `maintenance-backend` | 8000 | `/maintenance/api/v1` | FastAPI REST API & FastMCP Tools |
| `maintenance-frontend` | 3000 | `alfheim.loegien.localhost/maintenance` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@maintenance-db:5432/maintenance` | Async PostgreSQL connection string |
| `KEYCLOAK_URL` | `http://keycloak:8080/auth` | Keycloak backend auth endpoint |
| `NEXT_PUBLIC_MAINTENANCE_API_URL` | `http://api.alfheim.loegien.localhost/maintenance/api/v1` | Browser API gateway endpoint |

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

- `equipment`: Appliance, device, and vehicle registration.
- `schedules`: Maintenance intervals (e.g. 6-month filter replacement).
- `tasks`: Interactive maintenance task execution and step checklists.
- `history`: Permanent service logs, contractor notes, and parts cost ledger.

---

## 🧪 Testing & Quality Gates

```bash
# Execute Backend Pytest Suite & Coverage
cd backend && uv run pytest --cov

# Execute Frontend Typecheck & Vitest Suite
cd frontend && pnpm check-types && pnpm test
```
