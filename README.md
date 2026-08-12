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
│   │   ├── compose.yml        # Caddy container definition
│   │   └── Caddyfile          # Dual-domain routing, CORS, and path stripping rules
│   ├── keycloak/               # Keycloak config & realm import files
│   └── postgres-iam/           # IAM postgres database config files
└── apps/
    ├── dashboard/              # Central Dashboard Module
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

### B. Network Topology
All services communicating across domain bounds join a unified Docker bridge network named `public-ingress`.
* **Zero Host Port Exposure**: Application containers do not expose internal high ports (3000, 8000, 8080) directly to the host machine.
* **Caddy Ingress Gateway**: Caddy listens on port `80` and `443`, proxying host requests to internal Docker containers using service names.

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
