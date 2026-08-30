# Alfheim - Deployment Readiness Audit (v0.1.0 Roadmap)

## 1. Executive Summary
This audit provides a comprehensive evaluation of the **Alfheim** homelab microservice monorepo to assess readiness for `v0.1.0-alpha` local server deployment. Alfheim consists of a Go control plane, multiple Python FastAPI microservices (Pantry, Shopping, Maintenance, Chores, Workout, Library, Budget), a Go Chat service, React/Next.js frontends, Keycloak IAM, RustFS S3, Caddy ingress gateway, and a VictoriaStack observability pipeline.

**Current Overall Status:** `Needs Polish` (with `Blocker` items for automated background execution and security hardening).

While the application features strong FDD modularity, clean code practices, and extensive test coverage for unit/integration logic, several infrastructure blockers prevent smooth, single-command production deployment on a bare-metal home server or homelab node:
1. **Container Security & Privileges:** Python and Go backend Dockerfiles execute containers as `root`, lacking unprivileged service users (`USER appuser`).
2. **Hardcoded Credentials & Defaults:** Database connection strings across all microservice `compose.yml` files use hardcoded fallback credentials (`postgres:postgres`), bypassing environment configuration in non-dev setups.
3. **Observability & Health Probe Discrepancies:** Inconsistent health endpoints across backends (e.g., `/health`, `/healthz`, `/api/v1/health`) without distinct liveness/readiness probes, and Caddy proxying lacks upstream health checks.
4. **Missing Production Operations Scripting:** Missing systemd unit templates, automated backup/restore scripts for PostgreSQL/RustFS, and zero-downtime database migration runners.

---

## 2. Identified Issues & Technical Debt

### A. Security & Secrets
- **Location:** `core/dashboard/compose.yml` (line 29), `apps/pantry/compose.yml` (line 30), `apps/shopping/compose.yml` (line 30), `apps/maintenance/compose.yml` (line 28), `apps/chores/compose.yml` (line 28), `apps/budget/compose.yml` (line 32), `apps/chat/compose.yml` (line 33), `apps/workout/compose.yml` (line 30), `apps/library/compose.yml` (line 30)
  - **Problem:** Hardcoded database connection strings (`DATABASE_URL=postgresql+asyncpg://postgres:postgres@...`) are statically defined in Compose files instead of sourcing dynamically from `.env` or secrets.
  - **Impact:** Credentials cannot be rotated per deployment environment; production setups risk using insecure default passwords.

- **Location:** `infrastructure/telemetry/compose.yml` (lines 119-120, 128)
  - **Problem:** Grafana admin credentials (`GF_SECURITY_ADMIN_USER=admin`, `GF_SECURITY_ADMIN_PASSWORD=admin`) and Keycloak OAuth client secrets (`GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET=alfheim-grafana-secret`) are hardcoded.
  - **Impact:** Exposes telemetry UI and OAuth flow to unauthorized administrative access on public/local networks if unconfigured.

- **Location:** `infrastructure/compose.yml` (lines 78-81)
  - **Problem:** RustFS/MinIO fallback S3 access and secret keys default to `minioadmin:minioadmin`.
  - **Impact:** Unsecure default credentials for object storage in local server environments.

### B. Containerization & Non-Root Execution
- **Location:** `core/dashboard/backend/Dockerfile` (lines 20-30), `apps/chat/backend/Dockerfile` (lines 20-30), `apps/*/backend/Dockerfile` (all Python backend Dockerfiles)
  - **Problem:** Container runners run processes as `root` (UID 0). Only Next.js frontend Dockerfiles specify `USER nextjs`.
  - **Impact:** Violates container security best practices and least-privilege principles; container breakouts could compromise the host system.

- **Location:** `apps/chat/compose.yml` (line 23)
  - **Problem:** `extra_hosts: "host.docker.internal:host-gateway"` relies on Linux Docker host gateway bindings that may fail or behave inconsistently depending on Docker daemon configuration.
  - **Impact:** Chat backend container connectivity to host services may fail in automated CI or homelab production setups.

### C. Networking, Gateway & Auth
- **Location:** `infrastructure/caddy/Caddyfile` (lines 1-100)
  - **Problem:** Missing `active` health checks on `reverse_proxy` upstreams in Caddyfile definitions.
  - **Impact:** Caddy routes traffic to restarting or unresponsive containers, causing HTTP 502/503 errors to users during deployments or service failures.

- **Location:** `infrastructure/compose.yml` (lines 20-40), `infrastructure/keycloak/alfheim-realm.json`
  - **Problem:** Keycloak development mode (`command: start-dev --import-realm`) is configured with fixed redirect URIs pointing to `.localhost` domains (`http://api.alfheim.loegien.localhost/auth`).
  - **Impact:** Mobile apps or devices on the local network accessing the home server via LAN IP or custom local domain cannot complete Keycloak OIDC authentication due to URI mismatch.

