# Workout Tracker Application (`apps/workout/`)

> **TL;DR:** Fitness management, exercise catalog, multi-day split routine planner, live session logger, muscle volume analytics, and FastMCP AI agent tools for Alfheim.

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
| Exercise Catalog & Customization | Taxonomized exercise database with per-user weight defaults & equipment filters |
| Routine Planning | Multi-day split workout plans with relative offset weight calculation engines |
| Active Workout Execution | Live workout logging with set-by-set recording and offline sync support |
| Fitness Analytics | Weekly muscle volume aggregation, streak counters, and household leaderboards |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy), FastMCP AI tools, and OpenTelemetry.
- **Frontend:** Next.js 16 (App Router) microfrontend, TanStack Query, Tailwind CSS v4, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_workout` database, owned by `workout_user`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `workout-backend` | 8000 | `/workout/api/v1` | FastAPI REST API & FastMCP Tools |
| `workout-frontend` | 3000 | `alfheim.loegien.localhost/workout` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://workout_user:postgres@postgres-core:5432/alfheim_workout` | Async PostgreSQL connection string |
| `KEYCLOAK_URL` | `http://zitadel:8080` | Internal IAM endpoint. Legacy variable name; the provider is Zitadel. |
| `NEXT_PUBLIC_WORKOUT_API_URL` | `http://api.alfheim.loegien.localhost/workout/api/v1` | Browser API gateway endpoint |

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

- `equipment`: Gear management scoped by system, household, or user.
- `exercises`: Exercise catalog, muscle taxonomy, per-user default weights and favorites.
- `plans`: Multi-day split routines with a relative weight engine (`absolute`, `default`, `offset`).
- `session`: Live workout execution logs, cloned from plan state for historical immutability, plus offline sync endpoints.
- `analytics`: Muscle volume, streak, and household leaderboard read-only aggregations.

---

## 🧪 Testing & Quality Gates

```bash
# Execute Backend Pytest Suite & Coverage
cd backend && uv run pytest --cov

# Execute Frontend Typecheck & Vitest Suite
cd frontend && pnpm check-types && pnpm test
```
