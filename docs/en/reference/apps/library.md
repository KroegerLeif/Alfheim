---
title: "Media & Library Hub"
description: "Digital media catalog, loan management, external metadata lookup, game manual storage, and streaming subscription tracking for Alfheim."
---

> **TL;DR:** Digital media catalog, loan management, external metadata lookup, game manual storage, and streaming subscription tracking for Alfheim.

Source: [`apps/library/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/library)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Media Tracking | Unified item catalog (books, movies, board games, …) with per-household locations |
| Borrowing & Lending | Loan tracker for items lent to friends or borrowed from libraries |
| Metadata Lookup | External lookups by ISBN, BoardGameGeek and TMDB to pre-fill catalog entries |
| Game Manuals | PDF manual upload, presigned download URLs and deletion, backed by RustFS S3 |
| Streaming Subscriptions | Track which streaming providers the household subscribes to |

> **Note:** Earlier drafts of this page described a reading-progress log and a household
> wishlist. Neither exists in the code (no `progress` or `wishlist` route, service or frontend
> feature) — they are aspirational, not implemented. Remove this note once one of them ships, or
> file them as follow-ups for the library app sprint instead.

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy) and OpenLibrary API client.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_library` database, owned by `library_user`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `library-backend` | 8000 | `/library/api/v1` | FastAPI REST API |
| `library-frontend` | 3000 | `alfheim.loegien.localhost/library` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://library_user:postgres@postgres-core:5432/alfheim_library` | Async PostgreSQL connection string |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | Generic OIDC backend auth issuer URL |
| `OIDC_AUDIENCE` | `alfheim` | Expected OIDC JWT audience claim |
| `NEXT_PUBLIC_OIDC_ISSUER` | `http://auth.alfheim.loegien.localhost` | Browser OIDC auth issuer URL |
| `NEXT_PUBLIC_OIDC_CLIENT_ID` | `library-frontend` | Browser OIDC client identifier |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Base URL of the household membership API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generated secret)* | Shared secret sent as `Authorization: Bearer …` on membership checks. Required; the backend refuses to start without it |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/library` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

---

## 📁 API Modules (`src/api/v1/`)

Library does not follow the `src/features/<domain>/` FDD layout other apps use; its routes are
organized by API module instead:

- `items`: Media item catalog CRUD.
- `lending`: Loan tracking for items borrowed from external libraries or lent to friends.
- `locations`: Per-household storage locations for physical media.
- `lookup`: External metadata lookup by ISBN, BoardGameGeek (`bgg`) and TMDB, used to pre-fill a
  new catalog entry.
- `manuals`: Game manual PDF upload, presigned download URL retrieval and deletion (RustFS S3,
  `ManualStorageService`).
- `providers`: Streaming provider subscription tracking.
- `search`: Cross-catalog search.

---

## 🔌 MCP Tools

Served at `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`). Currently a single placeholder
tool, not a catalog integration:

| Feature | Tools |
| :--- | :--- |
| `mcp/server` | `get_library_status` (returns a static "Library backend is running." string) |

The chat assistant cannot yet read or modify the media catalog through MCP — wiring real
catalog/lending tools is an open follow-up for the library app sprint.

---

## 🏠 Household Scoping

Every route depends on `backend_shared.household.require_household` (any member role may read and
write). See
[ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Known Issues & Open Follow-Ups

- **No reading-progress or wishlist feature**: earlier documentation described both; neither is
  implemented (see the note under Purpose & Core Value above). Candidates for the library app
  sprint if still wanted.
- **MCP tools are a placeholder**: `get_library_status` is the only tool; the catalog, lending and
  lookup features have no MCP integration yet.
- No other known open issues beyond the general household-authorization items in
  [Known Issues](../../explanation/known-issues.md).

---
