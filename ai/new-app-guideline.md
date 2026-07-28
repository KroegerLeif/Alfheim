# New App Setup Blueprint (`apps/<app-name>`)

This guideline defines the mandatory architecture, directory layout, core files, system integrations, and execution checklist for introducing a new application into the `loeger-os` monorepo. All AI agents creating or scaffolding new apps **MUST** strictly follow this blueprint.

---

## 1. Directory Structure

Every application inside `apps/<app-name>/` follows **Feature-Driven Design (FDD)** as defined in [`ai/CORE.md`](./CORE.md). Code is organized around business domain features rather than technical layer types.

```text
apps/<app-name>/
├── compose.yml                        # App-level Docker Compose orchestrator
├── .env.example                       # Application-specific environment variables template
│
├── backend/                           # Backend Microservice (Python FastAPI / Go / Java)
│   ├── Dockerfile                     # Multi-stage Docker build file
│   ├── pyproject.toml / go.mod        # Dependency & package manifest
│   ├── README.md                      # Backend documentation & API contracts
│   └── src/                           # Source root
│       ├── main.py / main.go          # Application entrypoint & HTTP server
│       ├── core/                      # Global infrastructure (DB, auth, config, logger)
│       │   ├── config.py              # Environment settings (Pydantic / Viper)
│       │   ├── database.py            # Async DB engine & session factory
│       │   └── dependencies.py        # Auth context & common dependencies
│       ├── features/                  # Feature-Driven Modules (FDD)
│       │   └── <feature_name>/        # Business domain module (e.g., items, categories)
│       │       ├── router.py          # API route definitions & HTTP handlers
│       │       ├── service.py         # Business domain logic & operations
│       │       ├── models.py          # Database ORM models (SQLModel / GORM)
│       │       └── schemas.py         # Request/Response DTOs & Validation
│       └── shared/                    # Domain-agnostic helpers & cross-cutting tools
│
└── frontend/                          # Frontend Web Application (Next.js 15 + React Query)
    ├── Dockerfile                     # Containerization setup for standalone Next.js build
    ├── package.json                   # Frontend dependencies (pnpm workspace member)
    ├── tsconfig.json                  # Strict TypeScript configuration
    ├── next.config.ts                 # Next.js configuration (basePath, i18n, output: standalone)
    ├── tailwind.config.ts             # Tailwind CSS styling configuration
    └── src/
        ├── proxy.ts                   # next-intl i18n routing & auth proxy (Next.js 16+)
        ├── app/
        │   └── [locale]/              # Localized pages & layouts (en / de)
        │       ├── layout.tsx         # Root layout with QueryClient & Auth Providers
        │       └── page.tsx           # Application entry page
        ├── features/                  # Feature-Driven UI Modules (FDD)
        │   └── <feature_name>/        # Domain components, hooks & state
        │       ├── components/        # Feature UI components
        │       ├── api/               # API mutation & query hooks (React Query + Ky)
        │       └── types/             # Domain TypeScript types & Zod schemas
        ├── lib/                       # HTTP clients & utilities (ky instances, cn helper)
        └── components/
            └── shared/                # Cross-feature design system primitives
```

---

## 2. Required Core Files

When initializing a new app, the following core files **MUST** be explicitly created and fully implemented (no empty files or dummy stubs):

### Root App Files
- `apps/<app-name>/compose.yml`: Declares app database, backend, frontend services, health checks, Traefik routing labels, and network connections.
- `apps/<app-name>/.env.example`: Provides default environment variables for local execution and container setup.

### Backend Core Files
- `apps/<app-name>/backend/Dockerfile`: Production multi-stage Docker build file.
- `apps/<app-name>/backend/pyproject.toml` (or `go.mod` / `pom.xml`): Dependency management configuration.
- `apps/<app-name>/backend/src/main.py`: Expresses HTTP lifespan, middleware, CORS, routers, and healthcheck route at `/api/v1/health`.
- `apps/<app-name>/backend/src/core/config.py`: Centralized environment configuration loader.
- `apps/<app-name>/backend/src/core/database.py`: Async database engine connection pool & session maker.
- `apps/<app-name>/backend/src/core/dependencies.py`: Encapsulates Keycloak JWT parsing into `UserHomeContext`.

### Frontend Core Files
- `apps/<app-name>/frontend/Dockerfile`: Multi-stage Docker build with `output: "standalone"` enabled in `next.config.ts`.
- `apps/<app-name>/frontend/package.json`: Configured with proper package name (e.g., `<app-name>-frontend`) and dependencies.
- `apps/<app-name>/frontend/tsconfig.json`: Standardized TypeScript config with path aliases (`@/*` pointing to `./src/*`).
- `apps/<app-name>/frontend/next.config.ts`: Configured with `basePath: '/<app-name>'` (if mounted on subpath) and standalone build mode.
- `apps/<app-name>/frontend/src/lib/api.ts`: Typed `ky` HTTP client configured for API requests.

