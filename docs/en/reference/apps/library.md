---
title: "Media & Library Hub"
description: "Digital media catalog, book and movie tracking, loan management, reading progress log, and wishlist service for Alfheim."
---

> **TL;DR:** Digital media catalog, book and movie tracking, loan management, reading progress log, and wishlist service for Alfheim.

Source: [`apps/library/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/library)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Book & Media Tracking | Unified media item catalog (Books, Movies, Audiobooks) |
| Reading Progress | Reading session logs, page tracking, and completion status |
| Borrowing & Lending | Loan tracker for items lent to friends or borrowed from libraries |
| Wishlist & Recommendations | Shared household wishlist with ISBN/OpenLibrary metadata sync |

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
| `NEXT_PUBLIC_LIBRARY_API_URL` | `http://api.alfheim.loegien.localhost/library/api/v1` | Browser API gateway endpoint |

---

## 📁 Domain Features (`src/features/`)

- `media`: Physical and digital media item catalog with OpenLibrary ISBN lookup.
- `loans`: Loan tracking for items borrowed from external libraries or lent to friends.
- `progress`: Reading and viewing progress logs, page/minute tracking.
- `wishlist`: Shared household wishlist for upcoming media purchases.

---
