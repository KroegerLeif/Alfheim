# Alfheim - Deployment Readiness Guide & Operational Audit (v0.1.0 Beta Roadmap)

## 1. Executive Summary
This document serves as the operational deployment guide and readiness audit for **Alfheim** homelab microservice monorepo, targeting `v0.1.0 Beta` release. Alfheim consists of a Go control plane, multiple Python FastAPI microservices (Pantry, Shopping, Maintenance, Chores, Workout, Library, Budget), a Go Chat service, React/Next.js frontends, Keycloak IAM, RustFS S3, Caddy ingress gateway, and a VictoriaStack observability pipeline.

**Current Deployment Status:** 🟡 **Needs Hardening (Beta Prep)**

While the monorepo features strong Feature-Driven Design (FDD) modularity, clean code practices, and extensive test coverage, several operational and infrastructure requirements must be addressed prior to single-command production server deployment on bare-metal home servers:
1. **Container Security & Least Privilege:** Non-root execution (`USER appuser`) is implemented across backend services, but Compose overrides must enforce strict security context options in production.
2. **Environment Variable Interoperability:** Fallback credentials in local development Compose files must be strictly overridden by `.env` secrets during Beta deployment.
3. **Observability & Health Probes:** Healthcheck probes across Caddy, VictoriaStack, and microservices must be fully aligned in `up.sh` and Compose files.

---

## 2. Identified Operational Debt & Remediation

### A. Security & Environment Configuration
- **Location:** Microservice `compose.yml` files (`core/dashboard/compose.yml`, `apps/*/compose.yml`)
  - **Status:** Development Compose files provide fallback connection parameters. Production deployments mandate explicit sourcing of `.env` secrets for `DATABASE_URL`, `KEYCLOAK_SECRET`, and `S3_SECRET_KEY`.
  - **Action:** Ensure `scripts/setup-env.sh` generates cryptographically secure secrets for production environments.

- **Location:** `infrastructure/telemetry/compose.yml`
  - **Status:** Grafana administrative credentials and Keycloak OAuth secrets rely on environment variables.
  - **Action:** Enforce strict `.env` overrides before deploying telemetry services on publicly accessible homelab endpoints.

### B. Containerization & Network Gateway
- **Location:** `infrastructure/caddy/compose.yml` & `infrastructure/caddy/Caddyfile`
  - **Status:** Caddy serves as the central reverse-proxy gateway routing traffic to Next.js frontends (`/`, `/pantry`, `/shopping`, etc.) and backend REST APIs (`/api/v1/*`).
  - **Action:** Add explicit healthcheck probes for Caddy in `infrastructure/caddy/compose.yml` to prevent race conditions during stack startup.

- **Location:** `scripts/up.sh`
  - **Status:** Staged boot orchestrator sequentially brings up infrastructure, core dashboard, and domain app slices.
  - **Action:** Update stage wait conditions from process checks (`wait_running`) to health status checks (`wait_healthy`) across all service stages.

---

## 3. Operations & Lifecycle Scripting

To ensure production stability on homelab server nodes, the repository uses the following standardized scripts:

1. **Stack Lifecycle Management:**
   - `./scripts/setup-env.sh`: Interactive or automated `.env` environment file initialization.
   - `./scripts/up.sh`: Staged boot orchestrator with dependency ordering and healthcheck waiting.
   - `./scripts/down.sh`: Graceful shutdown of all containers and monorepo networks.
   - `./scripts/verify.sh`: Consolidated quality gate runner across Python, Go, Frontend, and Security suites.
   - `./scripts/seed.sh`: Demo data seed utility for fresh deployments.

---

## 4. Phase-by-Phase Roadmap to v0.1.0 Beta Release

- [x] **Phase 1: Code Base Verification & Test Suite Integrity**
  - [x] Workspace-wide frontend typechecking (`tsc --noEmit`).
  - [x] Go race detector and coverage test suites (`go test -v -race -cover ./...`).
  - [x] Python Pytest suites and static typing (`uv run ty check`, `pytest --cov`).

- [ ] **Phase 2: Healthcheck & Startup Hardening**
  - [ ] Add explicit Docker `healthcheck` definitions for Caddy gateway and VictoriaStack containers.
  - [ ] Update `scripts/up.sh` Stage 9 to wait for container health (`wait_healthy`).
  - [ ] Implement exponential backoff retries for Keycloak client registration.

- [ ] **Phase 3: Coverage Elevation to CI/CD Gate (90–95%)**
  - [ ] Elevate Go backend package coverage (`core/dashboard/backend` & `apps/chat/backend`) to >90%.
  - [ ] Raise Python backend Pytest coverage threshold from 75% to 95%.
  - [ ] Enforce Vitest coverage thresholds across frontend packages.

- [ ] **Phase 4: Release Automation & Tagging (`v0.1.0 Beta`)**
  - [ ] Finalize GitHub Actions CI/CD workflows (`.github/workflows/`).
  - [ ] Perform full clean boot deployment verification (`./scripts/up.sh -b`).
  - [ ] Tag release `v0.1.0-beta`.
