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

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy), FastMCP AI tools, and background reset scheduler loop.
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
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
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
- **Chore Instance** (`chore_instances`): One template on one `due_date`, with a `status` of `pending`, `completed` or `missed`, an optional `assigned_to` and the completion fields. At most one instance exists per template and day.
- **Completion History** (`chore_completion_history`): Immutable audit timeline recording every completion (user, display name, points awarded).
- **Household Streak** (`household_streaks`): One row per household with `current_streak`, `longest_streak` and `last_completed_date`.

---

## 🔁 Daily Scheduling & Reset

Chores always repeat daily; the only per-template switch is `is_non_cumulative`.

- **Generation:** `ensure_household_reset` creates a `pending` instance for every template that has none for the day. It runs on the first read of a household's chores for that day (`GET /api/v1/chores/today`, `GET /api/v1/chores/integrations/summary`, the MCP tools) and again from the nightly scheduler in `src/main.py`, which fires at 00:00:05 server-local time for every household that has templates or a streak. It is idempotent, so a template created later in the day still gets its instance.
- **Non-cumulative templates (default):** an unfinished instance of the previous day is marked `missed`, a fresh `pending` instance is generated, and the household streak is reset to 0.
- **Cumulative templates:** an unfinished instance is not marked missed. It rolls forward (its `due_date` becomes today) and keeps stacking until someone completes it. On its own it does not reset the streak.
- **Streak:** the streak grows by one when every instance of a day is completed, either when the last one is completed or at the next day's reset. A gap of more than one day without any instances resets it to 0. Skipped days are not backfilled.
- **Assigning and claiming:** anyone can claim an unassigned chore for themselves or release their own claim. Assigning it to another member requires the `OWNER` or `ADMIN` household role and a member target. A completed or missed instance cannot be reassigned.
- **Completing:** the recorded user is always the authenticated caller; only the display name may be supplied by the client.

---

## 🔌 MCP Tools

Served at `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`), authenticated the same way as
the REST API. Tools take no `household_id`/`user_id` parameters — they read
`get_mcp_household_context()`.

| Feature | Tools |
| :--- | :--- |
| `chore_management` | `get_daily_chores_overview`, `complete_chore_by_name`, `assign_chore` |

The client-supplied `completed_by` field was removed from chore completion; the authenticated
caller is always the one recorded.

---

## 🔗 Dashboard Integrations

The dashboard shows two cards that read other apps from the browser, with the caller's bearer token and `X-Household-ID`: pending shopping items (`GET /shopping/api/v1/shopping-lists`) and due maintenance steps (`GET /maintenance/api/v1/maintenance/summary`). Both go through the other app's own ingress prefix: the bare `/api/v1/<app>*` rules in Caddy strip the prefix and leave a suffix no backend serves (`/api/v1/shopping-lists` becomes `/api/v1-lists`). A card whose request fails shows an "unavailable" badge instead of "connected". Completing, claiming or deleting a chore shows the server's message when the request fails.

---

## 🏠 Household Scoping

Every route depends on `backend_shared.household.require_household` (any member role may read and
write). The daily reset (streak increment or reset to 0) runs retroactively and self-heals on the
first access of a household's chores list for that day if the system was offline. See
[ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Known Issues & Open Follow-Ups

No known open issues beyond the general household-authorization items in
[Known Issues](../../explanation/known-issues.md).

- **Assignments are not reconciled after membership changes (#581).** A chore keeps its assignee after that person leaves the household. Role changes do not matter: claiming and completing are open to every member role. Reconciling needs to resolve the stored (derived) user id against the household's member list; `GET /internal/v1/households/{householdId}/members` exists, but `backend_shared` has no client for it yet (#583).

---
