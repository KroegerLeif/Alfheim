# Workout Tracker Application (`apps/workout/`)

The **Workout Tracker App** is the fitness, exercise catalog, and routine execution service for the Alfheim monorepo. It manages exercise taxonomies, multi-day split routines, live workout session logging, muscle volume analytics, and FastMCP AI agent tools.

---

## 🎯 Purpose & Value Proposition

| Need | Solution |
| :--- | :--- |
| Exercise Catalog & Customization | Taxonomized exercise database with per-user weight defaults & equipment filters |
| Routine Planning | Split workout plans with relative offset weight calculation engines |
| Active Workout Execution | Live workout logging with offline sync support and set-by-set recording |
| Fitness Analytics | Weekly muscle volume aggregation, streak counters, and household leaderboards |

---

## 🏗️ Architecture Overview

```
apps/workout/
├── backend/          # FastAPI service + FastMCP server (Equipment, Exercises, Plans, Sessions, Analytics)
├── frontend/         # Next.js 16 MFE (Port 3000, routed at /workout)
└── compose.yml       # Orchestration container definitions (workout-db, workout-backend, workout-frontend)
```

---

## 🌐 Ingress Routing & Ports

| Service | Internal Port | Host Mapping / Gateway Route | Protocol / Description |
| :--- | :--- | :--- | :--- |
| `workout-db` | 5432 | `5434:5432` | PostgreSQL 16 database |
| `workout-backend` | 8000 | `/workout/api/v1` or `/api/v1/workout` | FastAPI REST API & FastMCP tool server |
| `workout-frontend` | 3000 | `alfheim.loegien.localhost/workout` | Next.js MFE |

---

## 🔑 Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (`postgresql+asyncpg://postgres:postgres@workout-db:5432/workout`).
- `KEYCLOAK_URL`: Internal Keycloak auth server URL (`http://keycloak:8080/auth`).
- `NEXT_PUBLIC_WORKOUT_API_URL`: Browser-facing API endpoint (`http://api.alfheim.loegien.localhost/workout/api/v1`).

---

## 🚀 Local Run & Test Commands

### Run via Docker Compose
```bash
docker compose up -d
```

### Backend Development & Testing
```bash
cd apps/workout/backend
uv sync
uv run uvicorn src.main:app --reload --port 8000
PYTHONPATH=. uv run pytest --cov
```

### Frontend Development & Testing
```bash
cd apps/workout/frontend
pnpm install
pnpm dev
pnpm test
```
