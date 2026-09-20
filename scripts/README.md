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
├── seed.sh                 # Database test data seeding utility
├── verify.sh               # Monorepo verification suite (Python, Go, Frontend, Security)
├── verify-stack.sh         # End-to-end verification of a running stack (dev or production)
├── diagnose-mcp.sh         # FastMCP endpoint connectivity & tool discovery diagnostic
├── check-frontend-runtime-config.sh  # Fails a build that leaked OIDC config into static output
├── check-markdown-links.py # Fails CI on a broken relative link in any Markdown file
├── test-prod-startup.sh    # Preflight/smoke-test harness for `compose.prod.yaml`
├── install-hooks.sh        # Installs the repo's git hooks
└── hooks/                  # Git hook scripts installed by install-hooks.sh
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
* Stage 1 boots `postgres-core → zitadel → rustfs → caddy` and then provisions
  the Zitadel project and every OIDC client (dashboard, every app frontend,
  Grafana) via `go run ./tools/installer/cmd/alfheim-setup provision`, which
  shares its reconciliation logic with the production installer
  (`tools/installer/internal/features/provisioning`).

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

#### 5. `setup-env.sh` — Environment Provisioning
Generates `.env` files from `.env.example` templates if missing, validating required secret keys and port configurations.
* **Usage**: `./scripts/setup-env.sh`

#### 6. `verify.sh` — Workspace Verification Suite
Executes comprehensive linting, type-checking, formatting, and test suites across all monorepo technologies.
* **Usage**: `./scripts/verify.sh [FLAGS]`
* **Flags**:
  * `--python`: Runs Ruff linter/formatter, `uv run ty check`, and `pytest` across Python microservices.
  * `--go`: Runs `go vet`, `golangci-lint`, and `go test -race -cover ./...` across Go backends.
  * `--frontend`: Runs `pnpm check-types` (`tsc --noEmit`) and Vitest test suites across frontend applications.
  * `--security`: Executes security scanners (e.g., bandit, trivy).

#### 7. `verify-stack.sh` — Running-Stack Verification
Checks a *running* stack end to end instead of the source tree: every Compose service is
healthy, Caddy's `/livez`, that OIDC discovery names the configured issuer, every app route
resolves through the gateway without a 5xx, `/internal/*` is blocked at the edge, and the
household API rejects a request with no bearer token. Auto-detects `compose.yaml` (local dev)
or `compose.prod.yaml` (a production install); `alfheim-setup update` runs it automatically
after a Day-2 upgrade.
* **Usage**: `./scripts/verify-stack.sh [--dir DIR] [--compose-file NAME]`
* **Flags**:
  * `--dir DIR`: Directory holding the compose file and `.env` (default: repository root).
  * `--compose-file NAME`: Force `compose.yaml` or `compose.prod.yaml` instead of auto-detecting.

#### 8. `diagnose-mcp.sh` — FastMCP Diagnostics
Pings every registered FastMCP endpoint and verifies the Streamable HTTP `initialize` handshake
and tool discovery (`tools/list`).
* **Usage**: `./scripts/diagnose-mcp.sh [--api-url <url>]`

#### 9. `check-frontend-runtime-config.sh` — Runtime Config Leak Guard
Fails when a Next.js frontend build leaked OIDC issuer/client-id configuration into its
prerendered HTML or JS — that config must only ever be delivered at request time via the
`<basePath>/runtime-config.js` route, never baked into a static `next build` output.
* **Usage**: `./scripts/check-frontend-runtime-config.sh <frontend-dir>` (run after `next build`
  with no `OIDC_*` build-time env vars set)

---

## 3. Interactions with Other Layers

* **Docker Orchestration (`compose.yaml` & `apps/*/backend/compose.yml`)**: `up.sh` and `down.sh` invoke Docker Compose with included sub-compose files across infrastructure, core, and app layers.
* **Workspace Tooling (`uv`, `pnpm`, `go`)**: `verify.sh` invokes native language build tools (`uv` for Python, `pnpm` for Node/TypeScript, `go` for Go).
* **CI/CD Pipelines (`.github/workflows/`)**: Automated GitHub Actions workflows invoke `verify.sh` to enforce quality gates on pull requests.
