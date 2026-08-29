# alfheim: Platform Architecture & Orchestration

This is the central orchestration repository for `alfheim`, managing common infrastructure (identity provider, Caddy gateway proxy, databases) and micro-applications (such as Digital Pantry, Shopping, Chores, Maintenance, and Dashboard modules).

---

## 1. Directory Structure & Compose Layout

The platform uses a modular, multi-compose architecture using the native Compose `include:` directive.

```
alfheim/
├── compose.yaml                # Platform Master Orchestrator
├── .env.example                # Central environment configuration template
├── README.md                   # Platform setup and verification guide
├── infrastructure/             # Platform Infrastructure Services
│   ├── caddy/                  # Central Caddy Reverse Proxy & Ingress Gateway
│   ├── keycloak/               # Keycloak config & realm import files
│   ├── postgres-iam/           # IAM postgres database config files
│   ├── rustfs/                 # RustFS S3-compatible central object storage
│   └── telemetry/              # VictoriaStack, OTel Collector, Vector & Grafana
├── core/
│   └── dashboard/              # Central Dashboard Module (Go control plane & Next.js frontend)
└── apps/
    ├── pantry/                 # Digital Pantry Module
    ├── shopping/               # Shopping List Module
    ├── maintenance/            # Home Maintenance Tracker Module
    ├── chores/                 # Household Chores Module
    ├── chat/                   # ALFI Assistant & Chat Module
    └── workout/                # Workout Tracker Module
```

---

## 2. Network & Proxy Routing Architecture

### A. Local Domain Resolution
We utilize a dual-domain strategy for platform routing:
* **Frontend Domain**: `alfheim.loegien.de` (Development alias: `alfheim.loegien.localhost`)
* **API Gateway Domain**: `api.alfheim.loegien.de` (Development alias: `api.alfheim.loegien.localhost`)

To resolve these local domains on your development machine, add the following lines to your local hosts file (e.g., `/etc/hosts` on MacOS/Linux, or `C:\Windows\System32\drivers\etc\hosts` on Windows):

```hosts
127.0.0.1 alfheim.loegien.localhost
127.0.0.1 api.alfheim.loegien.localhost
```

### B. Network Topology & Multi-Zone Segmentation
The platform enforces strict multi-zone network isolation across Docker bridge networks:
* **`gateway-net`**: Connects Caddy ingress gateway to frontends, Keycloak, RustFS S3, and backend API endpoints.
* **`infra-net`**: Isolated infrastructure bridge connecting Keycloak, `postgres-iam`, and RustFS S3 backend ports.
* **`core-net`**: Dedicated control plane network for `dashboard-backend` and `dashboard-db`.
* **`app-<name>-net`**: App-isolated networks connecting microservice backends to their dedicated database containers (e.g. `app-pantry-net`, `app-shopping-net`, `app-chat-net`, `app-workout-net`).
* **`observability-internal`**: Dedicated telemetry bridge connecting app backends and Vector to OpenTelemetry Collector and VictoriaStack.

### C. Routing Matrix (Central Caddy Gateway)

#### 1. Frontend Domain (`alfheim.loegien.localhost` / `alfheim.loegien.de`)

| Public URL | Destination Service | Internal Destination URL | Notes |
| :--- | :--- | :--- | :--- |
| `http://alfheim.loegien.localhost/` | `dashboard-frontend` | `http://dashboard-frontend:3000` | Root landing page and control plane |
| `http://alfheim.loegien.localhost/pantry` | `pantry-frontend` | `http://pantry-frontend:3000` | Served on `/pantry` basePath, 302 redirects bare path to `/pantry/en` |
| `http://alfheim.loegien.localhost/shopping` | `shopping-frontend` | `http://shopping-frontend:3010` | Served on `/shopping` basePath, 302 redirects bare path to `/shopping/en` |
| `http://alfheim.loegien.localhost/maintenance`| `maintenance-frontend`| `http://maintenance-frontend:3000`| Served on `/maintenance` basePath, 302 redirects bare path to `/maintenance/en` |
| `http://alfheim.loegien.localhost/chores` | `chores-frontend` | `http://chores-frontend:3000` | Served on `/chores` basePath, 302 redirects bare path to `/chores/de` |
| `http://alfheim.loegien.localhost/workout` | `workout-frontend` | `http://workout-frontend:3000` | Served on `/workout` basePath, 302 redirects bare path to `/workout/de` |
| `http://alfheim.loegien.localhost/chat` | `chat-frontend` | `http://chat-frontend:3000` | Served on `/chat` basePath, 302 redirects bare path to `/chat/de` |
| `http://alfheim.loegien.localhost/grafana` | `grafana` | `http://grafana:3000/grafana` | Observability & Telemetry UI (Keycloak SSO) |

