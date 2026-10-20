# Alfheim — Monorepo Quality Gate & Verification Guidelines (`.ai/guidelines/quality-gates.md`)

> **MANDATORY OPERATING RULE FOR ALL AI AGENTS & DEVELOPERS:**
> You MUST NOT stage, commit, or propose code changes without running all corresponding local verification commands first (`./scripts/verify.sh` or specific sub-check flags) and proving that they exit with code `0`. Speculative fixes without local verification are strictly forbidden.

---

## 🏛️ 1. Multi-Stack Quality Gate Architecture

Alfheim is a polyglot monorepo containing Python (FastAPI/SQLModel), Go (Dashboard control plane), and TypeScript/React (Next.js/Vite microfrontends & shared packages). Quality gates are strictly automated and enforced across every layer.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         MONOREPO QUALITY GATES                           │
├──────────────────────────────────────────────────────────────────────────┤
│ 🐍 Python Gate       │ 🐹 Go Gate           │ ⚛️ Frontend Gate          │
│ • Ruff Lint & Format │ • go test -race      │ • tsc --noEmit           │
│ • ty Type Checker    │ • go test -cover     │ • Vitest Suites          │
│ • Pytest Matrix      │ • golangci-lint      │ • ESLint/Biome           │
├──────────────────────────────────────────────────────────────────────────┤
│ 🛡️ Security Guardrails: Secret leak scans, .env hygiene, private keys    │
│ 🤖 MCP Tool Verification: FastMCP schema contract & JSON-RPC tests       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🐍 2. Python Quality Gates

All Python backend microservices (`apps/*/backend`) and `packages/backend-shared` are unified under the root `pyproject.toml` UV workspace. CI and `verify.sh` sync it with `uv sync --all-packages --all-groups --locked`, so a stale `uv.lock` fails instead of being rewritten.

### A. Static Analysis & Linting (Ruff)
- **Tool**: Astral Ruff (Linter & Formatter)
- **Config**: [`ruff.toml`](../../ruff.toml)
- **Mandatory Commands**:
  ```bash
  uv run ruff check .               # Must return 0 diagnostics
  uv run ruff format --check .      # Must return 0 unformatted files
  ```

### B. Static Type Checking (ty)
- **Tool**: `ty` Static Type Checker
- **Rules**:
  - Model attributes in queries (`.desc()`, `.asc()`, `.in_()`, `.is_()`, `.is_not()`) **MUST** be wrapped in `sqlmodel.col()` (e.g. `col(ShoppingList.position).asc()`).
  - Index definitions in SQLModel models **MUST** use string column names (e.g. `Index("uq_name", "home_id", "name", unique=True)`).
  - Explicit null checks or assertions (`assert entity.id is not None`) must be placed after session refreshes/flushes to satisfy strict null safety.
  - Optional relationship properties on models must use safe access or null guards.
- **Mandatory Command**:
  ```bash
  uv run ty check                   # Must exit with code 0 across the monorepo
  ```

### C. Test Matrix & Code Coverage (Pytest)
- **Framework**: `pytest` + `pytest-asyncio` + `pytest-cov` + `aiosqlite`
- **Target Coverage**: **>= 95% line coverage** per app backend (`--cov-fail-under=95`, enforced in CI and `verify.sh`). `packages/backend-shared` runs its suite with coverage reporting but has no threshold yet.
- **Standards**:
  - Test suites run with in-memory `aiosqlite` (`sqlite+aiosqlite:///:memory:`) using isolated transactions per test.
  - Multi-tenant boundary tests must assert household isolation (`home_id` / `household_id`), zero-trust auth token verification, and the household error codes (`403 household_forbidden`, `400 household_required`, `503 household_service_unavailable`), using `override_membership` from `backend_shared.household.testing`.
- **Mandatory Commands**:
  ```bash
  # Standalone service execution snippet with PYTHONPATH set for module resolution
  PYTHONPATH=. uv run pytest --cov

  # Per-service execution matching ./scripts/verify.sh (repeat for every apps/*/backend)
  (cd apps/pantry/backend && uv run pytest --cov --cov-report=term-missing --cov-fail-under=95)

  # Shared backend library (no coverage threshold)
  (cd packages/backend-shared && uv run pytest --cov --cov-report=term-missing)
  ```

---

## 🐹 3. Go Quality Gates

Go modules: `apps/chat/backend`, `core/dashboard/backend`, `core/household/backend` and `tools/installer`. CI (`go-ci.yml`) and `./scripts/verify.sh --go` run every one of them.

### A. Testing & Race Detection
- **Mandatory Command**:
  ```bash
  cd core/dashboard/backend && go test -v -race -cover ./...
  gofmt -l .      # CI requires empty output
  go vet ./...
  ```
- **Requirements**:
  - All tests must pass with the Go race detector (`-race`) enabled without data race violations.
  - `tools/installer` additionally enforces >= 80% total coverage (`-coverpkg=./internal/...`) and cross-compiles for linux/amd64 and linux/arm64 in CI.
  - Must mock external dependencies (OIDC JWKS, VictoriaLogs, VictoriaMetrics) with graceful fallback.

### B. Static Analysis (golangci-lint)
- **Command**:
  ```bash
  cd core/dashboard/backend && golangci-lint run
  ```

---

## ⚛️ 4. Frontend Quality Gates (TypeScript & React)

Managed via `pnpm` workspace across `apps/*/frontend`, `core/dashboard/frontend`, `websites/*`, and `packages/*`.

