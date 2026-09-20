---
title: "Shopping Checklist"
description: "Collaborative household shopping lists, personal private lists, drag-and-drop item reordering, and Digital Pantry stock export synchronization."
---

> **TL;DR:** Collaborative household shopping lists, personal private lists, drag-and-drop item reordering, and Digital Pantry stock export synchronization.

Source: [`apps/shopping/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/shopping)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Forgotten shopping items | Shared real-time household shopping list |
| Private personal purchases | Protected personal shopping list (`is_personal=true`) per user |
| Pantry stock running low | Automatic low-stock export sync from Digital Pantry |
| List item chaos | Drag-and-drop item reordering with backend position persistence |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy) and Pantry REST client.
- **Frontend:** Next.js 16 (App Router) microfrontend, TanStack Query, Tailwind CSS v4, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_shopping` database, owned by `shopping_user`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `shopping-backend` | 8000 | `/shopping/api/v1` | FastAPI REST API & Pantry Sync |
| `shopping-frontend` | 3010 | `alfheim.loegien.localhost/shopping` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://shopping_user:postgres@postgres-core:5432/alfheim_shopping` | Async PostgreSQL connection string |
| `PANTRY_API_URL` | `http://pantry-backend:8000/api/v1` | Internal Pantry service endpoint |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Base URL of the household membership API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generated secret)* | Shared secret sent as `Authorization: Bearer …` on membership checks. Required; the backend refuses to start without it |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/shopping/api/v1` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

---

## 🔑 Domain Features & Auto-Provisioning Rules

- **Personal List (`is_personal=true`)**: Automatically provisioned per user upon ingress. Private to the user across households. Non-deletable.
- **Household List (`is_default=true`)**: Automatically provisioned per household. Shared among all members. Non-deletable.
- **Backend-Driven Sorting**: Item positioning is tracked via `position` column. Drag-and-drop reordering sends bulk `PATCH /api/v1/shopping-lists/reorder` updates.

---

## 🔌 MCP Tools

Shopping has no FastMCP server and exposes no MCP tools. The chat assistant cannot read or
modify shopping lists directly.

---

## 🏠 Household Scoping

Every route depends on `backend_shared.household.require_household`, which confirms
`X-Household-ID` against `core/household` (any member role may read and write; there is no
`require_role` gate in this app). Households for the household switcher come from
`GET /api/v1/households/me` on `core/household`, not from a local table. See
[ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Known Issues & Open Follow-Ups

- **`GET /api/v1/shopping-lists` has a side effect**: the first call for a given household/user
  creates that household's default list and the caller's personal list if they do not exist yet
  (`ensure_household_list` / `ensure_personal_list` in `ListManagementService`). This is
  intentional (the UI always has a list to add items to), but it means a plain `GET` is not
  idempotent-safe to call from scripts expecting a read-only endpoint. See
  [Known Issues](../../explanation/known-issues.md).
- **502 on Proxmox**: `shopping-frontend` has been observed returning `502` behind Caddy on
  Proxmox VE installs. Suspected but unconfirmed cause: an OOM kill under load — `compose.prod.yaml`
  caps every frontend (not just shopping) at `memory: 128m`, which may be tight for Next.js under
  Proxmox's virtualized overhead. Open follow-up for the shopping app sprint.
- No known open issues in the Pantry sync path beyond the general household-cache staleness
  documented in [Known Issues](../../explanation/known-issues.md).

---
