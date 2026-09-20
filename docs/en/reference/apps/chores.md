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

### FDD Domain Features (`src/features/chores/`)
- `templates`: Chore templates (points, instructions, recurrence rules).
- `instances`: Scheduled daily chore instances tracking execution status.
- `streaks`: Household streak engine tracking consecutive days of 100% completion.
- `history`: Immutable completion audit timeline (timestamp, user, points awarded).

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

- **Chore Template** (`chore_templates`): The blueprint config for a chore (name, instructions, points, recurrence properties).
- **Chore Instance** (`chore_instances`): A scheduled copy of a chore assigned to a specific day.
- **Completion History** (`chore_completion_history`): Immutable audit timeline recording every instance completion event.
- **Household Streak** (`household_streaks`): Cumulative day counter incremented upon completing scheduled chores by midnight.

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

## 🏠 Household Scoping

Every route depends on `backend_shared.household.require_household` (any member role may read and
write). The daily reset (streak increment or reset to 0) runs retroactively and self-heals on the
first access of a household's chores list for that day if the system was offline. See
[ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Known Issues & Open Follow-Ups

No known open issues beyond the general household-authorization items in
[Known Issues](../../explanation/known-issues.md).

---
