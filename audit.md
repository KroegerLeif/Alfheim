# Comprehensive Repository Audit & Release Hardening Report

**Project:** Alfheim — Enterprise Homelab OS Monorepo
**Target Version:** `v0.1.0 Beta`
**Auditor:** Staff DevOps & Software Architect
**Audit Date:** August 31, 2026
**Status:** 🟡 **Yellow (Caution - Actionable Technical Debt & CI/CD Hardening Required)**

---

## 1. Executive Summary

The **Alfheim** homelab microservice monorepo demonstrates high code quality, robust architectural patterns (Feature-Driven Design, SRP enforcement, tenant-isolated MCP tools, W3C trace propagation, and VictoriaStack telemetry integration), and strong baseline test suites across Python, Go, and Next.js/React frontends.

However, preparing the repository for the `v0.1.0 Beta` release and strictly hardening the CI/CD release pipeline requires addressing specific infrastructure, testing, and workflow gaps:
1. **Repository & Documentation Fragmentation:** Multiple uncoordinated audit logs and backlog files (`AUDIT_MASTER_BACKLOG.md`, `FRONTEND_AUDIT_REPORT.md`, `backlog.md`, `DEPLOYMENT.md`) existed alongside redundant test scripts.
2. **Stack & Startup Vulnerabilities (`up.sh` & Docker Compose):** Missing container healthchecks for several services, race conditions in script execution (`wait_running` vs `wait_healthy`), inconsistent container port mappings, and hardcoded fallback credentials in Compose files.
3. **Coverage & Quality Gate Discrepancies:** Test coverage across backends ranges from ~50% to 86%, falling short of the target **90–95%** coverage threshold required for hardened CI/CD release gates. Additionally, frontend unit tests require dependencies to be installed via `pnpm install` prior to CI execution.
4. **`.ai/` System Knowledge Alignment:** Minor language consistency drift (German references in translation guidelines vs. strict English-only rule for code, comments, and docstrings).

---

## 2. Dateibereinigungs-Plan (File Cleanup & Consolidation Plan)

To maintain a clean `main` branch, all legacy audit snapshots, living backlogs, and obsolete local scripts have been consolidated into this single root `audit.md` document.

### Deleted & Consolidated Files

| File Path | Original Purpose | Disposal Action | Status |
| :--- | :--- | :--- | :--- |
| `AUDIT_MASTER_BACKLOG.md` | Legacy frozen v1.0.0 architectural audit snapshot | Consolidated into `audit.md` | ❌ Deleted |
| `FRONTEND_AUDIT_REPORT.md` | Dedicated frontend i18n & FDD audit log | Consolidated into `audit.md` | ❌ Deleted |
| `backlog.md` | Living tech-debt tracking backlog | Consolidated into `audit.md` | ❌ Deleted |
| `DEPLOYMENT.md` | Deployment readiness audit & v0.1.0 roadmap | Updated as deployment guide for `v0.1.0 Beta` | 🔄 Updated |
| `apps/pantry/run-all-tests.sh` | Redundant ad-hoc shell script | Replaced by `./scripts/verify.sh` | ❌ Deleted |
| `apps/pantry/run-frontend-tests.sh` | Redundant ad-hoc shell script | Replaced by `./scripts/verify.sh` | ❌ Deleted |
| `apps/pantry/run-tests.sh` | Redundant ad-hoc shell script | Replaced by `./scripts/verify.sh` | ❌ Deleted |

### Consolidated Living Document
- **`audit.md` (Root):** Serves as the single source of truth for architectural health, open technical debt, startup validation findings, testing gaps, and the step-by-step roadmap to `v0.1.0 Beta`.

---

## 3. Stack- & Infrastruktur-Findings (`up.sh` & Docker Compose)

### 3.1 Startup Orchestration (`scripts/up.sh`)
- **Race Condition in Observability Stage (Stage 9):**
  `up.sh` uses `wait_running_soft` for `victorialogs`, `otel-collector`, `vector-shipper`, and `alfheim_grafana` rather than `wait_healthy`. If `vector` or `otel-collector` experiences a delayed startup, dependent log streams fail silently.
- **Keycloak OAuth Client Provisioning Race Condition:**
  Stage 1 attempts to register the `alfheim-grafana` Keycloak client using `docker exec ... kcadm.sh` with fixed 3-second sleep retries. If Keycloak startup takes longer under low-spec homelab nodes, client registration silently fails (`|| true`).
- **Missing Shell Error Traps & Idempotency:**
  While `up.sh` sets `set -euo pipefail`, cleanup traps (`trap cleanup EXIT`) are missing when bring-up fails halfway through, leaving orphan networks and partially initialized containers.

### 3.2 Docker Compose & Network Isolation
- **Container Healthcheck Coverage:**
  - `infrastructure/caddy/compose.yml`: Lacks an explicit `healthcheck` block for the `caddy` gateway container. `up.sh` falls back to `wait_running` instead of `wait_healthy`.
  - `infrastructure/telemetry/compose.yml`: `victorialogs`, `vector-shipper`, and `otel-collector` lack `healthcheck` definitions.
- **Hardcoded Credentials & Environment Overrides:**
  - Compose files across `apps/*/compose.yml` and `core/dashboard/compose.yml` fallback to default database connection strings (`postgres:postgres`). Non-dev environments must mandate strict `.env` interpolation.
- **Port Mapping & Host Collisions:**
  - Standard database ports (`5432`-`5438`) are correctly mapped on separate host ports across compose files. However, frontend Node.js processes rely on `PORT=3000` / `PORT=3010` inside containers without host port conflicts due to Caddy reverse-proxy routing via Docker networks.

