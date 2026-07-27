# Loeger-OS — Architecture Reference (`ai/ARCHITECTURE.md`)

> **Audience**: AI coding agents and senior engineers onboarding to this monorepo.
> Read this document alongside [`CORE.md`](./CORE.md) and the relevant stack guide in [`stacks/`](./stacks/).

---

## 1. Monorepo Layout

```text
loeger-os/
├── compose.yaml                   # Root orchestrator — includes all sub-stacks via `include:`
├── infrastructure/                # IAM and reverse-proxy layer
│   ├── compose.yml                # postgres-iam · keycloak · traefik
│   ├── keycloak/                  # Keycloak realm JSON + env
│   └── postgres-iam/              # Postgres data volume + env
│
├── apps/
│   ├── dashboard/                 # Central home dashboard
│   │   ├── backend/               # Go (Golang) microservice — REST API
│   │   ├── frontend/              # Next.js 15 frontend
│   │   └── compose.yml
│   ├── pantry/                    # Household inventory management
│   │   ├── backend/               # Python / FastAPI microservice
│   │   ├── frontend/              # Next.js 15 frontend
│   │   └── compose.yml
│   ├── shopping/                  # Collaborative shopping lists
│   │   ├── backend/               # Python / FastAPI microservice
│   │   ├── frontend/              # Next.js 15 frontend (pnpm workspace: shopping-frontend)
│   │   └── compose.yml
│   ├── maintenance/               # Maintenance & task tracking
│   │   ├── backend/               # Python / FastAPI microservice
│   │   ├── frontend/              # Next.js 15 frontend
│   │   └── compose.yml
│   └── logging-stack/             # SigNoz observability stack
│       └── compose.yml
│
├── packages/                      # Shared pnpm workspace packages
│   └── shared/                    # @loeger-os/shared — auth controls, theme, nav components
│
├── scripts/
│   └── up.sh                      # Sequential staged boot orchestrator (see §5)
│
└── ai/                            # AI agent documentation (this directory)
    ├── README.md
    ├── CORE.md                    # Universal coding standards
    ├── ARCHITECTURE.md            # This file
    ├── CONTEXT.md                 # Sprint state, DB invariants, feature flags
    └── stacks/                    # Per-technology stack guides
```

---

## 2. Docker Services Map

| Service | Container Name | Image / Build | Exposed Port | Network(s) |
|---|---|---|---|---|
| `postgres-iam` | `loeger_postgres_iam` | `postgres:16-alpine` | internal | `iam_network` |
| `keycloak` | `loeger_keycloak` | `keycloak:24.0.4` | via Traefik | `iam_network`, `public-ingress` |
| `traefik` | `loeger_traefik` | `traefik:v3.6.1` | `80`, `8080` | `public-ingress` |
| `dashboard-db` | `dashboard-db` | `postgres:16-alpine` | internal | `dashboard-internal` |
| `dashboard-backend` | `dashboard-backend` | Build `./apps/dashboard/backend` | via Traefik | `public-ingress`, `dashboard-internal` |
| `dashboard-frontend` | `dashboard-frontend` | Build `apps/dashboard/frontend/Dockerfile` | via Traefik | `public-ingress` |
| `pantry-db` | `pantry-db` | `postgres:16-alpine` | `5432` | `pantry-internal` |
| `pantry-backend` | `pantry-backend` | Build `./apps/pantry/backend` | via Traefik | `public-ingress`, `pantry-internal`, `shopping-internal`, `observability-internal` |
| `pantry-frontend` | `pantry-frontend` | Build `apps/pantry/frontend/Dockerfile` | via Traefik | `public-ingress` |
| `shopping-db` | `shopping-db` | `postgres:16-alpine` | `5433` | `shopping-internal` |
| `shopping-backend` | `shopping-backend` | Build `./apps/shopping/backend` | via Traefik | `public-ingress`, `shopping-internal`, `observability-internal` |
| `shopping-frontend` | `shopping-frontend` | Build `apps/shopping/frontend/Dockerfile` | via Traefik | `public-ingress` |
| `maintenance-db` | `maintenance-db` | `postgres:16-alpine` | internal | `maintenance-internal` |
| `maintenance-backend` | `maintenance-backend` | Build `./apps/maintenance/backend` | via Traefik | `public-ingress`, `maintenance-internal`, `observability-internal` |
| `maintenance-frontend` | `maintenance-frontend` | Build `apps/maintenance/frontend/Dockerfile` | via Traefik | `public-ingress` |
| `signoz-clickhouse` | `signoz-clickhouse` | `clickhouse:24.3-alpine` | internal | `observability-internal` |
| `signoz-otel-collector` | `signoz-otel-collector` | `signoz-otel-collector:0.102.0` | internal | `observability-internal` |
| `signoz` | `signoz-ui` | `signoz:v0.133.0` | via Traefik | `observability-internal`, `public-ingress` |
| `vector` | `vector-shipper` | `vector:0.39.0-alpine` | internal | `observability-internal` |

### Docker Networks

| Network | Owner | Purpose |
|---|---|---|
| `public-ingress` | `infrastructure/compose.yml` | All services exposed through Traefik |
| `iam_network` | `infrastructure/compose.yml` | Internal Keycloak ↔ postgres-iam |
| `pantry-internal` | `apps/pantry/compose.yml` | Pantry backend ↔ pantry-db |
| `shopping-internal` | `apps/shopping/compose.yml` | Shopping backend ↔ shopping-db; also joined by pantry-backend |
| `dashboard-internal` | `apps/dashboard/compose.yml` | Dashboard backend ↔ dashboard-db |
| `maintenance-internal` | `apps/maintenance/compose.yml` | Maintenance backend ↔ maintenance-db |
| `observability-internal` | `apps/logging-stack/compose.yml` | Backends → OtelCollector → ClickHouse |