### D. Observability, Logging & Healthchecks
- **Location:** `apps/shopping/backend/src/main.py` (line 102), `apps/library/backend/src/main.py` (line 48), `apps/budget/backend/src/main.py` (line 83), `apps/pantry/backend/src/main.py` (line 97)
  - **Problem:** Health check endpoint routes are inconsistent across microservices (`/health`, `/healthz`, `/api/v1/health`). None of the backends expose separate `/live` (liveness) and `/ready` (readiness with database ping checks) endpoints.
  - **Impact:** Orchestrators cannot distinguish between container runtime alive status and database connection readiness, causing premature traffic routing during startup.

- **Location:** `infrastructure/telemetry/compose.yml` (lines 65-75)
  - **Problem:** `vector-shipper` mounts host `/var/run/docker.sock` without read-only guard enforcement across non-systemd setups and lacks log parsing fallback for plain-text logs.
  - **Impact:** Potential security risk on Docker socket access; unstructured container logs may cause Vector parsing warnings.

### E. Build & Tooling Pipelines
- **Location:** `scripts/up.sh` (lines 1-250)
  - **Problem:** Script attempts to create Docker networks imperatively using `docker network create`, but lacks idempotent retry mechanisms when running in non-interactive CI/CD runners.
  - **Impact:** Intermittent script failures during automated automated deployments or system reboots.

---

## 3. Missing Scripts & Tooling

To ensure production stability on a home server, the repository requires the following operational scripts and service definitions:

1. **Production System Lifecycle & Environment Scripting:**
   - `scripts/setup.sh`: Automated environment validation, domain setup, `.env` prompt/generation, and directory permissions initialization.
   - `scripts/migrate.sh`: Single entrypoint to execute database migrations across Go (golang-migrate/goose) and Python (Alembic) services prior to container rollout.
   - `scripts/backup.sh`: Automated backup utility for dumping all PostgreSQL databases (`dashboard_db`, `keycloak_db`, `pantry`, `shopping`, `maintenance`, `chores`, `budget`, `chat_db`, `workout`, `library`) and RustFS S3 buckets to compressed local/remote storage.
   - `scripts/restore.sh`: Disaster recovery restoration script for database dumps and S3 storage state.

2. **Systemd & Host Integration Units:**
   - `deploy/systemd/alfheim.service`: Systemd service unit file for managing `docker compose up` lifecycle on Linux server boot.
   - `deploy/systemd/alfheim-backup.service` & `alfheim-backup.timer`: Systemd timer for automated nightly database and media backups.

---

## 4. Phase-by-Phase Remediation Plan

- [x] **Phase 1: Critical Fixes & Secrets Cleanup**
  - [x] Add unprivileged users (`USER appuser`) to all Go and Python backend Dockerfiles.
  - [x] Externalize all hardcoded DB credentials (`DATABASE_URL`), Keycloak secrets, and S3 keys across Compose files into `.env` variables with strong defaults.
  - [x] Harden RustFS and Grafana default admin credentials in `.env.example`.

- [ ] **Phase 2: Networking, Auth & Infrastructure**
  - [ ] Update `infrastructure/caddy/Caddyfile` to add active health checks (`lb_try_duration`, `fail_duration`) for microservice reverse proxies.
  - [ ] Dynamic domain resolution in `infrastructure/keycloak/alfheim-realm.json` supporting custom homelab LAN domains/IPs.
  - [ ] Harmonize container network definitions across `compose.yaml` and subsystem Compose files.

- [ ] **Phase 3: Automation Scripts & Local Deployment**
  - [ ] Implement `scripts/setup.sh` for interactive server initialization and dependency checking.
  - [ ] Implement `scripts/migrate.sh` to run database schema migrations safely across all microservices.
  - [ ] Implement `scripts/backup.sh` and `scripts/restore.sh` for PostgreSQL and S3 volume snapshots.
  - [ ] Create `deploy/systemd/alfheim.service` for host boot auto-start.

- [ ] **Phase 4: Healthchecks & Observability**
  - [ ] Standardize health endpoints across all backends to support `/healthz`, `/live`, and `/ready` probes (checking DB connectivity for readiness).
  - [ ] Align Docker Compose healthcheck commands with standardized probes across all services.
  - [ ] Verify OpenTelemetry Collector and Vector log routing across all microservice containers.

- [ ] **Phase 5: Release v0.1.0-alpha**
  - [ ] Run end-to-end verification using `./scripts/verify.sh`.
  - [ ] Perform full clean boot deployment using `./scripts/up.sh -b`.
  - [ ] Verify all UI workflows, Keycloak SSO redirects, and API endpoints on local homelab environment.

---

## 5. Execution Rules for Fixes

1. **Language & Documentation Standard:** All code comments, error messages, log outputs, and documentation must remain strictly in English.
2. **Feature-Driven Design (FDD) Integrity:** Maintain FDD modularity across frontends and backends (`features/<feature-name>/{components,hooks,api,services,models,schemas}`).
3. **Verification After Every Step:** Run `./scripts/verify.sh` or service-specific test suites (`pytest`, `go test`, `pnpm test`) after modifying any component to prevent regressions.
4. **Least Privilege Security:** Ensure all newly created container images enforce non-root user execution (`USER 10001` or `USER appuser`).
5. **Zero Hardcoding:** Never hardcode secrets, URIs, or passwords in source code, Dockerfiles, or Docker Compose files. Always expose configuration via environment variables.
