# Workout Tracker Application (`apps/workout/`)

> **TL;DR:** Fitness management, exercise catalog, multi-day split routine planner, live session logger, muscle volume analytics, and FastMCP AI agent tools for Alfheim.

📖 **Full specification** — purpose, architecture, ingress routing, environment
variables and domain model — lives in the documentation portal:
[Reference → Workout Tracker](../../docs/en/reference/apps/workout.md)

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

## 🔁 Session & offline-sync behaviour

- `POST /api/v1/sessions/{id}/sets/sync` fills the set cloned from the plan day for that slot, and
  answers `409 session_not_active` when the session is already completed or abandoned.
- The browser queue persists sets in IndexedDB, syncs in the background, warns about sets it had to
  drop, and refuses to finish a session while sets are still queued.

Details: [Reference → Workout Tracker](../../docs/en/reference/apps/workout.md).

---

## 🧪 Testing & Quality Gates

```bash
# Execute Backend Pytest Suite & Coverage
cd backend && uv run pytest --cov

# Execute Frontend Typecheck & Vitest Suite (add --coverage for the report)
cd frontend && pnpm exec tsc --noEmit && pnpm test

# Monorepo gates (from the repository root)
./scripts/verify.sh --python --frontend
```