### A. TypeScript Type Safety
- **Mandatory Command**:
  ```bash
  pnpm check-types     # Runs tsc --noEmit across workspace packages
  # or
  pnpm -r exec tsc --noEmit
  ```
- **Rules**:
  - Strict type checking enabled (`strict: true` in `tsconfig.json`).
  - No `any` escapes unless wrapped in safe cast boundaries.
  - Design system tokens from `@alfheim/shared` must be consumed for styling and asset resolution.

### B. Vitest Unit & Integration Suites
- **Mandatory Command**:
  ```bash
  pnpm -r test         # or pnpm --recursive test
  ```
- **Requirements**:
  - Microfrontend components and services must maintain passing Vitest test suites with mocking via `@testing-library/react`.
- **Parallelism**: `./scripts/verify.sh --frontend` runs 2 packages at a time (`--workspace-concurrency`) with `VITEST_MAX_WORKERS` set to half the CPU count, so the total number of Vitest workers stays near the CPU count. Unbounded (`pnpm -r test`: 4 packages, each with CPU count - 1 workers) async tests timed out intermittently under load. Override with `VERIFY_FRONTEND_CONCURRENCY` and `VITEST_MAX_WORKERS`.

---

## 🤖 5. Model Context Protocol (MCP) Verification

Alfheim microservices expose FastMCP tools for AI agent orchestration:
- **Pantry MCP**: Inventory queries, product additions, low stock monitors.
- **Maintenance MCP**: Device registry lookup, service step completion, overdue tasks.

### Verification Criteria:
1. All FastMCP tool functions must provide clear docstrings and type annotations.
2. Tools interacting with database sessions must handle exceptions gracefully and return structured JSON or human-readable strings rather than uncaught tracebacks.
3. FastMCP servers must initialize cleanly via SSE transport (`/messages/`).

---

## 🛡️ 6. Security Guardrails & Secret Leak Prevention

1. **Zero Secret Leaks**:
   - Never commit live API keys, private key blocks, or credentials.
   - All `.env` files with actual secrets are strictly gitignored (`.gitignore`).
   - Only `.env.example` templates with placeholder dummy values are allowed in version control.
2. **Pre-Commit Guardrails**:
   - `check-yaml`, `check-json`, `check-added-large-files`, `check-merge-conflict` and `detect-private-key` are enforced via `.pre-commit-config.yaml`. `verify.sh --security` runs only these check hooks, because the fixer hooks (whitespace, `ruff --fix`, `gofmt -w`) would rewrite files.
   - CI (`security-scan.yml`) additionally runs gitleaks over the full history, `pip-audit`, `govulncheck` (pinned), `pnpm audit` and Trivy. Locally, `verify.sh --security` runs gitleaks if it is installed.
3. **Multi-Tenant Zero Trust**:
   - Every API query must filter against the `household_id` returned by `require_household` (Python) or `RequireHousehold` (Go), i.e. an `X-Household-ID` confirmed with the `core/household` membership API. Never trust household or role claims from the JWT.
   - MCP tools never accept `household_id` / `user_id` arguments; they read the request context.

---

## 🚀 7. The Unified Verification Runner (`scripts/verify.sh`)

Before opening a pull request, creating commits, or proposing code modifications, run the local runner:

```bash
# Run all quality gates (Python, Go, Frontend, and Security scans)
./scripts/verify.sh --all

# Run specific gates
./scripts/verify.sh --python     # Ruff, Ty, Pytest (apps + packages/backend-shared)
./scripts/verify.sh --go         # Go tests & race detector (incl. tools/installer)
./scripts/verify.sh --frontend   # TSC & Vitest
./scripts/verify.sh --security   # Secret scans & non-mutating pre-commit checks
```

---

## 🔁 8. Continuous Integration (`.github/workflows/`)

`ci-required.yml` is the entry point for the stack gates on pull requests (to `main` and `dev`) and pushes to `main`. It detects the changed paths and calls the reusable gates `python-ci.yml`, `go-ci.yml` and `frontend-ci.yml` only for the stacks that changed. Its always-running job `ci-required` passes when every gate that ran succeeded and the others were skipped, so it is the single status check to require in branch protection.

| Workflow | Purpose |
| --- | --- |
| `ci-required.yml` | Path filter, stack gates, aggregated `ci-required` check |
| `python-ci.yml` | Ruff, ty, per-app Pytest with `--cov-fail-under=95`, `packages/backend-shared` Pytest |
| `go-ci.yml` | gofmt, `go vet`, `go test -race` per module, installer coverage gate and cross-compile |
| `frontend-ci.yml` | `pnpm check-types`, `pnpm -r test` |
| `security-scan.yml` | gitleaks, pip-audit, govulncheck, pnpm audit, Trivy (also weekly) |
| `smoke-test.yml` | Caddy gateway and production core stack startup |
| `deploy-docs.yml` | Markdown link check and docs build; deploys from `main` |
| `release.yml` | Tag-triggered release: ancestry check, quality gates, image build, Trivy gate, push, GitHub release |

Workflow rules:
- Every action is pinned to a full commit SHA with a `# vX.Y.Z` comment; Dependabot (`github-actions`) updates them.
- Workflows default to `permissions: contents: read`; jobs raise only the scope they need (`packages: write`, `security-events: write`, `contents: write`).
- Release images are built, scanned with Trivy (fixable CRITICAL/HIGH findings fail the job) and only then pushed. Pre-release tags (any `-rc`, `-beta`, `-alpha` suffix) never receive `latest`.
- `uv sync` always runs with `--locked` in CI.