---

## 3. Mandatory Configurations & Integrations

To properly register and integrate the new application into `loeger-os`, perform the following step-by-step system registrations:

### Step 3.1: Monorepo Root Registration (`compose.yaml` & `pnpm-workspace.yaml`)
1. Open the root [`compose.yaml`](../compose.yaml) file.
2. Add the new app compose file to the `include:` section:
   ```yaml
   include:
     # ...
     - ./apps/<app-name>/compose.yml
   ```
3. If the app defines a new top-level internal network shared with other apps, register it under `networks:` in `compose.yaml`.
4. Ensure `pnpm-workspace.yaml` covers `apps/*/frontend` (the wildcard rules `apps/*` and `apps/*/frontend` automatically pick up new applications).

### Step 3.2: App-Level Docker Compose (`apps/<app-name>/compose.yml`)
1. **Services to define**:
   - `<app-name>-db`: Dedicated PostgreSQL container (`postgres:16-alpine`), internal network only, persistent volume, and healthcheck.
   - `<app-name>-backend`: Built from `./backend`, connected to `public-ingress`, `<app-name>-internal`, and `observability-internal`.
   - `<app-name>-frontend`: Built from root context (`../../`) using `dockerfile: apps/<app-name>/frontend/Dockerfile`, connected to `public-ingress`.
2. **Network Ownership Rules**:
   - App-internal networks (e.g., `<app-name>-internal`) are owned by this compose file (do **NOT** mark `external: true`).
   - Shared infrastructure networks (`public-ingress`, `observability-internal`, `iam_network`) MUST be marked with `external: true`.

### Step 3.3: Traefik Ingress Routing
Traefik routes incoming port `80` traffic to backend and frontend containers via Docker labels in `compose.yml`.

#### Backend Router Labels:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.<app-name>-backend.rule=Host(`loeger-os`) && PathPrefix(`/api/v1/<app-name>`)"
  - "traefik.http.routers.<app-name>-backend.entrypoints=web"
  - "traefik.http.routers.<app-name>-backend.middlewares=<app-name>-api-replace"
  - "traefik.http.routers.<app-name>-backend.service=<app-name>-backend-service"
  - "traefik.http.middlewares.<app-name>-api-replace.replacepathregex.regex=^/api/v1/<app-name>/(api/v1/)?(.*)"
  - "traefik.http.middlewares.<app-name>-api-replace.replacepathregex.replacement=/api/v1/$$2"
  - "traefik.http.services.<app-name>-backend-service.loadbalancer.server.port=8000"
```

#### Frontend Router Labels:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.<app-name>-frontend.rule=Host(`loeger-os`) && PathPrefix(`/<app-name>`)"
  - "traefik.http.routers.<app-name>-frontend.entrypoints=web"
  - "traefik.http.routers.<app-name>-frontend.service=<app-name>-frontend-service"
  
  # Redirect root /<app-name> or /<app-name>/ to /<app-name>/en to avoid 404s
  - "traefik.http.routers.<app-name>-exact.rule=Host(`loeger-os`) && (Path(`/<app-name>`) || Path(`/<app-name>/`))"
  - "traefik.http.routers.<app-name>-exact.entrypoints=web"
  - "traefik.http.routers.<app-name>-exact.middlewares=<app-name>-redirect-en"
  - "traefik.http.routers.<app-name>-exact.service=<app-name>-frontend-service"
  - "traefik.http.middlewares.<app-name>-redirect-en.redirectregex.regex=^(https?://[^/]+)/<app-name>/?$$"
  - "traefik.http.middlewares.<app-name>-redirect-en.redirectregex.replacement=$${1}/<app-name>/en"
  - "traefik.http.middlewares.<app-name>-redirect-en.redirectregex.permanent=false"
  - "traefik.http.services.<app-name>-frontend-service.loadbalancer.server.port=3000"
```

### Step 3.4: Keycloak Auth Integration
1. Ensure backend validates Keycloak JWT Bearer tokens issued at `http://loeger-os/auth`.
2. Construct or inject `UserHomeContext` containing:
   - User ID (`sub`)
   - Username (`preferred_username`)
   - Email (`email`)
   - Active household (`household_id` claim or `X-Household-ID` header fallback)
3. If specific client configurations or custom roles are required, document and update realm settings under `infrastructure/keycloak/`.

### Step 3.5: Observability & Telemetry Integration
1. Attach backend container to `observability-internal` network in `compose.yml`.
2. Set OpenTelemetry environment variables:
   ```yaml
   environment:
     - OTEL_ENABLED=true
     - OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector:4317
     - OTEL_EXPORTER_OTLP_INSECURE=true
     - OTEL_SERVICE_NAME=<app-name>-backend
   ```

---

