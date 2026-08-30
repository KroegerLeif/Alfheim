# Packages Architecture

The `packages/` directory contains monorepo workspace libraries shared across applications (`apps/`) and core services (`core/`). Reusable UI primitives, API utilities, internationalization dictionaries, and backend infrastructure helpers are centralized here to maintain consistent behavior and prevent code duplication.

---

## 1. Architectural Purpose

Shared packages decouple common operational concerns (such as design system components, authentication middleware, telemetry setup, and S3 storage) from individual domain services.

The packages in this directory include:
* **`shared/` (`@alfheim/shared`)**:
  * Shared TypeScript/React package for all frontend microservices.
  * Provides design system UI primitives (`Button`, `Badge`, `Dialog`, `Progress`, `Table`, `cn`), financial/domain UI components, layout shell wrappers (`AppShell`, `AppHeader`), dynamic multi-theme engine (defaulting to `nordic` dark mode), centralized API client wrappers (`ApiClient`, `fetchWithTrace`), and W3C traceparent header generators.
  * Houses shared i18n translation dictionaries (`src/features/i18n/locales/{en,de,pl}/`).
* **`backend-shared/` (`backend_shared`)**:
  * Shared Python workspace package for all FastAPI backend microservices.
  * Provides unified telemetry initialization (`setup_telemetry`, `shutdown_telemetry`) via OpenTelemetry and Vector log aggregation.
  * Enforces tenant isolation middleware and Keycloak JWT token verification routines (`X-Household-ID` validation).
  * Manages S3 object storage settings and client wrappers (`StorageSettings`, RustFS S3 integration).

---

## 2. Directory Structure & Conventions

```
packages/
├── shared/                 # Frontend TypeScript shared library (@alfheim/shared)
│   ├── src/
│   │   ├── features/
│   │   │   ├── api/       # ApiClient, traceparent header injection
│   │   │   ├── i18n/      # Locales (de, en, pl)
│   │   │   ├── theme/     # ThemeProvider & theme switcher utilities
│   │   │   └── ui/        # Shared UI primitives & components
│   │   └── index.ts       # Package entry exports
│   ├── package.json
│   └── tsup.config.ts
└── backend-shared/         # Python workspace library (backend_shared)
    ├── src/
    │   └── backend_shared/
    │       ├── auth/      # Keycloak OIDC verification & tenancy checks
    │       ├── config/    # Base environment & S3 configuration
    │       ├── storage/   # RustFS S3 client wrapper
    │       └── telemetry/ # OpenTelemetry & Vector instrumentation
    └── pyproject.toml
```

### Conventions:
* **Frontend Architectural LOC Limit**: All frontend `.ts` and `.tsx` source files in `@alfheim/shared` strictly adhere to a maximum limit of 200 lines of code (LOC) per file.
* **Workspace Package Resolution**:
  * Frontend apps declare `"@alfheim/shared": "workspace:*"` in `package.json`.
  * Python microservices declare `backend-shared` under `project.dependencies` in `pyproject.toml` and configure `[tool.uv.sources] backend-shared = { workspace = true }`.
* **Zero Theme Flicker**: Theme variables and CSS tokens are imported via `@import "@alfheim/shared/styles/theme.css";` to guarantee seamless CSS variable inheritance.

---

## 3. Interactions with Other Layers

* **Applications (`apps/*`)**: Microfrontends import `@alfheim/shared` components and API clients. Python backends import `backend_shared` during startup lifespan hooks.
* **Core Platform (`core/*`)**: Core Dashboard frontend uses shared UI components and theme controls; core backend utilizes shared telemetry standards.
* **Telemetry Stack (`infrastructure/telemetry`)**: `backend_shared` ships OTLP metrics to OTel Collector and structured JSON logs to Vector.
* **Storage Infrastructure (`infrastructure/rustfs`)**: `backend_shared` connects backend services to central RustFS S3 object storage.
