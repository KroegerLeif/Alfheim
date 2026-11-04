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
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/workout/api/v1` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

---

## 📁 Domain Features (`src/features/`)

- `equipment`: Gear management scoped by system, household, or user.
- `exercises`: Exercise catalog, muscle taxonomy, per-user default weights and favorites.
- `plans`: Multi-day split routines with a relative weight engine (`absolute`, `default`, `offset`).
- `session`: Live workout execution logs, cloned from plan state for historical immutability, plus offline sync endpoints.
- `analytics`: Muscle volume, streak, and household leaderboard read-only aggregations.

---

## 🔁 Session Lifecycle & Offline Sync

A session is `active` until it is completed (`POST /sessions/{id}/complete`) or abandoned
(`POST /sessions/{id}/abandon`); both transitions are one-way. Starting a session from a plan
clones one day (`plan_id` + `plan_day_id`); the plan cards in the UI offer a start button per day.

`POST /sessions/{id}/sets/sync` upserts a batch of sets by `client_idempotency_key`:

- A set for a slot cloned from the plan day (same `session_exercise_id` and `set_order`, not yet
  performed) fills that row; otherwise a new row is inserted. Replaying a key returns the stored
  row without a duplicate.
- Items whose `session_exercise_id` is not on the session are skipped (not acknowledged).
- A batch that would add a set to a completed or abandoned session is rejected with
  `409` and `{"detail": {"code": "session_not_active", "message": "..."}}`. Keys that are already
  stored are still acknowledged. The `log_completed_set` MCP tool returns the same message as an
  `Error:` string.

The browser queue (`features/offline_sync`) stores every logged set in IndexedDB first and syncs in
the background, one request per session, with flushes serialized. Entries are dropped after five
failed flushes or at once on `session_not_active`; dropped sets raise a dismissible warning in the
sync badge and are offered again in the HUD. Finishing a session is refused while sets are still
queued; abandoning flushes the queue first and discards what could not be delivered.

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

## 🗄️ Data Model Invariants

No `households` table exists. `home_id` is the UUID from the `X-Household-ID` header, confirmed with `core/household` by `require_household`, as in Pantry and Chores.

### Tables `equipment`, `exercises`

- A `scope` enum (`system`, `household`, `user`) scopes each row. `home_id` and `owner_user_id` are nullable and set only for the matching scope. System rows are seeded at test and startup time and are read-only through the API.
- `user_exercise_preferences` (unique on `user_id` + `exercise_id`) holds each user's baseline weight, read by the weight engine. `exercise_favorites` (unique on `user_id` + `exercise_id`) is a plain on/off join.

### Tables `plans`, `plan_days`, `plan_exercises`, `plan_sets`

- `plans.is_shared` controls household-wide visibility. Only the owner may write, even to a shared plan.
- `plan_sets.target_weight_type` (`absolute`, `default`, `offset`) drives the relative weight engine; see `plans/services/weight_engine_service.py::resolve_target_weight`.

### Tables `workout_sessions`, `session_exercises`, `session_sets`

- A session is a structural clone of the plan at session start, never a live foreign key into `plan_exercises` or `plan_sets`, so editing or deleting a plan never rewrites a past session. `session_sets.target_weight_kg` stores the resolved weight-engine number, not the type and offset.
- `session_sets` has a partial unique index on (`session_exercise_id`, `client_idempotency_key`) where the key is not null; it backs the offline-sync endpoint `POST /sessions/{id}/sets/sync`. The sync fills the cloned `session_sets` row of the same slot (`set_order`, not yet completed) instead of inserting a duplicate, and answers `409 session_not_active` for a completed or abandoned session (replaying stored keys is still acknowledged).

### Invariants

1. **MCP tenancy**: MCP tools (per feature and the composite `agent_tools` slice) take no `household_id` or `user_id` parameters. They read both from `get_mcp_household_context()` and apply the same service-layer filtering as the REST routes.
2. **403 vs 404**: an `X-Household-ID` the caller is not a member of is rejected by the auth dependency with `403 household_forbidden` (see `backend_shared.household`). A resource that exists but is not visible to the caller's household or user returns 404 at the resource layer.
3. **Alembic migrations**: every Python backend runs `alembic upgrade head` at startup under a Postgres advisory lock (`run_migrations`); `create_all` is not used in production. See [Schema migrations](../../explanation/schema-migrations.md).

---

## ⚠️ Known Issues & Open Follow-Ups

- **Offline sync replays against the household active at flush time, not at log time.** The
  set-logging queue (`apps/workout/frontend/src/features/offline_sync`) persists a set's payload
  to IndexedDB before syncing, but does not capture which household was active when it was
  logged. If the active household changes before the queue flushes, the queued sets sync against
  the *new* household. Avoid switching households with sets still pending (see the sync status
  badge). Tracked as a follow-up for the workout app sprint. See
  [Known Issues](../../explanation/known-issues.md).
- **`preferred_unit` has no effect.** It is stored and returned by the API and the MCP tools, but
  the UI always logs and shows kilograms (#568).
- **The leaderboard shows truncated user ids**, because the backend returns no display names (#612).
- **Exercises and equipment cannot be edited in the UI**, although `PATCH` exists (#613).

---