## 6. Registering a New App in `scripts/up.sh`

Every new application **MUST** be registered as a dedicated vertical slice stage inside [`scripts/up.sh`](../scripts/up.sh) **before** the Observability stage. The pattern is strict and must not be altered.

### 6.1 Vertical Slice Pattern

Each app stage must boot its three services **strictly sequentially** (DB first, then backend, then frontend). Parallel bring-up is **forbidden** — it saturates CPU/RAM and violates dependency order.

```bash
# =============================================================================
# STAGE N — <App-Name> App Slice  (<app-name>-db → <app-name>-backend → <app-name>-frontend)
# =============================================================================
step "STAGE N · <App-Name> App Slice  (database · backend · frontend)"

info "Starting <app-name>-db …"
dc up ${BUILD_FLAG} -d <app-name>-db
wait_healthy "<app-name>-db" "<app-name>-db" 60

info "Starting <app-name>-backend …"
dc up ${BUILD_FLAG} -d <app-name>-backend
wait_healthy "<app-name>-backend" "<app-name>-backend" 180

info "Starting <app-name>-frontend …"
dc up ${BUILD_FLAG} -d <app-name>-frontend
wait_healthy "<app-name>-frontend" "<app-name>-frontend" 240

notice "🟢 <App-Name> App is live at http://loeger-os/<app-name>"
```

### 6.2 Insertion Point

Insert the new stage **immediately before** the `STAGE 6 · Observability` block. Update the stage number of the new slice and all subsequent stages accordingly:

```
STAGE 1  IAM Core
STAGE 2  Dashboard App Slice
STAGE 3  Shopping App Slice
STAGE 4  Pantry App Slice
STAGE 5  Maintenance App Slice
STAGE N  <New App> App Slice    ← insert here
STAGE N+1  Observability
STAGE N+2  Summary
```

Also update the **pipeline comment block** at the top of `up.sh` to include the new stage in the list.

### 6.3 Timeout Guidelines

| Service type | Recommended timeout |
|---|---|
| Database (`-db`) | `60` s |
| Backend (`-backend`) | `180` s |
| Frontend (`-frontend`, Next.js build) | `240` s |

### 6.4 Summary Block

Add a URL line to the `STAGE 7 · Summary` block:

```bash
echo -e "  ${GREEN}✔${RESET}  <App-Name>  →  ${BOLD}http://loeger-os/<app-name>${RESET}"
```

---

## 4. Agent Checklist

An AI agent creating a new application must execute the following checklist step-by-step:

- [ ] **Directory Scaffolding**: Create `apps/<app-name>/` with `backend/` and `frontend/` subdirectories following Feature-Driven Design.
- [ ] **Backend Implementation**:
  - [ ] Initialize package/dependency manifest (`pyproject.toml`, `go.mod`, or `package.json`).
  - [ ] Implement `src/core/config.py` and `src/core/database.py`.
  - [ ] Implement `src/core/dependencies.py` with `UserHomeContext` JWT validation.
  - [ ] Create initial feature module under `src/features/<domain>/` (models, schemas, service, router).
  - [ ] Add `/api/v1/health` endpoint in `src/main.py`.
  - [ ] Write backend `Dockerfile` with healthcheck compatibility.
- [ ] **Frontend Implementation**:
  - [ ] Initialize Next.js 15 app in `frontend/` with `package.json` and `tsconfig.json`.
  - [ ] Configure `next.config.ts` (set `output: "standalone"` and `basePath: '/<app-name>'`).
  - [ ] Setup `src/lib/api.ts` HTTP client pointing to `/api/v1/<app-name>`.
  - [ ] Implement i18n layout and default page in `src/app/[locale]/`.
  - [ ] Build initial feature component under `src/features/<domain>/`.
  - [ ] Write frontend `Dockerfile`.
- [ ] **Orchestration & Registration**:
  - [ ] Create `apps/<app-name>/compose.yml` with DB, backend, and frontend services.
  - [ ] Add Traefik labels for API prefix `/api/v1/<app-name>` and frontend `/<app-name>`.
  - [ ] Include `./apps/<app-name>/compose.yml` in root `compose.yaml`.
  - [ ] Register a new vertical slice stage in `scripts/up.sh` following the pattern in **Section 6** (DB → Backend → Frontend, with `notice "🟢 <App-Name> App is live"` at the end).
  - [ ] Create `.env.example` in `apps/<app-name>/`.
- [ ] **Quality Verification**:
  - [ ] Validate type checking & compilation (`pnpm build` / backend build test).
  - [ ] Ensure NO empty files, stubs, or `@ts-ignore` comments remain.
  - [ ] Verify `compose.yaml` syntax with `docker compose config` if accessible.
- [ ] **Documentation**:
  - [ ] Update `ai/ARCHITECTURE.md` service map and Traefik routing table with the new application details.
