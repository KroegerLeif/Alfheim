# loeger-os: Platform Architecture & Orchestration

This is the central orchestration repository for `loeger-os`, managing common infrastructure (identity provider, gateway proxy, databases) and micro-applications (such as the Digital Pantry module).

---

## 1. Directory Structure & Compose Layout

The platform uses a modular, multi-compose architecture using the native Compose `include:` directive.

```
loeger-os/
├── compose.yaml                # Platform Master Orchestrator
├── .env.example                # Central environment configuration template
├── README.md                   # Platform setup and verification guide
├── infrastructure/             # Platform Infrastructure Services
│   ├── compose.yml            # Keycloak IAM, database, and Nginx gateway
│   ├── gateway/
│   │   └── nginx.conf         # Central Nginx gateway configuration
│   ├── keycloak/               # Keycloak config files
│   └── postgres-iam/           # IAM postgres database config files
└── apps/
    └── pantry/                 # Completed Digital Pantry Module
        ├── compose.yml        # Pantry frontend, backend, and pantry database
        ├── frontend/           # Next.js standalone container
        └── backend/            # FastAPI application
```

---

## 2. Network & Proxy Routing Architecture

### A. Network Topology
All services communicating across domain bounds join a unified external-ready Docker bridge network named `loeger-os-network`.
* **Zero Port Exposure**: Application containers (`pantry-frontend`, `pantry-backend`, `keycloak`) do not expose high ports to the host machine.
* **DNS Resolution**: Services securely resolve each other internally using service names (e.g. `http://keycloak:8080/auth`).

### B. Routing Matrix (Central Nginx Gateway)
The `gateway` service runs Nginx on port `80` and acts as the central router for the host machine:

| Path | Destination Service | Internal Destination URL | Notes |
| :--- | :--- | :--- | :--- |
| `http://localhost/pantry` | `pantry-frontend` | `http://pantry-frontend:3000` | Served on `/pantry` basePath |
| `http://localhost/pantry/api/` | `pantry-backend` | `http://pantry-backend:8000/` | Proxies API endpoints & docs |
| `http://localhost/auth/` | `keycloak` | `http://keycloak:8080/auth/` | Central IAM provider |

---

## 3. Environment Variable Configuration

Prior to starting the platform, configure the required environment variables:

1. **Root Configuration**: Copy the template from `.env.example` at the root and fill in the values:
   ```bash
   cp .env.example .env
   ```
2. **Module Configurations**: Make sure the local configurations for individual components are copied and initialized:
   * **PostgreSQL IAM**: `cp infrastructure/postgres-iam/.env.example infrastructure/postgres-iam/.env`
   * **Keycloak**: `cp infrastructure/keycloak/.env.example infrastructure/keycloak/.env`
   * **Pantry Module**: `cp apps/pantry/.env.example apps/pantry/.env`

---

## 4. Spin Up the System

To build and spin up all containers (infrastructure + applications) in detached mode, run from the repository root:

```bash
docker compose up --build -d
```

To tear down the cluster and preserve database volumes:
```bash
docker compose down
```

To tear down the cluster and clean up all volumes:
```bash
docker compose down -v
```

---

## 5. Verification Guide

Once the system is running, check the state of the cluster with these steps:

### A. Verify Container State
Run the following command to check if all containers are healthy:
```bash
docker compose ps
```
You should see:
* `loeger_gateway` - Up (healthy)
* `loeger_keycloak` - Up (healthy)
* `loeger_postgres_iam` - Up (healthy)
* `pantry-frontend` - Up (healthy)
* `pantry-backend` - Up (healthy)
* `pantry-db` - Up (healthy)

### B. Verify Endpoints (Host Machine)
Verify HTTP routing and responses using browser or `curl`:

1. **Frontend Landing Page**:
   ```bash
   curl -I http://localhost/pantry
   ```
   *Expected*: HTTP `200 OK` or redirect to `/pantry/en` (if using next-intl localized paths).

2. **Backend API Health Check**:
   ```bash
   curl http://localhost/pantry/api/health
   ```
   *Expected*: `{"status":"ok","project":"Digital Pantry"}`.

3. **Backend Swagger API Documentation**:
   Access `http://localhost/pantry/api/docs` in your browser.
   *Expected*: FastAPI Swagger UI dashboard displaying all available endpoints.

4. **Keycloak IAM Landing Page**:
   Access `http://localhost/auth/` in your browser.
   *Expected*: Keycloak welcome screen where you can click "Administration Console".
