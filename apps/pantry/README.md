# Pantry App — Why It Exists

> **This README answers WHY this application exists.** For implementation details, see [`frontend/README.md`](./frontend/README.md) and [`backend/README.md`](./backend/README.md).

---

## 🥫 Purpose

The **Pantry App** (`apps/pantry`) is the household inventory management service for the Loeger-OS monorepo. It solves the problem of **household stock blindness** — the inability to know what you have, what's expiring, and what you need to restock — with a structured, data-driven approach.

---

## 🎯 Core Value Proposition

| Problem | Solution |
| :--- | :--- |
| Don't know what's in the pantry | Real-time inventory state with location-aware batch tracking |
| Food expires unnoticed | Expiration date tracking with urgency-sorted alerts feed |
| Restocking is reactive, not proactive | Minimum stock quotas → automatic shopping list sync |
| No visibility on consumption patterns | Monthly consumption analytics (OUT/WASTE movements) |
| Inventory spread across multiple locations | Multi-location storage layout with per-location alarm badges |

---

## 🏗️ Architecture Overview

```
apps/pantry/
├── backend/          # FastAPI service (inventory state, transactions, products, locations)
├── frontend/         # Next.js 15 App Router (inventory table, dashboard, analytics)
└── compose.yml       # Service orchestration (backend, frontend, postgres, traefik labels)
```

The app follows the **Feature-Driven Design (FDD)** pattern defined in `.ai/rules/architecture.md`.

---

## 🔗 Integration Points

- **Keycloak OIDC**: JWT authentication. `household_id` claim scopes all data to the active household.
- **Shopping App**: Low-stock items are exported cross-service via `pushLowStockToShoppingApp()`.
- **Traefik**: Ingress at `/pantry` (frontend) and `/api/v1/pantry` (backend).

---

## 🔑 Key Concepts

- **Product Blueprint** (`products`): The master data definition (name, brand, barcode, base unit, min stock). Global templates + custom household entries.
- **Inventory State** (`inventory_states`): The live stock quantity for a `(product, location, batch_code)` tuple.
- **Transaction** (`inventory_transactions`): Immutable ledger entries recording every IN/OUT/WASTE movement.
- **Location** (`locations`): Physical or virtual storage zones (e.g. `Fridge`, `Pantry Cabinet`, `Backlog`).
