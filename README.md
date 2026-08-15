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
│   └── rustfs/                 # RustFS S3-compatible central object storage
├── core/
│   └── dashboard/              # Central Dashboard Module (Go control plane & Next.js frontend)
└── apps/
    ├── pantry/                 # Digital Pantry Module
    ├── shopping/               # Shopping List Module
    ├── maintenance/            # Home Maintenance Tracker Module
    └── chores/                 # Household Chores Module
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
* **`app-<name>-net`**: App-isolated networks connecting microservice backends to their dedicated database containers (e.g. `app-pantry-net`, `app-shopping-net`).
* **`observability-internal`**: Dedicated telemetry bridge connecting app backends to the SigNoz OpenTelemetry Collector.

### C. Routing Matrix (Central Caddy Gateway)

#### 1. Frontend Domain (`alfheim.loegien.localhost` / `alfheim.loegien.de`)

| Public URL | Destination Service | Internal Destination URL | Notes |
| :--- | :--- | :--- | :--- |
| `http://alfheim.loegien.localhost/` | `dashboard-frontend` | `http://dashboard-frontend:3000` | Root landing page and control plane |
| `http://alfheim.loegien.localhost/pantry` | `pantry-frontend` | `http://pantry-frontend:3000` | Served on `/pantry` basePath, 302 redirects bare path to `/pantry/en` |
| `http://alfheim.loegien.localhost/shopping` | `shopping-frontend` | `http://shopping-frontend:3010` | Served on `/shopping` basePath, 302 redirects bare path to `/shopping/en` |
| `http://alfheim.loegien.localhost/maintenance`| `maintenance-frontend`| `http://maintenance-frontend:3000`| Served on `/maintenance` basePath, 302 redirects bare path to `/maintenance/en` |
| `http://alfheim.loegien.localhost/chores` | `chores-frontend` | `http://chores-frontend:3000` | Served on `/chores` basePath, 302 redirects bare path to `/chores/de` |

#### 2. API Gateway Domain (`api.alfheim.loegien.localhost` / `api.alfheim.loegien.de`)

| Public URL | Destination Service | Internal Destination URL | Path Stripping & CORS Notes |
| :--- | :--- | :--- | :--- |
| `http://api.alfheim.loegien.localhost/auth` | `keycloak` | `http://keycloak:8080/auth` | OIDC IAM provider. Native subpath (no stripping). |
| `http://api.alfheim.loegien.localhost/storage/` | `rustfs` | `http://rustfs:9000/` | Central S3 object storage & presigned URLs. Strips `/storage` prefix. |
| `http://api.alfheim.loegien.localhost/pantry/api/v1/` | `pantry-backend` | `http://pantry-backend:8000/api/v1/` | Strips `/pantry` prefix via Caddy `handle_path`. |
| `http://api.alfheim.loegien.localhost/shopping/api/v1/`| `shopping-backend`| `http://shopping-backend:8000/api/v1/` | Strips `/shopping` prefix via Caddy `handle_path`. |
| `http://api.alfheim.loegien.localhost/maintenance/api/v1/`| `maintenance-backend`| `http://maintenance-backend:8000/api/v1/`| Strips `/maintenance` prefix via Caddy `handle_path`. |
| `http://api.alfheim.loegien.localhost/api/v1/chores` | `chores-backend` | `http://chores-backend:8000/api/v1/chores` | Native API route (no stripping). |
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

* **Token Verification Policy**: Frontends exchange authorization codes via PKCE (S256). All microservice backends (Go & Python FastAPI) fetch JWKS public keys internally via container networking while enforcing strict issuer signature verification against `http://api.alfheim.loegien.localhost/auth/realms/alfheim`.

---

## 8. Code Quality, Python Tooling & CI/CD Pipeline

The monorepo enforces automated code quality checks, pre-commit hygiene, and test coverage across all Python FastAPI services:

### A. Pre-commit Hooks & Ruff Formatting
A centralized [`.pre-commit-config.yaml`](file:///Users/leifkroeger/Dev/loeger-os/.pre-commit-config.yaml) and [`ruff.toml`](file:///Users/leifkroeger/Dev/loeger-os/ruff.toml) govern all microservices:
* **Install Git Hooks**:
  ```bash
  pre-commit install
  ```
* **Run Linter Across Services**:
  ```bash
  uv run ruff check .
  ```
* **Format Python Codebase**:
  ```bash
  uv run ruff format .
  ```

### B. Automated Testing with Pytest
Run test suites per-service or across the entire monorepo:
* **All-in-One Monorepo Test Runner**:
  ```bash
  ./scripts/test-all-backends.sh
  ```
* **Per-Service Test Run**:
  ```bash
  # Inside any backend directory (e.g. apps/pantry/backend)
  uv run pytest --cov=src --cov-report=term-missing
  ```

### C. GitHub Actions CI Matrix
The pipeline defined in [`.github/workflows/ci-backend.yml`](file:///Users/leifkroeger/Dev/loeger-os/.github/workflows/ci-backend.yml) runs matrix validation (`ruff check`, `ruff format --check`, `pytest`) on all 4 backends on every push and PR.



