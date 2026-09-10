# Central Dashboard Control Plane (`core/dashboard/`)

> **TL;DR:** Central control plane, landing page launcher, application registry, household manager, and telemetry interface for the Alfheim platform.

---

## 📋 Table of Contents
- [Purpose & Core Value](#purpose--core-value)
- [3-Tier Application Registry Architecture](#3-tier-application-registry-architecture)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Ingress Routing & Environment Configuration](#ingress-routing--environment-configuration)
- [Local Development & Commands](#local-development--commands)
- [Database Schema (PostgreSQL)](#database-schema-postgresql)
- [Testing & Quality Gates](#testing--quality-gates)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Single entry point for all home apps | Centralized dashboard launcher rendering registered microservices |
| Mixed ecosystem (Native vs. Homelab) | 3-Tier Application Registry (Native Core Apps, Stack YAML, User Bookmarks) |
| Multi-household management | Household creation, invitation management, and member role assignment |
| System health visibility | Platform telemetry endpoints for system metrics (CPU, RAM) and logs |

---

## 🏛️ 3-Tier Application Registry Architecture

The platform organizes applications, portals, and bookmarks into three distinct architectural tiers:

1. **Tier 1 (Core Apps):** Native monorepo microservices registered in Go (`internal/features/apps/tier1_core_registry.go`). Visible to all authenticated users; visibility can be toggled per user in `user_preferences`.
2. **Tier 2 (Stack Apps / Integrations):** External homelab stack applications configured via server-level [`deploy/stack-apps.yaml`](../../deploy/stack-apps.yaml) and filtered dynamically by OIDC roles.
3. **Tier 3 (User Links):** Personal custom bookmarks stored in PostgreSQL `user_links` (`GET/POST/PUT/DELETE /api/v1/user/links`).

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Go 1.25 REST API backend utilizing Chi router, PostgreSQL (`pgxpool`), and generic OIDC (Zitadel) bearer-token middleware.
- **Frontend:** Next.js 16 (App Router) microfrontend, Tailwind CSS v4, Lucide React, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_dashboard` database, owned by `dashboard_user`).

### FDD Domain Features (`internal/features/`)
- `apps`: Unified 3-Tier application registry handlers and YAML loaders.
- `household`: Household creation, member role management, invite token generation, and contact directory.
- `profile`: User profile Just-In-Time provisioning from verified OIDC token claims.
- `telemetry`: System metrics and log queries.

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `dashboard-backend` | 8080 | `/api/v1/apps`, `/api/v1/households` | Go REST API Control Plane |
| `dashboard-frontend` | 3000 | `alfheim.loegien.localhost/` | Next.js Landing Page Control Plane |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://dashboard_user:postgres@postgres-core:5432/alfheim_dashboard?sslmode=disable` | PostgreSQL connection string |
| `STACK_APPS_PATH` | `deploy/stack-apps.yaml` | Path to Tier 2 stack integrations manifest |
| `OIDC_ISSUER_URL` | `https://auth.loegien.de` | Canonical OIDC issuer; JWKS URI is discovered from its `/.well-known/openid-configuration` |
| `OIDC_AUDIENCE` | `alfheim` | Required value in the token `aud` claim |
| `NEXT_PUBLIC_API_URL` | `http://api.alfheim.loegien.localhost` | Browser API gateway endpoint |

---

## 🚀 Local Development & Commands

### 1. Run via Docker Compose
```bash
docker compose up -d
```

### 2. Run Go Backend Locally
```bash
cd backend
go run cmd/server/main.go
```

### 3. Run Next.js Frontend Locally
```bash
cd frontend
pnpm install
pnpm dev
```

---

## 🗄️ Database Schema (PostgreSQL)

The Go control plane initializes three core tables via SQL migrations:
* `user_profiles`: Local synced user profiles from OIDC token claims (`id`, `email`, `username`, `first_name`, `last_name`).
* `user_preferences`: User dashboard settings and hidden core app IDs (`hidden_app_ids TEXT[]`).
* `user_links`: Personal custom bookmarks (`title`, `url`, `icon`, `category`, `display_order`).

---

## 🧪 Testing & Quality Gates

```bash
# Run Go unit & integration tests with race detector
cd backend && go test -race -cover ./...

# Run Frontend typecheck & tests
cd frontend && pnpm check-types && pnpm test
```