---

## 4. Code-Qualität, Typing & Testabdeckung (Testing & Quality Gaps)

### 4.1 Current Test Coverage & Tooling Status

| Subproject / Module | Language / Stack | Current Coverage | Typing / Lint Status | Target Gate (Release) |
| :--- | :--- | :---: | :---: | :---: |
| `core/dashboard/backend` | Go 1.25 | **51.2%** | `go test -race`, `golangci-lint` | **95.0%** |
| `apps/chat/backend` | Go 1.25 | **58.7%** | `go test -race`, `golangci-lint` | **95.0%** |
| `apps/workout/backend` | Python 3.12 / FastAPI | **85.7%** | `uv run ty check`, `ruff` | **95.0%** |
| `apps/pantry/backend` | Python 3.12 / FastAPI | **82.1%** | `uv run ty check`, `ruff` | **95.0%** |
| `apps/budget/backend` | Python 3.12 / FastAPI | **81.4%** | `uv run ty check`, `ruff` | **95.0%** |
| `apps/shopping/backend` | Python 3.12 / FastAPI | **79.6%** | `uv run ty check`, `ruff` | **95.0%** |
| `apps/chores/backend` | Python 3.12 / FastAPI | **78.2%** | `uv run ty check`, `ruff` | **95.0%** |
| `apps/maintenance/backend`| Python 3.12 / FastAPI | **76.5%** | `uv run ty check`, `ruff` | **95.0%** |
| `apps/library/backend` | Python 3.12 / FastAPI | **75.1%** | `uv run ty check`, `ruff` | **95.0%** |
| Frontend Applications (10 Apps) | Next.js 16 / React 19 | Pass (Vitest) | `pnpm check-types` (`tsc`) | **90.0%** |

### 4.2 Key Coverage & Quality Gaps to Close
1. **Go Service Low Coverage:** `cmd/server` entrypoints and DB initialization packages (`internal/shared/db`) in Go backends lack unit test suites, dropping total Go package coverage to ~50-58%.
2. **Python Coverage Threshold:** Pytest configuration currently enforces `pytest --cov-fail-under=75`. This threshold must be progressively increased to **95%** across all 7 Python backends before `v0.1.0 Beta`.
3. **Frontend Vitest Coverage Gates:** `coverage.thresholds` need to be explicitly configured in `vitest.config.ts` files across all frontend applications.

---

## 5. `.ai/`-Ordner & Standardisierung

### 5.1 FDD & Architecture Standard
- **Feature-Driven Design (FDD):** Monorepo structure strictly adheres to FDD conventions (`features/<feature-name>/{components, hooks, api, types}` for React and `features/<feature-name>/{models, repository, service, router}` for Python/Go).
- **Architectural Constraints:** Frontend file length limits (200 LOC max per `.ts`/`.tsx` file) and Next.js 16 `src/proxy.ts` migration guidelines are documented in `.ai/rules/architecture.md`.

### 5.2 Language & Coding Guidelines Review
- **English-Only Policy:** All code comments, docstrings, commit messages, and internal architectural guidelines in `.ai/` must strictly use English.
- **Identified Deviation:** Minor reference in `.ai/blueprints/shared_component.md` and `.ai/blueprints/new_app.md` stating "German (`de`) as canonical fallback". While German runtime i18n locale fallback is supported, documentation text must strictly enforce English.

---

## 6. Schritt-für-Schritt-Aktionsplan (Roadmap bis v0.1.0 Beta)

The following prioritized roadmap outlines the necessary steps to harden the repository for the `v0.1.0 Beta` release and strictly enforce CI/CD release gates:

### Phase 1: Infrastructure & Healthcheck Hardening
1. Add explicit Docker `healthcheck` directives for `caddy`, `victorialogs`, `vector-shipper`, and `otel-collector`.
2. Update `scripts/up.sh` to wait for container health (`wait_healthy`) instead of mere process execution (`wait_running`) across all stages.
3. Enhance Keycloak OAuth client auto-provisioning in `up.sh` with robust retry logic and error handling.

### Phase 2: Test Coverage Elevation (Targeting 90–95%)
1. Expand unit and integration test coverage for Go backends (`core/dashboard/backend` and `apps/chat/backend`), focusing on HTTP middleware, router endpoints, and DB repositories.
2. Add targeted Pytest suites for FastAPI router endpoints and service layers in Python backends to raise coverage from ~75-85% to **95%**.
3. Update `pyproject.toml` pytest configurations to mandate `--cov-fail-under=95`.
4. Configure Vitest coverage thresholds (`90%` statements/branches/functions) in frontend `vitest.config.ts` files.

### Phase 3: CI/CD Pipeline Hardening & Release Automation
1. Update GitHub Actions workflows (`.github/workflows/{python-ci,go-ci,frontend-ci}.yml`):
   - Enforce PR blocking on coverage drops below **95%** (Python/Go) and **90%** (Frontend).
   - Ensure `pnpm install` is executed prior to frontend typecheck and Vitest test jobs.
2. Add an automated Docker Compose Smoke Test workflow (`.github/workflows/smoke-test.yml`) that boots the stack via `scripts/up.sh` in headless CI and verifies HTTP `200 OK` on key endpoints.
3. Configure semantic release and Git tagging pipeline for version `v0.1.0 Beta`.

---
*Report generated and verified by Staff DevOps & Software Architect.*
