---
title: "Home Maintenance Tracker"
description: "Home equipment inventory, recurring maintenance scheduling, interactive service checklists, and historical repair logs for Alfheim."
---

> **TL;DR:** Home equipment inventory, recurring maintenance scheduling, interactive service checklists, and historical repair logs for Alfheim.

Source: [`apps/maintenance/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/maintenance)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Equipment tracking | Household device inventory (HVAC, Appliances, Vehicles, Filters) |
| Preventative maintenance | Time-based and usage-based recurring maintenance schedules |
| Complex repair steps | Guided interactive maintenance checklists with step verification |
| Repair history & costs | Historical service logs, contractor notes, and parts cost tracking |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Python 3.12 / FastAPI microservice with SQLModel (async SQLAlchemy) and FastMCP AI tools.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_maintenance` database, owned by `maintenance_user`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `maintenance-backend` | 8000 | `/maintenance/api/v1` | FastAPI REST API & FastMCP Tools |
| `maintenance-frontend` | 3000 | `alfheim.loegien.localhost/maintenance` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://maintenance_user:postgres@postgres-core:5432/alfheim_maintenance` | Async PostgreSQL connection string |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | Generic OIDC backend auth issuer URL |
| `OIDC_AUDIENCE` | `alfheim` | Expected OIDC JWT audience claim |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Base URL of the household membership API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generated secret)* | Shared secret sent as `Authorization: Bearer …` on membership checks. Required; the backend refuses to start without it |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/maintenance` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

### Household Authorization

All routes and MCP tools use `require_household` from `backend_shared`; households are UUIDs owned by `core/household`. There is no local `household` table any more.

- `GET /api/v1/households` is deprecated and returns only the current household.
- A database created with integer household ids makes the backend refuse to start (`LegacyHouseholdSchemaError`). See [Troubleshooting](../../how-to/troubleshooting.md#symptom-5-maintenance-backend-fails-with-legacyhouseholdschemaerror) for the one-time reset.
- Calls to budget and shopping forward the caller's bearer token and `X-Household-ID`.

---

## 📁 Domain Features (`src/features/`)

- `equipment`: Appliance, device, and vehicle registration.
- `schedules`: Maintenance intervals (e.g. 6-month filter replacement).
- `tasks`: Interactive maintenance task execution and step checklists.
- `history`: Permanent service logs, contractor notes, and parts cost ledger.

---

## 🔌 MCP Tools

Served at `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`, `@mcp_server.tool()`),
authenticated the same way as the REST API. Tools take no `household_id`/`user_id` parameters —
they read `get_mcp_household_context()`.

| Feature | Tools |
| :--- | :--- |
| `devices` | `get_device_status`, `list_devices`, `get_device_detail` |
| `tasks` | `list_overdue_tasks`, `update_task_state_tool` |
| `maintenance` | `get_maintenance_summary_tool` |

`/maintenance/wizard` and `/maintenance/summary` now require a household member and are scoped to
`X-Household-ID`; both used to be unauthenticated and the summary used to return every household.

---

## ⚠️ Known Issues & Open Follow-Ups

- **`LegacyHouseholdSchemaError` on upgrade**: a database created before the switch to UUID
  households refuses to start `maintenance-backend`. This is a one-time, expected data reset — see
  [Troubleshooting](../../how-to/troubleshooting.md#symptom-5-maintenance-backend-fails-with-legacyhouseholdschemaerror)
  and [Known Issues](../../explanation/known-issues.md).
- No other known open issues beyond the general household-authorization items in
  [Known Issues](../../explanation/known-issues.md).

---
