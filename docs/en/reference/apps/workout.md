---
title: "Workout Tracker"
description: "Fitness management, exercise catalog, multi-day split routine planner, live session logger, muscle volume analytics, and FastMCP AI agent tools for Alfheim."
---

> **TL;DR:** Fitness management, exercise catalog, multi-day split routine planner, live session logger, muscle volume analytics, and FastMCP AI agent tools for Alfheim.

Source: [`apps/workout/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/workout)

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
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | Public OIDC issuer; the JWKS URI is resolved from its discovery document |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Base URL of the household membership API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generated secret)* | Shared secret sent as `Authorization: Bearer …` on membership checks. Required; the backend refuses to start without it |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/workout` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

---

## 📁 Domain Features (`src/features/`)

- `equipment`: Gear management scoped by system, household, or user.
- `exercises`: Exercise catalog, muscle taxonomy, per-user default weights and favorites.
- `plans`: Multi-day split routines with a relative weight engine (`absolute`, `default`, `offset`).
- `session`: Live workout execution logs, cloned from plan state for historical immutability, plus offline sync endpoints.
- `analytics`: Muscle volume, streak, and household leaderboard read-only aggregations.

---

## 🔌 MCP Tools

Served at `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`), authenticated the same way
as the REST API. Tools take no `household_id`/`user_id` parameters — they read
`get_mcp_household_context()`.

| Feature | Tools |
| :--- | :--- |
| `agent_tools` (composite) | `get_todays_plan`, `start_workout_session`, `log_completed_set`, `finish_workout_session` |
| `analytics` | `get_muscle_volume`, `get_streaks`, `get_leaderboard` |
| `equipment` | `list_equipment`, `create_equipment`, `update_equipment`, `delete_equipment` |
| `exercises` | `list_exercises`, `create_exercise`, `update_exercise`, `delete_exercise`, `set_exercise_preference`, `favorite_exercise`, `unfavorite_exercise` |
| `plans` | `list_plans`, `get_plan`, `create_plan`, `delete_plan` |
| `session` | `start_session`, `finish_session`, `log_completed_set` |

`agent_tools` composes a session-focused subset for the chat assistant (start a session from
today's plan, log a set, finish it) on top of the per-feature tools.

---

## 🏠 Household Scoping

No `households` table exists locally. `home_id` is the UUID from `X-Household-ID`, confirmed
against `core/household` by `backend_shared.household.require_household` on every route and
every MCP tool. An `X-Household-ID` the caller is not a member of is rejected with
`403 household_forbidden`; a resource that exists but is not visible to the caller's
household/user returns `404`.

---

## ⚠️ Known Issues & Open Follow-Ups

- **Offline sync replays against the household active at flush time, not at log time.** The
  set-logging queue (`apps/workout/frontend/src/features/offline_sync`) persists a set's payload
  to IndexedDB before syncing, but does not capture which household was active when it was
  logged. If the active household changes before the queue flushes, the queued sets sync against
  the *new* household. Avoid switching households with sets still pending (see the sync status
  badge). Tracked as a follow-up for the workout app sprint. See
  [Known Issues](../../explanation/known-issues.md).

---
