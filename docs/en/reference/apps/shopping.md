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
| `NEXT_PUBLIC_SHOPPING_API_URL` | `http://api.alfheim.loegien.localhost/shopping/api/v1` | Browser API gateway endpoint |

---

## 🔑 Domain Features & Auto-Provisioning Rules

- **Personal List (`is_personal=true`)**: Automatically provisioned per user upon ingress. Private to the user across households. Non-deletable.
- **Household List (`is_default=true`)**: Automatically provisioned per household. Shared among all members. Non-deletable.
- **Backend-Driven Sorting**: Item positioning is tracked via `position` column. Drag-and-drop reordering sends bulk `PATCH /api/v1/shopping-lists/reorder` updates.

---
