# Scripts & Monorepo Orchestration

The `scripts/` directory contains shell utility scripts for platform orchestration, multi-stage booting, database seeding, environment provisioning, and automated workspace verification.

---

## 1. Architectural Purpose

Managing a multi-container monorepo with isolated microservices requires centralized orchestration commands. The scripts in this directory standardize local development workflows, staging operations, testing pipelines, and verification gates.

---

## 2. Script Inventory & Options

```
scripts/
├── setup-env.sh            # Pre-flight environment variable generator & validator
├── init-env.sh             # Cryptographic secret generator & legacy variable migrator
├── up.sh                   # Staged multi-zone platform boot orchestrator
├── down.sh                 # Platform shutdown & volume cleanup script
├── zitadel-bootstrap.sh    # Zitadel OIDC client provisioning (Management API)
├── seed.sh                 # Database test data seeding utility
└── verify.sh               # Monorepo verification suite (Python, Go, Frontend, Security)
```

> Production installs do not use these scripts. They are bootstrapped by the
> root `install.sh`, which fetches the `alfheim-setup` binary built from
> `tools/installer` (see ADR 0004).

### Script Details:

#### 1. `up.sh` — Staged Cluster Boot
Orchestrates platform startup in ordered dependency stages to prevent race conditions (e.g. database migration before service initialization).
* **Usage**: `./scripts/up.sh [OPTIONS]`
* **Key Flags**:
  * `-b`, `--build`: Force Docker image rebuild before starting containers.
  * `--skip-obs`: Skip the VictoriaStack observability stage.
* **Requires** a root `.env`; generate one with `./scripts/init-env.sh --auto`.
* Stage 1 boots `postgres-core → zitadel → rustfs → caddy` and provisions the
  Grafana OIDC client via `zitadel-bootstrap.sh` before the stack comes up.

#### 2. `down.sh` — Cluster Teardown
Stops and removes active Docker compose service containers across all stages.
* **Usage**: `./scripts/down.sh [OPTIONS]`
* **Key Flags**:
  * `-v`, `--volumes`: Delete persistent Docker volumes (resets database states).

#### 3. `seed.sh` — Database Seeding
Populates relational databases with mock households, users, pantry items, shopping lists, chores, and maintenance routines.
* **Usage**: `./scripts/seed.sh`

#### 4. `init-env.sh` — Secret Initialization & Registry Resolution
Generates `.env` files from `.env.example` with cryptographic secrets and dynamic image registry/repository resolution.
* **Usage**: `./scripts/init-env.sh [OPTIONS]`
* **Key Flags**:
  * `-a`, `--auto`: Non-interactive environment setup.
  * `-b`, `--base-url <url>`: Specify root Base URL.
  * `-r`, `--registry <registry>`: Container image registry (e.g. `ghcr.io`, auto-derived from Git remote if omitted).
  * `--repo <repo>`: Container image repository path (e.g. `owner/repo`, auto-derived from Git remote if omitted).
  * `--tag <tag>`: Container image tag (default: `latest`).

#### 5. `zitadel-bootstrap.sh` — OIDC Client Provisioning
Reconciles the `Alfheim` project and the `Grafana` OIDC application through
Zitadel's Management API, then writes the generated client id and secret into
the root `.env`. `up.sh` calls it; run it directly only to repair or rotate
those credentials.
* **Usage**: `./scripts/zitadel-bootstrap.sh [--force]`
* **Key Flags**:
  * `--force`: Regenerate the Grafana client secret even when `.env` holds a valid one.

#### 6. `setup-env.sh` — Environment Provisioning
Generates `.env` files from `.env.example` templates if missing, validating required secret keys and port configurations.
* **Usage**: `./scripts/setup-env.sh`

#### 7. `verify.sh` — Workspace Verification Suite
Executes comprehensive linting, type-checking, formatting, and test suites across all monorepo technologies.
* **Usage**: `./scripts/verify.sh [FLAGS]`
* **Flags**:
  * `--python`: Runs Ruff linter/formatter, `uv run ty check`, and `pytest` across Python microservices.
  * `--go`: Runs `go vet`, `golangci-lint`, and `go test -race -cover ./...` across Go backends.
  * `--frontend`: Runs `pnpm check-types` (`tsc --noEmit`) and Vitest test suites across frontend applications.
  * `--security`: Executes security scanners (e.g., bandit, trivy).

---

## 3. Interactions with Other Layers

* **Docker Orchestration (`compose.yaml` & `apps/*/backend/compose.yml`)**: `up.sh` and `down.sh` invoke Docker Compose with included sub-compose files across infrastructure, core, and app layers.
* **Workspace Tooling (`uv`, `pnpm`, `go`)**: `verify.sh` invokes native language build tools (`uv` for Python, `pnpm` for Node/TypeScript, `go` for Go).
* **CI/CD Pipelines (`.github/workflows/`)**: Automated GitHub Actions workflows invoke `verify.sh` to enforce quality gates on pull requests.