#### 2. API Gateway Domain (`api.alfheim.loegien.localhost` / `api.alfheim.loegien.de`)

| Public URL | Destination Service | Internal Destination URL | Path Stripping & CORS Notes |
| :--- | :--- | :--- | :--- |
| `http://api.alfheim.loegien.localhost/auth` | `keycloak` | `http://keycloak:8080/auth` | OIDC IAM provider. Native subpath (no stripping). |
| `http://api.alfheim.loegien.localhost/storage/` | `rustfs` | `http://rustfs:9000/` | Central S3 object storage & presigned URLs. Strips `/storage` prefix. |
| `http://api.alfheim.loegien.localhost/grafana/` | `grafana` | `http://grafana:3000/grafana/` | Observability & Telemetry UI (Keycloak SSO). |
| `http://api.alfheim.loegien.localhost/pantry/api/v1/` | `pantry-backend` | `http://pantry-backend:8000/api/v1/` | Strips `/pantry` prefix via Caddy `handle_path`. |
| `http://api.alfheim.loegien.localhost/shopping/api/v1/`| `shopping-backend`| `http://shopping-backend:8000/api/v1/` | Strips `/shopping` prefix via Caddy `handle_path`. |
| `http://api.alfheim.loegien.localhost/maintenance/api/v1/`| `maintenance-backend`| `http://maintenance-backend:8000/api/v1/`| Strips `/maintenance` prefix via Caddy `handle_path`. |
| `http://api.alfheim.loegien.localhost/api/v1/chores` | `chores-backend` | `http://chores-backend:8000/api/v1/chores` | Native API route (no stripping). |
| `http://api.alfheim.loegien.localhost/workout/api/v1/` | `workout-backend` | `http://workout-backend:8000/api/v1/` | Strips `/workout` prefix via Caddy `handle_path`. |
| `http://api.alfheim.loegien.localhost/api/v1/chat` | `chat-backend` | `http://chat-backend:8080/api/v1/chat` | Native Go API route (no stripping). |
| `http://api.alfheim.loegien.localhost/api/v1/apps` | `dashboard-backend` | `http://dashboard-backend:8080/api/v1/apps` | Native Go API route (no stripping). |

---

## 3. Environment Variable Configuration

Prior to starting the platform, configure the required environment variables:

1. **Root Configuration**: Copy the template from `.env.example` at the root and fill in the values:
   ```bash
   cp .env.example .env
   ```
2. **Staged Boot**: Run the automated staged boot script to start all infrastructure and microservices:
   ```bash
   ./scripts/up.sh -b
   ```

---

## 4. Verification Guide

Once the system is running, check the state of the cluster with these steps:

### A. Verify Container State
Run the following command to check if all containers are healthy:
```bash
docker compose ps
```
You should see `alfheim_caddy`, `alfheim_keycloak`, `alfheim_postgres_iam`, and all module databases and application backends/frontends running cleanly.

### B. Verify Routing Endpoints
Verify HTTP routing and responses using browser or `curl`:

1. **Frontend Locale Redirect**:
   ```bash
   curl -I http://alfheim.loegien.localhost/pantry
   ```
   *Expected*: HTTP `302 Found` with `Location: /pantry/en`.

