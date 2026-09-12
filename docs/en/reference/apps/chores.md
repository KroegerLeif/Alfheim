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
| `NEXT_PUBLIC_CHORES_API_URL` | `http://api.alfheim.loegien.localhost/api/v1/chores` | Browser API gateway endpoint |

---

## 🔑 Domain Model & Key Concepts

- **Chore Template** (`chore_templates`): The blueprint config for a chore (name, instructions, points, recurrence properties).
- **Chore Instance** (`chore_instances`): A scheduled copy of a chore assigned to a specific day.
- **Completion History** (`chore_completion_history`): Immutable audit timeline recording every instance completion event.
- **Household Streak** (`household_streaks`): Cumulative day counter incremented upon completing scheduled chores by midnight.

---
