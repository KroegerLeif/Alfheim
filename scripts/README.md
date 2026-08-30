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
├── up.sh                   # Staged multi-zone platform boot orchestrator
├── down.sh                 # Platform shutdown & volume cleanup script
├── seed.sh                 # Database test data seeding utility
└── verify.sh               # Monorepo verification suite (Python, Go, Frontend, Security)
```

### Script Details:

#### 1. `up.sh` — Staged Cluster Boot
Orchestrates platform startup in ordered dependency stages to prevent race conditions (e.g. database migration before service initialization).
* **Usage**: `./scripts/up.sh [OPTIONS]`
* **Key Flags**:
  * `-b`, `--build`: Force Docker image rebuild before starting containers.
  * `-d`, `--detach`: Run containers in detached background mode.
  * `--stage0`: Boot Stage 0 infrastructure only (networks, Caddy gateway, Keycloak IAM, RustFS, VictoriaStack).
  * `--stage1`: Boot Stage 1 core services (`core/dashboard`).
  * `--stage2`: Boot Stage 2 application microservices (`apps/*`).

#### 2. `down.sh` — Cluster Teardown
Stops and removes active Docker compose service containers across all stages.
* **Usage**: `./scripts/down.sh [OPTIONS]`
* **Key Flags**:
  * `-v`, `--volumes`: Delete persistent Docker volumes (resets database states).

#### 3. `seed.sh` — Database Seeding
Populates relational databases with mock households, users, pantry items, shopping lists, chores, and maintenance routines.
* **Usage**: `./scripts/seed.sh`

#### 4. `setup-env.sh` — Environment Provisioning
Generates `.env` files from `.env.example` templates if missing, validating required secret keys and port configurations.
* **Usage**: `./scripts/setup-env.sh`

#### 5. `verify.sh` — Workspace Verification Suite
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
