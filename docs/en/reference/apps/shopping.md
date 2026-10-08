---
title: "Shopping Checklist"
description: "Collaborative household shopping lists, personal private lists, drag-and-drop list reordering, and Digital Pantry stock export synchronization."
---

> **TL;DR:** Collaborative household shopping lists, personal private lists, drag-and-drop list reordering, and Digital Pantry stock export synchronization.

Source: [`apps/shopping/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/shopping)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Forgotten shopping items | Shared real-time household shopping list |
| Private personal purchases | Protected personal shopping list (`is_personal=true`) per user |
| Pantry stock running low | Automatic low-stock export sync from Digital Pantry |
| List chaos | Drag-and-drop reordering of custom lists with backend position persistence |

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
- **List ordering**: Custom lists (not the personal or household list) have a `position`. Dragging a list tab or sidebar entry sends a bulk `PATCH /api/v1/shopping-lists/reorder`. Items inside a list have no `position` and cannot be reordered.
- **Protected lists**: The UI decides which lists are protected and which is labeled as the personal list only from the `is_personal` and `is_default` flags, never from the list name.

---

## 📦 Stock-in (Einlagern) & Pantry Sync

`POST /api/v1/shopping-lists/{list_id}/sync-to-pantry` sends the completed, unsynced items of a list to Pantry (`POST /api/v1/inventory/bulk-add`) with the caller's bearer token and `X-Household-ID`.

- Items Pantry matches are marked `is_synced` and linked through `product_id`. Every completed item is counted once in the quick-add history.
- Items Pantry cannot match are returned as `unrecognized_items` with a `pantry.error.*` reason (`product_not_found`, `invalid_unit`, `incompatible_units`, `system_location_missing`). The frontend opens the Einlagern dialog for them.
- The optional JSON body `{"item_ids": ["…"]}` retries only those items and does not count the purchase in the history again. The dialog uses it after a catalog entry was created.
- The unit picker stores lower-cased German codes (`stk`, `fl.`, `pkg.`, `pkt.`, `bund`, `dose`, `g`, `kg`, `ml`, `l`). Before sending, the backend maps the codes Pantry's unit registry does not know (`stk`/`bund` to `piece`, `fl.` to `bottle`, `pkg.`/`pkt.` to `pack`, `dose` to `can`). The stored unit does not change. The frontend shows localized labels (`Units` namespace) for the codes; codes without a label are shown as stored.

**Save to catalog** in the dialog runs end to end from the browser: create the Pantry product (`POST /pantry/api/v1/products`, with the item's brand and barcode), rename the shopping item to the catalog name (Pantry matches by barcode or exact name), then retry the sync for that item. A failed step shows its error inside the item's row and the dialog keeps the already created product, so retrying does not create a duplicate.

---

## 🔔 Error Handling in the Frontend

Failed item, list and history requests (and the Pantry sync) are shown as a dismissible notification with a localized message followed by the detail the server returned. A request that never got a response says the service could not be reached. Items that only exist optimistically carry a `temp-` id and cannot be toggled or deleted until the server has confirmed them.

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
- **No item icons**: the backend stores no icon per item, so the manual-item form has no icon picker (#511).
- The target-household picker in the Einlagern dialog can only work for the list's own household (#627), repeated syncs count skipped items in the history again (#628) and a Pantry outage is answered with `400` (#629).
- No known open issues in the Pantry sync path beyond the general household-cache staleness
  documented in [Known Issues](../../explanation/known-issues.md).

---
