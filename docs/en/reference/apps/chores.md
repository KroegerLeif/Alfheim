---
title: "Household Chores"
description: "Gamified household chore assignment, habit-building, streak counter, points tracking, and completion audit history service for Alfheim."
---

> **TL;DR:** Gamified household chore assignment, habit-building, streak counter, points tracking, and completion audit history service for Alfheim.

Source: [`apps/chores/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/chores)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Chore ownership is ambiguous | Assignable daily chore instances with clear responsibility boundaries |
| Chores stack up when neglected | Non-cumulative reset scheduler that expires missed tasks nightly |
| Lack of incentive to clean | Points-based reward system with real-time feedback loops |
| Household consistency is hard | Streak counters tracking consecutive days of full chore completion |
| Lack of completion audit history | Immutable completion history timeline recording every execution |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.14 / FastAPI microservice with SQLModel (async SQLAlchemy), FastMCP AI tools, and background reset scheduler loop.
- **Frontend:** Next.js 16 (App Router) microfrontend, TanStack Query, Tailwind CSS v4, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_chores` database, owned by `chores_user`).

### FDD Domain Features (`src/features/chore_management/`)

The backend has one feature directory, `chore_management`, that owns the whole domain:

- `models.py`, `schemas.py`, `router.py`, `mcp_tools.py` and `exceptions.py`: tables, DTOs, the REST routes under `/api/v1/chores`, the MCP tools and the domain errors.
- `service.py`: a thin `ChoreService` facade that delegates to the sub-services in `services/`.
- `services/template_service.py`: chore template CRUD with a per-household unique name.
- `services/instance_service.py`: daily instance generation and reset, assign, claim, complete, task timeline and the integration summary.
- `services/streak_service.py`: get-or-create of the household streak row.

