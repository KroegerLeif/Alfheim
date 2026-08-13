# Shopping Checklist Application (`apps/shopping/`)

This directory houses the digital **Shopping Checklist Application** for the `alfheim` smart home ecosystem. It consists of a FastAPI backend and a Next.js frontend, integrated with Keycloak for identity management and the Pantry service for stock synchronization.

---

## 🏗️ High-Level Architecture & *Why*

The Shopping app is built around the **Feature-Driven Design (FDD)** paradigm. It decomposes logic by domain (checklists, history) rather than technical layers.

```mermaid
graph TD
  A["Next.js Frontend (Port 3010)"] <-->|REST API + JWT Auth| B["FastAPI Backend (Port 8000)"]
  A <-->|OIDC Sessions| C["Keycloak IAM (alfheim/auth)"]
  B <-->|PostgreSQL (Port 5433)| D["shopping-db"]
  B <-->|REST Integration| E["Pantry Service (api/v1/inventory)"]
  B <-->|OIDC Token Check| C
```

### 1. Auto-Provisioning Domain Rules (*Why*)
To maximize convenience in a household ecosystem, the service automates list creation on user ingress:
* **Personal List (`is_personal=true`)**: One list is guaranteed per user (`owner_id`). It is private to the user and follows them across any households they join.
* **Household List (`is_default=true`)**: One list is guaranteed per household (`home_id`). It is shared among all household members.
* **Protected Invariants**: Both system-provisioned lists are **non-deletable** to prevent accidental loss of default checklist lanes.

### 2. Backend-Driven Sorting
To enable custom list arrangements without client-side state discrepancy, list positioning is backend-driven:
* An `position` column in `ShoppingList` keeps track of order.
* The frontend drag-and-drop triggers a bulk `PATCH /api/v1/shopping-lists/reorder` update to the database.

---

## 🗂️ Directory Layout

* [`/backend`](file:///Users/leifkroeger/Dev/loeger-os/apps/shopping/backend) — FastAPI service handling database models, auto-provisioning rules, and integration endpoints.
* [`/frontend`](file:///Users/leifkroeger/Dev/loeger-os/apps/shopping/frontend) — Standalone Next.js 15 application utilizing tailwind styling and TanStack query caching.
* [`compose.yml`](file:///Users/leifkroeger/Dev/loeger-os/apps/shopping/compose.yml) — Docker container configurations for service orchestration.

---

## 🌐 Ingress Routing (Caddy Gateway)

Caddy acts as the central ingress reverse proxy:
* **Frontend**: Accessible under `http://alfheim.loegien.localhost/shopping` (with bare path redirects to `/shopping/en`).
* **Backend**: Accessible under `http://api.alfheim.loegien.localhost/shopping/api/v1`, with path stripping managed by Caddy `handle_path`.
* **Authentication**: OIDC Sessions via `http://api.alfheim.loegien.localhost/auth`.
