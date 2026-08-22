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

All Python backend microservices (`apps/pantry/backend`, `apps/shopping/backend`, `apps/maintenance/backend`, `apps/chores/backend`) are unified under the root `pyproject.toml` UV workspace.

### A. Static Analysis & Linting (Ruff)
- **Tool**: Astral Ruff (Linter & Formatter)
- **Config**: [`ruff.toml`](ruff.toml)
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
- **Target Coverage**: **>= 80% line coverage**
- **Standards**:
  - Test suites run with in-memory `aiosqlite` (`sqlite+aiosqlite:///:memory:`) using isolated transactions per test.
  - Multi-tenant boundary tests must assert household isolation (`home_id` / `household_id`) and zero-trust auth token verification.
- **Mandatory Commands**:
  ```bash
  # Standalone service execution snippet with PYTHONPATH set for module resolution
  PYTHONPATH=. uv run pytest --cov

  # Per-service execution matrix matching ./scripts/verify.sh
  (cd apps/pantry/backend && PYTHONPATH=. uv run pytest --cov --cov-report=term-missing)
  (cd apps/shopping/backend && PYTHONPATH=. uv run pytest --cov --cov-report=term-missing)
  (cd apps/maintenance/backend && PYTHONPATH=. uv run pytest --cov --cov-report=term-missing)
  (cd apps/chores/backend && PYTHONPATH=. uv run pytest --cov --cov-report=term-missing)
  ```

---

## 🐹 3. Go Quality Gates

The central dashboard backend control plane is located in [`core/dashboard/backend`](core/dashboard/backend).

### A. Testing & Race Detection
- **Mandatory Command**:
  ```bash
  cd core/dashboard/backend && go test -v -race -cover ./...
  ```
- **Requirements**:
  - All tests must pass with the Go race detector (`-race`) enabled without data race violations.
  - Must mock external dependencies (Keycloak JWKS, VictoriaLogs, VictoriaMetrics) with graceful fallback.

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
   - `detect-private-key` and `check-case-conflict` are enforced automatically via `.pre-commit-config.yaml`.
3. **Multi-Tenant Zero Trust**:
   - Every API query must filter against `home_id` / `household_id` extracted from validated Keycloak bearer JWTs.

---

## 🚀 7. The Unified Verification Runner (`scripts/verify.sh`)

Before opening a pull request, creating commits, or proposing code modifications, run the local runner:

```bash
# Run all quality gates (Python, Go, Frontend, and Security scans)
./scripts/verify.sh --all

# Run specific gates
./scripts/verify.sh --python     # Ruff, Ty, Pytest
./scripts/verify.sh --go         # Go tests & race detector
./scripts/verify.sh --frontend   # TSC & Vitest
./scripts/verify.sh --security   # Secret scans & Pre-commit
```
