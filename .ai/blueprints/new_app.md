# Blueprint: New Application Setup & Routing (`.ai/blueprints/new_app.md`)

This blueprint defines the mandatory architecture, directory layout, core configurations, and integration workflows required to introduce a new application or service into the `alfheim` monorepo.

---

## 1. Directory Structure & Feature-Driven Design (FDD)

Every application inside `apps/<app-name>/` follows Feature-Driven Design (FDD). Business logic, components, and data structures are grouped around domain modules rather than technical layers.

> [!IMPORTANT]
> **Next.js 16+ Proxy Convention**: Always use `src/proxy.ts` for route/auth proxy handling. The legacy `src/middleware.ts` convention is deprecated in Next.js 16 and must **NOT** be used.

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
└── frontend/                          # Frontend Web Application (Next.js 16 + React Query)
    ├── Dockerfile                     # Containerization setup for standalone Next.js build
    ├── package.json                   # Frontend dependencies (pnpm workspace member)
    ├── tsconfig.json                  # Strict TypeScript configuration
    ├── next.config.ts                 # Next.js config (basePath, transpilePackages: ["@alfheim/shared"], output: standalone)
    ├── postcss.config.mjs             # PostCSS / Tailwind CSS setup
    └── src/
        ├── proxy.ts                   # Next.js 16 proxy convention for routing & auth (replaces middleware.ts)
        ├── i18n.ts                    # next-intl configuration merging shared locales from @alfheim/shared
        ├── navigation.ts              # Locale navigation helpers (de, en, pl)
        ├── app/
        │   └── [locale]/              # Localized pages & layouts (de, en, pl)
        │       ├── layout.tsx         # Root layout with QueryClient, Theme & Language Providers
        │       └── page.tsx           # Application entry page
        ├── features/                  # Feature-Driven UI Modules (FDD)
        │   └── <feature_name>/        # Domain components, hooks & state
        │       ├── components/        # Feature UI components
        │       ├── api/               # API mutation & query hooks (React Query + Ky)
        │       └── types/             # Domain TypeScript types & Zod schemas
        ├── lib/                       # HTTP clients & utilities (ky instances, cn helper)
        └── components/
            └── shared/                # Cross-feature UI components
```

---

## 2. Required Core Files

When initializing a new app, the following files **MUST** be explicitly created and fully implemented:

### Monorepo & Root Configuration
* **`apps/<app-name>/compose.yml`**: Declares databases, microservices, frontend services, health checks, network configurations, and Traefik rules.
* **`apps/<app-name>/.env.example`**: Local environment variables configuration.

### Backend Core (Python / FastAPI Example)
* **`backend/Dockerfile`**: Production multi-stage Docker build file.
* **`backend/pyproject.toml`** (or package dependency manifest): Configured dependency list.
* **`backend/src/main.py`**: Expresses HTTP lifespan, middleware, CORS, routers, and healthcheck route at `/api/v1/health`.
* **`backend/src/core/config.py`**: Environment configuration loader.
* **`backend/src/core/database.py`**: Async database connection pool & session manager.
* **`backend/src/core/dependencies.py`**: Parsers for Keycloak JWT tokens converting them into `UserHomeContext`.

### Frontend Core
* **`frontend/Dockerfile`**: Standalone build configuration matching `"standalone"` output mode.
* **`frontend/package.json`**: Set with `"@alfheim/shared": "workspace:*"` dependency.
* **`frontend/next.config.ts`**: Configured with `basePath: '/<app-name>'`, standalone build output, and `@alfheim/shared` transpiling.
* **`frontend/src/proxy.ts`**: Next.js 16 proxy file for localized path routing.
* **`frontend/src/i18n.ts`**: Merges global locales from `@alfheim/shared` via `getSharedMessages(locale)`.
* **`frontend/src/lib/api.ts`**: Typed `ky` HTTP client configured for API requests.

---

## 3. Network & Ingress Routing

### 3.1 Network Architecture
All microservices and frontends needing external exposure must connect to the global `public-ingress` Docker bridge network.
App-internal networks (e.g. database connections) are owned by the local compose stack.

```yaml
networks:
  public-ingress:
    name: public-ingress
    external: true
  app-internal:
    name: app-internal