> **Ownership rule**: The network owner's compose file declares it without `external: true`. All other composes that join it must declare it with `external: true`. Never redefine an external network as non-external — this will corrupt the network graph.

---

## 3. Traefik Ingress Routing

All HTTP traffic enters on port `80` via Traefik's `web` entrypoint. Traefik reads routing rules from Docker container labels.

| Path Prefix | Service | Notes |
|---|---|---|
| `/` | `dashboard-frontend` | Catch-all, priority 1 |
| `/auth` | `keycloak` | Keycloak OIDC — `KC_HTTP_RELATIVE_PATH=/auth` |
| `/api/v1/apps`, `/api/v1/profile`, `/api/v1/households`, `/api/v1/telemetry` | `dashboard-backend` | Direct routing |
| `/api/v1/pantry` | `pantry-backend` | Path-strip middleware removes `/api/v1/pantry` prefix |
| `/pantry` | `pantry-frontend` | `/pantry` and `/pantry/` redirect → `/pantry/en` |
| `/api/v1/shopping` | `shopping-backend` | Path-strip middleware removes `/api/v1/shopping` prefix |
| `/shopping` | `shopping-frontend` | `/shopping` and `/shopping/` redirect → `/shopping/en` |
| `/api/v1/maintenance` | `maintenance-backend` | Path-strip middleware removes `/api/v1/maintenance` prefix |
| `/maintenance` | `maintenance-frontend` | `/maintenance` and `/maintenance/` redirect → `/maintenance/en` |
| `/signoz` | `signoz-ui` | Observability dashboard |

**Header limits**: Traefik is configured with `--entrypoints.web.http.maxHeaderBytes=1048576` (1 MiB). All Next.js containers also set `NODE_OPTIONS=--max-http-header-size=65536`.

---

## 4. Keycloak JWT Claims

All backend services authenticate requests via JWT tokens issued by Keycloak at `http://loeger-os/auth`.

**Standard claims used by backends:**

| Claim | Key in JWT | Usage |
|---|---|---|
| User UUID | `sub` | Converted to `uuid.UUID` via `uuid.UUID(sub)` or `uuid.uuid5(NAMESPACE_DNS, sub)` |
| Username | `preferred_username` | Used for Personal List naming: `"{username} - Liste"` |
| Email | `email` | Stored in `UserHomeContext.email` |
| Active household | `household_id` or `active_household_id` | Falls back to `X-Household-ID` header, then mock UUID |
| Roles | `realm_access.roles[]` | Authorization gates |

**`UserHomeContext`** (from `src/core/dependencies.py`) is the single dependency that encapsulates the above into a typed context object injected into every authenticated route.

---

## 5. Inter-Service APIs

### Pantry → Shopping (item push)

```
POST /api/v1/shopping/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Milch",
  "brand": "Weihenstephan",
  "quantity": 2.0,
  "unit": "l",
  "product_id": "<uuid>",
  "list_id": null        # null → lands in the Household List (is_default=True)
}
```

### Shopping → Pantry (bulk sync)

```
POST /api/v1/shopping-lists/{list_id}/sync-to-pantry
Authorization: Bearer <token>
```

Triggers `PantryClient.bulk_add_items()`. Returns `SyncToPantryResponse` with counts of successful and unrecognized items.

---

## 6. Frontend Architecture (Next.js 15)

All Next.js frontends follow a shared pattern:

- **`/src/app/[locale]/`** — localized layout + page components
- **`/src/features/<domain>/`** — feature modules (components, services, schemas, types)
- **`/src/lib/`** — shared utilities (`api.ts` → ky clients, `utils.ts` → cn helper)
- **`/src/components/shared/`** — cross-feature presentational primitives
- **`next-intl`** — i18n routing via `[locale]` segment
- **`@tanstack/react-query`** — server-state management and optimistic updates
- **`ky`** — typed HTTP client (via `shoppingClient`, `pantryClient` wrappers)
- **`zod`** — runtime schema validation on all API responses

### Shopping Frontend: List Visibility Rules

| List Type | `is_personal` | `is_default` | Deletable | Icon |
|---|---|---|---|---|
| Personal List (`{username} - Liste`) | `true` | `false` | ❌ | `<User />` (blue) |
| Household List (`Haushalt`) | `false` | `true` | ❌ | `<Home />` (emerald) |
| User-created custom list | `false` | `false` | ✅ | — |

The `resolvedListId` pattern in `page.tsx` guarantees a valid list is selected on the first render frame using `useMemo`, eliminating the blank-screen flash caused by async `useEffect` selection.

---

## 7. Database Strategy (Shopping Backend)

- **ORM**: SQLModel (Pydantic + SQLAlchemy async)
- **Engine**: `asyncpg` driver via `create_async_engine`
- **Migrations**: **No Alembic** — `SQLModel.metadata.create_all` is called at startup via `init_db()` in `lifespan`. New columns with `server_default` are safe to add and will appear on fresh database creation. For existing databases, a manual `ALTER TABLE` is required (see `CONTEXT.md`).
- **Session**: `async_sessionmaker` injected per-request via `get_db_session()` FastAPI dependency.
