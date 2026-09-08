# Shopping Checklist Application (`apps/shopping/`)

> **TL;DR:** Collaborative household shopping lists, personal private lists, drag-and-drop item reordering, and Digital Pantry stock export synchronization.

---

## 📋 Table of Contents
- [Purpose & Core Value](#purpose--core-value)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Ingress Routing & Environment Configuration](#ingress-routing--environment-configuration)
- [Local Development & Commands](#local-development--commands)
- [Domain Features & Auto-Provisioning Rules](#domain-features--auto-provisioning-rules)
- [Testing & Quality Gates](#testing--quality-gates)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Forgotten shopping items | Shared real-time household shopping list |
| Private personal purchases | Protected personal shopping list (`is_personal=true`) per user |
| Pantry stock running low | Automatic low-stock export sync from Digital Pantry |
| List item chaos | Drag-and-drop item reordering with backend position persistence |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy) and Pantry REST client.
- **Frontend:** Next.js 16 (App Router) microfrontend, TanStack Query, Tailwind CSS v4, and `@alfheim/shared`.
- **Database:** Dedicated PostgreSQL 16 container (`shopping-db`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `shopping-db` | 5432 | `5433:5432` | PostgreSQL 16 Database |
| `shopping-backend` | 8000 | `/shopping/api/v1` | FastAPI REST API & Pantry Sync |
| `shopping-frontend` | 3010 | `alfheim.loegien.localhost/shopping` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@shopping-db:5432/shopping` | Async PostgreSQL connection string |
| `PANTRY_API_URL` | `http://pantry-backend:8000/api/v1` | Internal Pantry service endpoint |
| `NEXT_PUBLIC_SHOPPING_API_URL` | `http://api.alfheim.loegien.localhost/shopping/api/v1` | Browser API gateway endpoint |

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
pnpm dev --port 3010
```

---

## 🔑 Domain Features & Auto-Provisioning Rules

- **Personal List (`is_personal=true`)**: Automatically provisioned per user upon ingress. Private to the user across households. Non-deletable.
- **Household List (`is_default=true`)**: Automatically provisioned per household. Shared among all members. Non-deletable.
- **Backend-Driven Sorting**: Item positioning is tracked via `position` column. Drag-and-drop reordering sends bulk `PATCH /api/v1/shopping-lists/reorder` updates.

---

## 🧪 Testing & Quality Gates

```bash
# Execute Backend Pytest Suite & Coverage
cd backend && uv run pytest --cov

# Execute Frontend Typecheck & Vitest Suite
cd frontend && pnpm check-types && pnpm test
```
