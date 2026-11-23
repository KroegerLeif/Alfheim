---
title: "Central Dashboard Control Plane"
description: "Central control plane, landing page launcher, application registry, and telemetry interface for the Alfheim platform."
---

> **TL;DR:** Central control plane, landing page launcher, application registry, and telemetry interface for the Alfheim platform.

> **Note:** Households, members and roles, invites, contacts and the user profile moved to the Tier-1 app `core/household` (served under `/household`). The dashboard no longer exposes `/api/v1/households*` or `/api/v1/profile*`. Only the household launchers read `X-Household-ID`, and they confirm it against the `core/household` membership API; `X-Household-Role` is always ignored.

Source: [`core/dashboard/`](https://github.com/KroegerLeif/Alfheim/tree/main/core/dashboard)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Single entry point for all home apps | Centralized dashboard launcher rendering registered microservices |
| Mixed ecosystem (Native vs. Homelab) | 3-Tier Application Registry (Native Core Apps, Stack YAML, User Bookmarks) plus household launchers |
| Household web apps (Home Assistant, Jellyfin, ...) | Household launchers that owners and admins manage in the UI, without a redeploy |
| Household management | Launcher tile and navigation links to the `core/household` app (`/household`, `/household/profile`) |
| System health visibility | Platform telemetry endpoints for system metrics (CPU, RAM) and logs |

---

## 🏛️ 3-Tier Application Registry Architecture

The platform organizes applications, portals, and bookmarks into three distinct architectural tiers:

1. **Tier 1 (Core Apps):** Native monorepo microservices registered in Go (`internal/features/apps/tier1_core_registry.go`). The backend reads `ALFHEIM_ENABLED_APPS` once at startup and keeps only the enabled apps: the household tile is always listed, an unset variable (or `all`) lists every app, and unknown names are ignored. A disabled app therefore has no tile. Visible to all authenticated users; visibility can be toggled per user in `user_preferences`.
2. **Tier 2 (Stack Apps / Integrations):** External homelab stack applications configured via server-level [`deploy/stack-apps.yaml`](../../../../deploy/stack-apps.yaml) and filtered dynamically by OIDC roles.
3. **Tier 3 (User Links):** Personal custom bookmarks stored in PostgreSQL `user_links` (`GET/POST/PUT/DELETE /api/v1/user/links`).

### Link scopes

Links to web apps Alfheim does not run come from three scopes:

| Scope | Managed by | Stored in | Seen by |
| :--- | :--- | :--- | :--- |
| Operator stack apps (Tier 2) | The operator, by editing a file and restarting the dashboard backend | [`deploy/stack-apps.yaml`](../../../../deploy/stack-apps.yaml) | Every user of the installation (filtered by OIDC roles) |
| Household launchers | Household `OWNER` and `ADMIN` in the dashboard | `household_launchers`, one row set per household | Every member of that household |
| Personal links (Tier 3) | Each user | `user_links` | Only that user |

The dashboard grid shows them in this order: Tier-1 apps, household launchers, operator stack apps, personal links.

### Household launchers

A launcher is a link and nothing else ([ADR 0010](../../explanation/decisions/0010-integration-architecture.md)): title, URL, icon, description and display order. The backend never calls the target and stores no credential for it, and the frontend opens it in a new tab with `rel="noopener noreferrer"`, never in a frame. A target that needs a secret or a server-side request is a typed plugin, not a launcher. How-to: [Add an external app launcher](../../how-to/add-external-app-launcher.md).

Every request sends `X-Household-ID`; `household.RequireHousehold` (`packages/go-shared`) confirms the membership against `core/household` and every query filters by that household. The household never comes from the token or the request body; a body with a `household_id` field is rejected.

| Method and path | Role | Answer |
| :--- | :--- | :--- |
| `GET /api/v1/launchers?limit=&offset=` | Any member | `200` with `{"items": [...], "total", "limit", "offset"}`; `limit` 1 to 100 (default 100), `offset` from 0 |
| `POST /api/v1/launchers` | `OWNER`, `ADMIN` | `201` with the launcher |
| `PUT /api/v1/launchers/{id}` | `OWNER`, `ADMIN` | `200` with the launcher; the body replaces every field |
| `DELETE /api/v1/launchers/{id}` | `OWNER`, `ADMIN` | `204` |

Request body: `{"title", "url", "icon", "description", "display_order"}`. Invalid input is rejected, never rewritten:

* `title`: required, at most 100 characters, no control characters.
* `url`: required, at most 2048 characters, an absolute `http` or `https` URL with a host, without user name or password (`user:pass@`), whitespace or backslashes. `javascript:`, `data:` and relative URLs are rejected.
* `icon`: one of the allowed lucide icon names (`internal/features/launchers/icons.go`, mirrored by the frontend); empty means `link`.
* `description`: at most 500 characters. `display_order`: 0 to 10000.

Errors use `{"detail": {"code", "message"}}` ([ADR 0011](../../explanation/decisions/0011-headless-api-contract.md)): `422 validation_error` with the rejected fields in `detail.errors`, `400 invalid_body` for malformed JSON or unknown fields, `403 household_role_forbidden` for a `MEMBER` or `GUEST` on a write, `404 launcher_not_found` for an id that is not in the caller's household, and the household codes (`400 household_required`, `403 household_forbidden`, `503 household_service_unavailable`) from the membership check.

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Go 1.27 REST API backend utilizing Chi router, PostgreSQL (`pgxpool`), and generic OIDC (Zitadel) bearer-token middleware.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_dashboard` database, owned by `dashboard_user`).

### FDD Domain Features (`internal/features/`)
- `apps`: Unified 3-Tier application registry handlers and YAML loaders.
- `launchers`: Household launchers (entity, repository, service, handler), behind `household.RequireHousehold` and, for writes, `household.RequireHouseholdRole`.
- `apps` also serves `GET /api/v1/apps/enabled`: `{"apps": ["household", ...]}`, the Tier-1 app ids from `ALFHEIM_ENABLED_APPS` (authenticated, independent of hidden tiles and health). `useAppEnabled` in `@alfheim/shared` reads it once per page load, so other frontends leave out entry points into an app that is not installed (pantry hides the ALFI chat button and widget without the chat app).
- `apphealth`: Live state of the Tier-1 tiles. `GET /api/v1/apps/health` returns `{"apps": {"<id>": "online|degraded|offline"}, "checked_at": ...}`. The backend probes each enabled app backend's readiness endpoint (`/readyz`) on `gateway-net` (2 s timeout): a `2xx` answer is *online*, any other answer *degraded* (for example a backend whose database is down or behind on migrations), no answer *offline*. Snapshots are cached for 15 s and concurrent requests share one probe round, so each app is probed at most once per window however many dashboards are open. The frontend polls every 15 s, so a stopped app turns offline within 30 s, and never calls the app APIs itself. Tier-2 stack apps are not probed.
- `telemetry`: System metrics and log queries. When VictoriaLogs is unreachable or empty, `GET /api/v1/telemetry/logs` returns a fixed set of illustrative entries (they only reference routes the dashboard serves); the frontend shows a notice when the log request itself fails.

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 18 Core Database Server |
| `dashboard-backend` | 8080 | `/api/v1/apps`, `/api/v1/apps/health`, `/api/v1/apps/enabled`, `/api/v1/launchers*`, `/api/v1/user/*`, `/api/v1/telemetry*` | Go REST API Control Plane |
| `dashboard-frontend` | 3000 | `alfheim.loegien.localhost/` | Next.js Landing Page Control Plane |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://dashboard_user:postgres@postgres-core:5432/alfheim_dashboard?sslmode=disable` | PostgreSQL connection string |
| `STACK_APPS_PATH` | `deploy/stack-apps.yaml` | Path to Tier 2 stack integrations manifest |
| `ALFHEIM_ENABLED_APPS` | `all` | Enabled optional apps; decides the Tier-1 tiles. Unset or `all` lists every app, an empty value only the household tile |
| `OIDC_ISSUER_URL` | `https://auth.loegien.de` | Canonical OIDC issuer; JWKS URI is discovered from its `/.well-known/openid-configuration` |
| `OIDC_AUDIENCE` | `alfheim` | Required value in the token `aud` claim |
| `ALFHEIM_INTERNAL_TOKEN` | (generated) | Required. Service token for the `core/household` membership API that confirms the household of launcher requests; the backend refuses to start without it |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Base URL of the membership API |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

---

## 🗄️ Database Schema (PostgreSQL)

The Go control plane initializes four core tables via SQL migrations:
* `user_profiles`: Minimal local user row, provisioned Just-In-Time from OIDC token claims on the first write, because `user_preferences` and `user_links` reference it by foreign key. The dashboard does not manage profile data; that lives in `core/household`. Migration `000007` dropped the former `households`, `household_members`, `household_invites`, `contacts` and `contact_categories` tables.
* `user_preferences`: User dashboard settings and hidden core app IDs (`hidden_app_ids TEXT[]`).
* `user_links`: Personal custom bookmarks (`title`, `url`, `icon`, `category`, `display_order`).
* `household_launchers` (migration `000008`): Household launchers (`household_id`, `title`, `url`, `icon`, `description`, `display_order`, `created_by`), indexed by `household_id`. There is no foreign key to the household, which lives in `core/household`'s database. Migration `000009` is reserved for the typed plugin framework.

---

## ⚠️ Known Issues & Open Follow-Ups

The dashboard is a launcher (app catalog, household launchers, user links and preferences, plus the
telemetry view) after households, members, roles, invites, contacts and the user profile moved
to `core/household`. There is no further "slimming" planned; the dashboard becomes its own app
sprint later, at which point its Go backend, the 3-tier registry, and the telemetry view are
candidates for review. No known open bugs beyond the general items in
[Known Issues](../../explanation/known-issues.md).

---