```

### 3.2 Caddy Ingress Gateway Rules in `infrastructure/caddy/Caddyfile`

Register the new microservice inside `infrastructure/caddy/Caddyfile`:

#### Frontend Services (Exposed on `alfheim.loegien.de/<app-name>`)
```caddy
http://alfheim.loegien.de, http://alfheim.loegien.localhost {
	redir /app-name /app-name/en 302
	redir /app-name/ /app-name/en 302

	handle /app-name* {
		reverse_proxy app-frontend:3000
	}
}
```

#### Backend Services (Exposed on `api.alfheim.loegien.de/<app-name>/api/v1`)
If the backend requires path stripping so FastAPI receives `/api/v1/...`, use `handle_path`:
```caddy
http://api.alfheim.loegien.de, http://api.alfheim.loegien.localhost {
	handle_path /app-name* {
		reverse_proxy app-backend:8000
	}
}
```
      rule: "Host(`alfheim`) && PathPrefix(`/external-path`)"
      service: external-service
      entryPoints:
        - web
      middlewares:
        - security-headers

  services:
    external-service:
      loadBalancer:
        servers:
          - url: "http://192.168.1.100:9000"
```

---

## 4. Keycloak & Auth Integration

1. **Frontend Registration**:
   * Create a client named `<app-name>-frontend` inside the `alfheim` realm.
   * Access Type: `Public` (Standard Authorization Flow, PKCE enabled).
   * Valid Redirect URIs: `http://alfheim/<app-name>/*`
   * Web Origins: `*`
2. **Backend JWT Verification**:
   * Set configuration values in environment variables:
     ```env
     KEYCLOAK_BASE_URL=http://keycloak:8080/auth
     KEYCLOAK_REALM=alfheim
     ```
   * JWKS verification coordinates with Keycloak certs route:
     `http://keycloak:8080/auth/realms/alfheim/protocol/openid-connect/certs`

---

## 5. Observability & Telemetry

1. Connect backend containers to `observability-internal` network.
2. Register environment variables:
   ```yaml
   environment:
     - OTEL_ENABLED=true
     - OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector:4317
     - OTEL_EXPORTER_OTLP_INSECURE=true
     - OTEL_SERVICE_NAME=<app-name>-backend
   ```

---

## 6. Centralized i18n & Shared Theme Engine Integration

### 6.1 Centralized i18n System
* Translate all strings inside `@alfheim/shared` locales: `packages/shared/src/i18n/locales/{de,en,pl}/<app-name>.json`.
* Register the translation files in `packages/shared/src/i18n/locales.ts` to include them in the `getSharedMessages(locale)` builder.
* All three supported locales (**German (`de`)**, **English (`en`)**, **Polish (`pl`)**) must be populated. German acts as the canonical fallback.

### 6.2 Design System Compliance
* Components MUST consume design tokens from `@alfheim/shared` CSS variables (e.g. `var(--primary-main)`, `var(--surface-canvas)`). Never hardcode hex values.
* Mount `ThemeProvider` at the root layout and import the shared `Header` / `ThemeToggle` elements.

---

## 7. Registering in `scripts/up.sh` (Vertical Slice Pattern)

Every new application **MUST** be registered as a dedicated vertical slice stage inside `scripts/up.sh` **before** the Observability stage. 

### 7.1 Stage Template
Boot services **strictly sequentially** to avoid resource spikes:
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

notice "🟢 <App-Name> App is live at http://alfheim/<app-name>"
```

### 7.2 Insertion Point
Insert immediately **before** the `STAGE 6 · Observability` block, updating subsequent stage numbers accordingly. Add summary logs to `STAGE 7 · Summary`:
```bash
echo -e "  ${GREEN}✔${RESET}  <App-Name>  →  ${BOLD}http://alfheim/<app-name>${RESET}"
```

---

## 8. Agent Execution Checklist

- [ ] **Scaffold folders** according to FDD boundaries under `apps/<app-name>/`.
- [ ] **Implement Backend**: Dockerfile, pyproject.toml/go.mod, main router, config engine, database module, auth verification contexts, and `/api/v1/health` endpoint.
- [ ] **Implement Frontend**: tsconfig/package configs, `next.config.ts` (standalone mode, transpile `@alfheim/shared`), proxy setup (`src/proxy.ts`), i18n setup, API client, layout, and first page views.
- [ ] **Populate i18n**: Add translations in all 3 language JSON files under `@alfheim/shared`.
- [ ] **Register 3-Tier Dashboard Entry**:
  - For Tier 1 Core Apps: Register entry in [`tier1_core_registry.go`](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/backend/internal/features/apps/tier1_core_registry.go).
  - For Tier 2 Stack Integrations: Register entry in [`deploy/stack-apps.yaml`](file:///Users/leifkroeger/Dev/loeger-os/deploy/stack-apps.yaml).
- [ ] **Register Orchestration**: Create compose.yml, add to root compose.yaml, add stage to scripts/up.sh.
- [ ] **Quality checks**: Run TypeScript verification (`pnpm build`), check no dummy stubs or `@ts-ignore` statements exist.