There is no recurrence or schedule configuration. Every template produces exactly one instance
per day (see [Daily Scheduling & Reset](#-daily-scheduling--reset)).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 18 Core Database Server |
| `chores-backend` | 8000 | `/api/v1/chores` | FastAPI REST API & FastMCP Tools |
| `chores-frontend` | 3000 | `alfheim.loegien.localhost/chores` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://chores_user:postgres@postgres-core:5432/alfheim_chores` | Async PostgreSQL connection string |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | Generic OIDC authentication issuer URL |
| `OIDC_AUDIENCE` | `alfheim` | Expected OIDC audience |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Base URL of the household membership API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generated secret)* | Shared secret sent as `Authorization: Bearer …` on membership checks. Required; the backend refuses to start without it |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/chores` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

---

## 🔑 Domain Model & Key Concepts

- **Chore Template** (`chore_templates`): The blueprint of a chore: `name` (unique per household), optional `description`, `points` (default 10) and `is_non_cumulative` (default `true`). It carries no recurrence field.
- **Chore Instance** (`chore_instances`): One template on one `due_date`, with a `status` of `pending`, `completed` or `missed`, an optional `assigned_to` and the completion fields. The schedule creates at most one instance per template and day; one-off instances (`is_one_off`) come on top.
- **One-off instance:** `POST /api/v1/chores/instances` creates one `pending` instance of a template now, for example when Home Assistant reports that the washing machine finished. It does not change the template or its schedule.
- **Completion History** (`chore_completion_history`): Immutable audit timeline recording every completion (user, display name, points awarded).
- **Household Streak** (`household_streaks`): One row per household with `current_streak`, `longest_streak` and `last_completed_date`.

---

## 🔁 Daily Scheduling & Reset

Chores always repeat daily; the only per-template switch is `is_non_cumulative`.

- **Generation:** `ensure_household_reset` creates a `pending` instance for every template that has none for the day. It runs on the first read of a household's chores for that day (`GET /api/v1/chores/today`, `GET /api/v1/chores/integrations/summary`, the MCP tools) and again from the nightly scheduler in `src/main.py`, which fires at 00:00:05 server-local time for every household that has templates or a streak. It is idempotent, so a template created later in the day still gets its instance.
- **Non-cumulative templates (default):** an unfinished instance of the previous day is marked `missed`, a fresh `pending` instance is generated, and the household streak is reset to 0.
- **Cumulative templates:** an unfinished instance is not marked missed. It rolls forward (its `due_date` becomes today) and keeps stacking until someone completes it. On its own it does not reset the streak.
- **Streak:** the streak grows by one when every instance of a day is completed, either when the last one is completed or at the next day's reset. A gap of more than one day without any instances resets it to 0. Skipped days are not backfilled.
- **Assigning and claiming:** anyone can claim an unassigned chore for themselves or release their own claim. Assigning it to another member requires the `OWNER` or `ADMIN` household role and a target whose user id belongs to a member of the household (matched against the household app's member list, so members with non-UUID subjects work too); a read-only `GUEST` cannot be assigned (`422`). A completed or missed instance cannot be reassigned.
- **One-off instances:** the reset ignores them when it decides whether a day was already processed and which templates still need their scheduled instance. An unfinished one-off of the previous day is treated like any other instance of its template (marked `missed` or rolled forward).
- **Reconciling assignments:** `GET /api/v1/chores/today` releases pending chores whose assignee left the household or became a `GUEST`. Completed and missed chores keep their assignee as history. When the member list cannot be read, the chores are returned as stored.
- **Completing:** the recorded user is always the authenticated caller; only the display name may be supplied by the client.

---

## 🔌 MCP Tools

Served at `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`), authenticated the same way as
the REST API. Tools take no `household_id`/`user_id` parameters — they read
`get_mcp_household_context()`.

| Feature | Tools |
| :--- | :--- |
| `chore_management` | `get_daily_chores_overview`, `complete_chore_by_name`, `assign_chore`, `create_chore_instance` |

The client-supplied `completed_by` field was removed from chore completion; the authenticated
caller is always the one recorded.

---

## 🔗 Dashboard Integrations

The dashboard shows two cards that read other apps from the browser, with the caller's bearer token and `X-Household-ID`: pending shopping items (`GET /shopping/api/v1/shopping-lists`) and due maintenance steps (`GET /maintenance/api/v1/maintenance/summary`). Both go through the other app's own ingress prefix: the bare `/api/v1/<app>*` rules in Caddy strip the prefix and leave a suffix no backend serves (`/api/v1/shopping-lists` becomes `/api/v1-lists`). A card whose request fails shows an "unavailable" badge instead of "connected". Completing, claiming or deleting a chore shows the server's message when the request fails.

---

## ➕ One-Off Instances

```text
POST /api/v1/chores/instances
Idempotency-Key: <optional, 1-200 printable ASCII characters>
{"template_id": "<uuid>", "due_at": "YYYY-MM-DD (optional, default today)", "assignee_id": "<user uuid, optional>"}
```

| Status | Meaning |
| :--- | :--- |
| `201` | Created; the body is the instance (`is_one_off: true`) |
| `200` | The household already used this `Idempotency-Key`; the stored instance is returned unchanged |
| `400` | Malformed `Idempotency-Key` |
| `403` | `GUEST`, a member assigning someone else without `OWNER`/`ADMIN`, or a service principal without the scope |
| `404` | The template is not the household's, or the assignee is not a member |
| `409` | The `Idempotency-Key` was used for another template |
| `422` | The assignee is a read-only `GUEST` |

Callers are members with `OWNER`, `ADMIN` or `MEMBER`, and [household-bound service principals](../../explanation/authentication-security.md#household-bound-service-principals) whose binding grants `chores:create_instance`. A service principal may assign the chore to any member who can act on chores. The MCP tool `create_chore_instance(template_id, due_date?, assignee_user_id?)` does the same for members, without an idempotency key.

---

## 🏠 Household Scoping

Every route depends on `backend_shared.household.require_household` (any member role may read and
write); `POST /instances` uses `require_household_access` so that a service principal with the
`chores:create_instance` scope is admitted too. The daily reset (streak increment or reset to 0) runs retroactively and self-heals on the
first access of a household's chores list for that day if the system was offline. See
[ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## 🗄️ Data Model Invariants

### Table `chore_templates`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID, PK | |
| `home_id` | UUID, NOT NULL, indexed | Active household |
| `name` | VARCHAR(150), NOT NULL | |
| `description` | VARCHAR(500), nullable | |
| `points` | INTEGER, NOT NULL, default `10` | |
| `is_non_cumulative` | BOOLEAN, NOT NULL, default `true` | |

### Table `chore_instances`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID, PK | |
| `template_id` | UUID, FK → `chore_templates.id`, NOT NULL | |
| `home_id` | UUID, NOT NULL, indexed | |
| `assigned_to`, `completed_by` | UUID, nullable | |
| `completed_at` | TIMESTAMPTZ, nullable | |
| `due_date` | DATE, NOT NULL, indexed | |
| `status` | VARCHAR(20), NOT NULL, default `pending` | `pending`, `completed` or `missed` |
| `points_awarded` | INTEGER, NOT NULL, default `0` | |
| `is_one_off` | BOOLEAN, NOT NULL, default `false` | `true` for an instance from `POST /instances` |
| `idempotency_key` | VARCHAR(200), nullable | Unique per household with `home_id` (`uq_chore_instance_idempotency_key`) |

### Table `household_streaks`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID, PK | |
| `home_id` | UUID, NOT NULL, unique, indexed | |
| `current_streak`, `longest_streak` | INTEGER, NOT NULL, default `0` | |
| `last_completed_date` | DATE, nullable | |

Invariants:

1. **Name uniqueness**: template names are unique within a household (index `uq_chore_template_name_per_home`).
2. **Instance uniqueness**: the schedule creates at most one instance per template and date (index `uq_chore_instance_template_per_date`); one-off instances are not counted. A household's `Idempotency-Key` maps to at most one instance (`uq_chore_instance_idempotency_key`).
3. **Streak integrity**: the streak grows when every scheduled chore of a day is completed. Any chore left open is marked `missed` and the streak resets to 0 during the daily reset.
4. **Self-healing reset**: if the system was offline, the daily reset runs retroactively on the first access to a household's chores for that day.

---

## ⚠️ Known Issues & Open Follow-Ups

No known open issues beyond the general household-authorization items in
[Known Issues](../../explanation/known-issues.md).

---
