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
| `NEXT_PUBLIC_MAINTENANCE_API_URL` | `http://api.alfheim.loegien.localhost/maintenance/api/v1` | Browser API gateway endpoint |

---

## 📁 Domain Features (`src/features/`)

- `equipment`: Appliance, device, and vehicle registration.
- `schedules`: Maintenance intervals (e.g. 6-month filter replacement).
- `tasks`: Interactive maintenance task execution and step checklists.
- `history`: Permanent service logs, contractor notes, and parts cost ledger.

---
