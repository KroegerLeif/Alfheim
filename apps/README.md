# Apps Architecture

The `apps/` directory contains all domain-specific microservice applications in the `alfheim` monorepo. Each application represents an independent functional module designed as a paired microfrontend and microservice backend.

---

## 1. Architectural Purpose

Applications in `apps/` deliver isolated domain capabilities (e.g., inventory management, chore tracking, budget management, home maintenance) while adhering to uniform platform standards.

The applications currently hosted in `apps/` include:
* **`budget/`**: Budget & Virtual Pots management.
* **`chat/`**: ALFI AI Assistant & Chat module (Go backend + Next.js frontend).
* **`chores/`**: Household chore assignment, scheduling, and completion tracking.
* **`library/`**: Media & Library Hub for tracking books, movies, and media assets.
* **`maintenance/`**: Home equipment and maintenance task tracking.
* **`pantry/`**: Digital Pantry inventory, item locations, and low-stock tracking.
* **`shopping/`**: Collaborative household shopping lists and item synchronization.
* **`workout/`**: Fitness tracking and exercise routine monitoring.

---

## 2. Directory Structure & Conventions

Each application directory follows a standard paired structure:

```
apps/<app-name>/
├── frontend/               # Next.js / React microfrontend
│   ├── src/
│   │   ├── app/           # Next.js App Router subpaths (e.g. /[locale]/...)
│   │   ├── features/      # Feature-Driven Design (FDD) domain modules
│   │   └── proxy.ts       # Next.js route & session proxy handler
│   ├── package.json
│   └── vitest.config.ts
└── backend/                # Microservice backend (Python FastAPI or Go)
    ├── src/
    │   ├── features/      # Feature domain logic (models, repositories, services, routers)
    │   └── main.py / main.go
    ├── pyproject.toml / go.mod
    └── compose.yml         # Application service & dedicated database definition
```

### Key Folder Conventions:
* **Isolated Data Persistence**: Each backend defines a dedicated PostgreSQL database container in its `compose.yml` (e.g., `pantry-db`, `workout-db`), enforcing a "Database per Service" pattern.
* **Tenant Isolation**: Backend APIs validate the `X-Household-ID` request header against JWT token claims (`household_id`, `active_household_id`, or `households`).
* **Frontend Verification & Testing**: Frontends utilize Vitest with MSW v2 for mock API handler testing, and type checking via `pnpm check-types`.

---

## 3. Interactions with Other Layers

* **`packages/shared` (`@alfheim/shared`)**: Frontends import UI primitives (`Button`, `Dialog`, `Progress`), dynamic theme engines, localized i18n dictionaries (`common`, `pantry`, etc.), and typed `ApiClient` wrappers.
* **`packages/backend-shared` (`backend_shared`)**: Python backends consume workspace utilities for OpenTelemetry instrumentation, Keycloak JWT verification, and RustFS S3 storage integration.
* **Central Caddy Gateway (`infrastructure/caddy`)**: Caddy proxies incoming traffic to frontend containers (`alfheim.loegien.localhost/<app>`) and backend API routes (`api.alfheim.loegien.localhost/<app>/api/v1`).
* **Identity Provider (`infrastructure/keycloak`)**: Backends validate bearer tokens issued by Keycloak, while frontends execute PKCE OIDC authorization flows.
