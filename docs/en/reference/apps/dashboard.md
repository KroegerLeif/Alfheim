---
title: "Central Dashboard Control Plane"
description: "Central control plane, landing page launcher, application registry, and telemetry interface for the Alfheim platform."
---

> **TL;DR:** Central control plane, landing page launcher, application registry, and telemetry interface for the Alfheim platform.

> **Note:** Households, members and roles, invites, contacts and the user profile moved to the Tier-1 app `core/household` (served under `/household`). The dashboard no longer exposes `/api/v1/households*` or `/api/v1/profile*` and ignores the `X-Household-ID` / `X-Household-Role` headers.

Source: [`core/dashboard/`](https://github.com/KroegerLeif/Alfheim/tree/main/core/dashboard)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Single entry point for all home apps | Centralized dashboard launcher rendering registered microservices |
| Mixed ecosystem (Native vs. Homelab) | 3-Tier Application Registry (Native Core Apps, Stack YAML, User Bookmarks) |
| Household management | Launcher tile and navigation links to the `core/household` app (`/household`, `/household/profile`) |
| System health visibility | Platform telemetry endpoints for system metrics (CPU, RAM) and logs |

---

## 🏛️ 3-Tier Application Registry Architecture

The platform organizes applications, portals, and bookmarks into three distinct architectural tiers:

1. **Tier 1 (Core Apps):** Native monorepo microservices registered in Go (`internal/features/apps/tier1_core_registry.go`). Visible to all authenticated users; visibility can be toggled per user in `user_preferences`.
2. **Tier 2 (Stack Apps / Integrations):** External homelab stack applications configured via server-level [`deploy/stack-apps.yaml`](../../../../deploy/stack-apps.yaml) and filtered dynamically by OIDC roles.
3. **Tier 3 (User Links):** Personal custom bookmarks stored in PostgreSQL `user_links` (`GET/POST/PUT/DELETE /api/v1/user/links`).

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Go 1.25 REST API backend utilizing Chi router, PostgreSQL (`pgxpool`), and generic OIDC (Zitadel) bearer-token middleware.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_dashboard` database, owned by `dashboard_user`).

### FDD Domain Features (`internal/features/`)
- `apps`: Unified 3-Tier application registry handlers and YAML loaders.
- `telemetry`: System metrics and log queries.

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `dashboard-backend` | 8080 | `/api/v1/apps`, `/api/v1/user/*`, `/api/v1/telemetry*` | Go REST API Control Plane |
| `dashboard-frontend` | 3000 | `alfheim.loegien.localhost/` | Next.js Landing Page Control Plane |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://dashboard_user:postgres@postgres-core:5432/alfheim_dashboard?sslmode=disable` | PostgreSQL connection string |
| `STACK_APPS_PATH` | `deploy/stack-apps.yaml` | Path to Tier 2 stack integrations manifest |
| `OIDC_ISSUER_URL` | `https://auth.loegien.de` | Canonical OIDC issuer; JWKS URI is discovered from its `/.well-known/openid-configuration` |
| `OIDC_AUDIENCE` | `alfheim` | Required value in the token `aud` claim |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

---

## 🗄️ Database Schema (PostgreSQL)

The Go control plane initializes three core tables via SQL migrations:
* `user_profiles`: Minimal local user row, provisioned Just-In-Time from OIDC token claims on the first write, because `user_preferences` and `user_links` reference it by foreign key. The dashboard does not manage profile data; that lives in `core/household`. Migration `000007` dropped the former `households`, `household_members`, `household_invites`, `contacts` and `contact_categories` tables.
* `user_preferences`: User dashboard settings and hidden core app IDs (`hidden_app_ids TEXT[]`).
* `user_links`: Personal custom bookmarks (`title`, `url`, `icon`, `category`, `display_order`).

---
