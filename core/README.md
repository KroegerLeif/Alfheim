# Core Architecture

The `core/` directory contains central control plane and platform services for `alfheim`. Unlike domain microservices in `apps/`, core services manage cross-cutting platform functionality, centralized application registries, and system control interfaces.

---

## 1. Architectural Purpose

Core services establish the entry point and foundational management plane of the platform.

The core modules located here include:
* **`dashboard/`**:
  * **`dashboard-backend`**: Go microservice providing centralized application registry endpoints (`/api/v1/apps`), platform status checks, and Tier 1 core service definitions (`tier1_core_registry.go`).
  * **`dashboard-frontend`**: Next.js control plane interface serving as the platform home page (`http://alfheim.loegien.localhost/`), presenting registered micro-applications, user links and preferences, and the shared household switcher.
* **`household/`**:
  * **`household-backend`**: Go microservice that owns households, members and roles, invites, contacts and user profiles (`/api/v1/households*`, `/api/v1/profile*`). Its internal membership API (`GET /internal/v1/memberships/{householdId}/{userSub}`, protected by `ALFHEIM_INTERNAL_TOKEN`, never routed by Caddy) authorizes `X-Household-ID` for every other backend ([ADR 0006](../docs/en/explanation/decisions/0006-household-authorization-via-membership-api.md)).
  * **`household-frontend`**: Next.js app under `/household` for household management, invites and onboarding, and the user profile.

---

## 2. Directory Structure & Conventions

```
core/
├── household/
│   ├── frontend/           # Next.js household app (basePath /household)
│   └── backend/            # Go household & membership service
└── dashboard/
    ├── frontend/           # Next.js platform control plane frontend
    │   ├── src/
    │   │   ├── app/       # Next.js root layout and landing pages
    │   │   └── features/  # Core UI components (app cards, system status)
    │   └── package.json
    └── backend/            # Go backend service
        ├── internal/
        │   └── features/
        │       └── apps/  # Tier 1 core application registry & HTTP handlers
        ├── go.mod
        └── compose.yml     # Control plane service container
```

### Conventions:
* **Go Backend Implementation**: Core backend services leverage Go for lightweight memory footprint, low latency, and robust concurrent execution.
* **Tier 1 Application Registry**: Core application definitions (e.g. Dashboard, Pantry, Shopping, Chores, Maintenance, Budget, Library, Workout, Chat) are registered in Go code (`internal/features/apps/tier1_core_registry.go`).
* **Go Test Coverage Safeguard**: Every package containing Go code includes at least one `*_test.go` file to prevent coverage tool (`covdata`) errors during `go test -race -cover ./...`.

---

## 3. Interactions with Other Layers

* **Central Gateway Ingress (`infrastructure/caddy`)**: Caddy routes the platform root domain (`/`) directly to `dashboard-frontend:3000` and API requests (`/api/v1/apps`) to `dashboard-backend:8080`. `/household*` goes to `household-frontend:3000`, `/api/v1/households*` and `/api/v1/profile*` to `household-backend:8080`, and `/internal/*` answers `404`.
* **Shared UI & Client Libraries (`packages/shared`)**: `dashboard-frontend` consumes theme management, navigation shells (`AppHeader`, `AppShell`), and shared API utilities from `@alfheim/shared`.
* **Identity & Access Management (Zitadel)**: Authenticates users via OIDC only. Household membership and roles come from `household-backend`, never from token claims. The dashboard backend is not household-scoped and ignores `X-Household-ID`.
* **Stack Application Manifest (`deploy/stack-apps.yaml`)**: Core services interface with stack manifests to surface registered microservice state and launcher shortcuts across the platform.
