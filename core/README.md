# Core Architecture

The `core/` directory contains central control plane and platform services for `alfheim`. Unlike domain microservices in `apps/`, core services manage cross-cutting platform functionality, centralized application registries, and system control interfaces.

---

## 1. Architectural Purpose

Core services establish the entry point and foundational management plane of the platform.

The core modules located here include:
* **`dashboard/`**:
  * **`dashboard-backend`**: Go microservice providing centralized application registry endpoints (`/api/v1/apps`), platform status checks, and Tier 1 core service definitions (`tier1_core_registry.go`).
  * **`dashboard-frontend`**: Next.js control plane interface serving as the platform home page (`http://alfheim.loegien.localhost/`), presenting registered micro-applications, system status overview, household selection, and administrative controls.

---

## 2. Directory Structure & Conventions

```
core/
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
        └── compose.yml     # Control plane service & dashboard-db container
```

### Conventions:
* **Go Backend Implementation**: Core backend services leverage Go for lightweight memory footprint, low latency, and robust concurrent execution.
* **Tier 1 Application Registry**: Core application definitions (e.g. Dashboard, Pantry, Shopping, Chores, Maintenance, Budget, Library, Workout, Chat) are registered in Go code (`internal/features/apps/tier1_core_registry.go`).
* **Go Test Coverage Safeguard**: Every package containing Go code includes at least one `*_test.go` file to prevent coverage tool (`covdata`) errors during `go test -race -cover ./...`.

---

## 3. Interactions with Other Layers

* **Central Gateway Ingress (`infrastructure/caddy`)**: Caddy routes the platform root domain (`/`) directly to `dashboard-frontend:3000` and API requests (`/api/v1/apps`) to `dashboard-backend:8080`.
* **Shared UI & Client Libraries (`packages/shared`)**: `dashboard-frontend` consumes theme management, navigation shells (`AppHeader`, `AppShell`), and shared API utilities from `@alfheim/shared`.
* **Identity & Access Management (`infrastructure/keycloak`)**: Authenticates users and passes active household contexts (`X-Household-ID`) to control plane services.
* **Stack Application Manifest (`deploy/stack-apps.yaml`)**: Core services interface with stack manifests to surface registered microservice state and launcher shortcuts across the platform.