2. **Backend API Health Check (Path Stripped)**:
   ```bash
   curl http://api.alfheim.loegien.localhost/pantry/api/v1/health
   ```
   *Expected*: `{"status":"ok","project":"Digital Pantry"}`.

3. **Backend Swagger API Documentation**:
   Access `http://api.alfheim.loegien.localhost/pantry/docs` in your browser.

4. **Keycloak IAM Landing Page**:
   Access `http://api.alfheim.loegien.localhost/auth/` in your browser.

---

## 5. Design System & Unified Theme Engine (`@alfheim/shared`)

The monorepo shares a centralized design system and dynamic theme engine through the `@alfheim/shared` package:

* **Default Variant**: **`nordic` (Nordic Dark)** — Featuring Deep Frost Slate canvas with radiant Mint and Cyan aurora accents.
* **Available Themes**: `nordic`, `obsidian`, `kinetic`, `slate`, and user-configurable `custom` themes with live color swatches and localStorage presets.
* **CSS Ingestion**: All micro-frontends import centralized Tailwind CSS v4 design tokens and `:root` variables via `@import "@alfheim/shared/styles/theme.css";`.
* **Dynamic Theme Propagation**: Micro-frontends initialize `<ThemeProvider defaultMode="dark" defaultVariant="nordic">` to guarantee zero theme flickering across subpaths.

---

## 6. Internationalization (i18n)

* **Supported Locales**: English (`en`), German (`de`), and Polish (`pl`).
* **Dictionary Architecture**: Centralized JSON dictionaries stored in `packages/shared/src/features/i18n/locales/{en,de,pl}/` covering `common`, `dashboard`, `pantry`, `shopping`, `maintenance`, `chores`, and `docs`.
* **Route Resolution**: Micro-frontends enforce localized subpath routing (e.g. `/pantry/en`, `/shopping/de`, `/chores/pl`).

---

## 7. Security & Keycloak OIDC Token Verification

* **Public Issuer URL**: `http://api.alfheim.loegien.localhost/auth/realms/alfheim`
* **Internal Docker JWKS**: `http://keycloak:8080/auth/realms/alfheim/protocol/openid-connect/certs`
* **Token Verification Policy**: Frontends exchange authorization codes via PKCE (S256). All microservice backends (Go & Python FastAPI) fetch JWKS public keys internally via container networking while enforcing strict issuer signature verification against `http://api.alfheim.loegien.localhost/auth/realms/alfheim`.

---

## 6. Python Developer Tooling, Quality Gates & Testing

The Python FastAPI microservices (`apps/pantry/backend`, `apps/shopping/backend`, `apps/maintenance/backend`, `apps/chores/backend`, `apps/workout/backend`) are organized as a unified **`uv` workspace**.

### A. Environment Setup & Workspace Sync
Install `uv` (>= 0.12+) and sync all workspace members from the repository root:
```bash
uv sync --all-packages --all-groups
```

### B. Code Quality, Linting & Formatting (Ruff)
Run Ruff across the entire monorepo:
```bash
# Run linter
uv run ruff check .

# Run auto-fixing
uv run ruff check --fix .

# Verify formatting
uv run ruff format --check .

# Apply formatting
uv run ruff format .
```

### C. Git Pre-Commit Hooks
Install and run pre-commit hooks locally:
```bash
uv run pre-commit install
uv run pre-commit run --all-files
```

### D. Automated Test Suite (Pytest & Coverage)
Execute tests per microservice or across the workspace using in-memory SQLite transactions:
```bash
# Pantry backend tests
cd apps/pantry/backend && uv run pytest --cov

# Shopping backend tests
cd apps/shopping/backend && uv run pytest --cov

# Maintenance backend tests
cd apps/maintenance/backend && uv run pytest --cov

# Chores backend tests
cd apps/chores/backend && uv run pytest --cov

# Workout backend tests
cd apps/workout/backend && uv run pytest --cov
```
