---
title: "Digital Pantry"
description: "Multi-tenant household inventory, stock tracking, expiration alert, and barcode lookup service for Alfheim."
---

> **TL;DR:** Multi-tenant household inventory, stock tracking, expiration alert, and barcode lookup service for Alfheim.

Source: [`apps/pantry/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/pantry)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Don't know what's in the pantry | Real-time stock tracking with location-aware batch management |
| Food expires unnoticed | Expiration date tracking with urgency-sorted alerts feed |
| Restocking is reactive | Minimum stock quotas with automatic shopping list sync |
| No consumption visibility | Monthly consumption analytics (OUT/WASTE movements) |
| Multiple storage areas | Multi-location storage layout (Fridge, Cabinet, Backlog) |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy), Pint unit conversion, and FastMCP AI tools.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_pantry` database, owned by `pantry_user`).

### FDD Domain Features (`src/features/`)
- `locations`: Physical and virtual storage places (Cabinet, Fridge, Pantry). System default locations (Backlog) are protected against accidental deletion.
- `categories`: Tag classification groups for products.
- `products`: Master product blueprints (EAN/UPC barcode lookup, brand, base unit). Barcoded items promote to global system templates. Open Food Facts API integration.
- `inventory`: Stock ledger transactions (IN, OUT, WASTE) and live inventory state cache. Enforces ACID safety write locks (`SELECT FOR UPDATE`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `pantry-backend` | 8000 | `/pantry/api/v1` | FastAPI REST API & FastMCP Server |
| `pantry-frontend` | 3000 | `alfheim.loegien.localhost/pantry` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://pantry_user:postgres@postgres-core:5432/alfheim_pantry` | Async PostgreSQL connection string |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | OIDC provider issuer URL |
| `OIDC_AUDIENCE` | `alfheim` | Target OIDC audience claim |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Base URL of the household membership API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generated secret)* | Shared secret sent as `Authorization: Bearer …` on membership checks. Required; the backend refuses to start without it |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/pantry/api/v1` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

---

## 🔑 Domain Model & Key Concepts

- **Product Blueprint** (`products`): Master data definition (name, brand, barcode, base unit, min stock quota).
- **Inventory State** (`inventory_states`): Live stock cache for a `(product, location, batch_code)` tuple.
- **Transaction Ledger** (`inventory_transactions`): Immutable audit log recording every IN, OUT, and WASTE stock movement.

---

## 🔌 MCP Tools

Served at `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`), authenticated the same way as
the REST API. Tools take no `household_id`/`user_id` parameters — they read
`get_mcp_household_context()`.

| Feature | Tools |
| :--- | :--- |
| `products` | `list_products`, `get_product`, `get_product_by_barcode`, `create_product`, `update_product`, `delete_product`, `get_product_nutrition`, `update_product_nutrition` |
| `locations` | `list_locations`, `get_location`, `create_location`, `update_location`, `delete_location` |
| `inventory` | `record_inventory_movement`, `get_current_inventory`, `get_low_stock_alerts`, `get_inventory_expiration_summary` |
| `categories` | `list_categories`, `get_category`, `create_category`, `update_category`, `delete_category` |

---

## 🏠 Household Scoping

Every route depends on `backend_shared.household.require_household` (any member role may read and
write). Global products with a valid EAN/UPC barcode are shared across households
(`is_global = True`) rather than household-scoped. See
[ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Known Issues & Open Follow-Ups

No known open issues beyond the general household-authorization items in
[Known Issues](../../explanation/known-issues.md).

---
