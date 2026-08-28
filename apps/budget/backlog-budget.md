# Backlog: Tier-1 Core App — Budget & Treasury (`apps/budget`)

This document serves as the deterministic, modular, phase-based roadmap for autonomous coding agents implementing the **Budget & Treasury** (`apps/budget`) micro-service and micro-frontend application in the Alfheim Monorepo.

---

## Architecture & Code Guidelines

1. **Strict Feature-Driven Design (FDD) - Backend:**
   - Layering order: `models.py` -> `repository.py` (DB queries) -> `service.py` (Business logic & triggers) -> `router.py` (Pydantic I/O validation) -> `mcp_tools.py`.
   - Private helper functions must start with `_` (e.g., `_calculate_cascade(...)`).
   - Public interfaces must be explicitly exported using `__all__` in `__init__.py`.
   - All code comments in source code files MUST be written in English.

2. **Multi-Tenancy & Security:**
   - Every database entity must include `household_id: UUID`.
   - Incoming HTTP requests must validate the `X-Household-ID` header against Keycloak JWT claims (`household_id`, `active_household_id`, or `households`).

3. **Audit Trail:**
   - All mutations (CREATE, UPDATE, DELETE) must produce immutable entries in `AuditLog` storing `user_id`, `action`, `entity_name`, `entity_id`, `old_values` (JSON), and `new_values` (JSON).

4. **Frontend Architecture:**
   - Next.js 16 App Router using `src/proxy.ts` (do NOT use deprecated `middleware.ts`).
   - Maximum limit of 200 lines of code (LOC) per file across all frontend code.
   - Centralize reusable financial components and i18n dictionaries in `@alfheim/shared`.

---

## Phase 1: Foundation & Base Setup

### [x] TASK-101: Project Directory Structure & Pyproject Setup
- **Domain/Layer:** Backend / Infrastructure
- **Scope & Files:**
  - `apps/budget/backend/pyproject.toml`
  - `apps/budget/backend/Dockerfile`
  - `apps/budget/backend/.env.example`
  - `apps/budget/backend/src/main.py`
  - `apps/budget/backend/src/core/config.py`
  - `apps/budget/backend/src/core/database.py`
- **Requirements & Business Logic:**
  - Initialize the `apps/budget/backend` Python microservice using `uv` workspace package manager.
  - Configure `pyproject.toml` with `fastapi`, `sqlmodel`, `alembic`, `pydantic-settings`, `backend-shared` workspace dependency (`[tool.uv.sources] backend-shared = { workspace = true }`).
  - Implement standard FastAPI setup in `main.py` with `/healthz` and `/metrics` endpoints.
  - Setup async SQLAlchemy database engine pointing to PostgreSQL or SQLite fallback for testing.
- **Verification:**
  - `cd apps/budget/backend && uv run ruff check .`
  - `cd apps/budget/backend && uv run pytest`

### [x] TASK-102: Docker Compose & Infrastructure Orchestration
- **Domain/Layer:** Infrastructure / DevOps
- **Scope & Files:**
  - `compose.yaml`
  - `apps/budget/compose.yml`
- **Requirements & Business Logic:**
  - Add `budget-db` (PostgreSQL 16), `budget-backend` (FastAPI), and `budget-frontend` (Next.js) services to `compose.yaml` or `apps/budget/compose.yml`.
  - Connect containers to Docker networks: `gateway-net`, `observability-internal`, `app-budget-net`.
  - Configure backend build context to monorepo root (`context: ../..`) to enable `uv` workspace resolution.
  - Set mandatory environment variables (`S3_ACCESS_KEY`, `S3_SECRET_KEY`, `DATABASE_URL`, `KEYCLOAK_URL`).
- **Verification:**
  - `docker compose config`

### [x] TASK-103: Caddy Ingress Gateway Routing Configuration
- **Domain/Layer:** Infrastructure / Ingress
- **Scope & Files:**
  - `infrastructure/caddy/Caddyfile`
- **Requirements & Business Logic:**
  - Add frontend handle path in Caddyfile: `/budget*` proxies to `budget-frontend:3000`.
  - Add API gateway proxy path: `/api/v1/budget*` (or stripped handle_path `/budget*`) to `budget-backend:8000`.
  - Ensure CORS origin and custom headers (`X-Household-Id`, `X-Household-Role`) are properly forwarded.
- **Verification:**
  - `caddy validate --config infrastructure/caddy/Caddyfile`

### [x] TASK-104: Database Migration Pipeline (Alembic)
- **Domain/Layer:** Backend / Database
- **Scope & Files:**
  - `apps/budget/backend/alembic.ini`
  - `apps/budget/backend/alembic/env.py`
  - `apps/budget/backend/alembic/versions/0001_initial_schema.py`
- **Requirements & Business Logic:**
  - Configure Alembic to connect to `budget-db` using async engine.
  - Generate initial migration file for base budget schema tables.
- **Verification:**
  - `cd apps/budget/backend && uv run alembic check`

---

## Phase 2: Auth, Tenancy & Audit Logging

### [ ] TASK-201: Tenant Isolation & JWT Header Verification Dependency
- **Domain/Layer:** Backend / Auth
- **Scope & Files:**
  - `apps/budget/backend/src/core/auth.py`
  - `apps/budget/backend/src/core/dependencies.py`
  - `apps/budget/backend/src/tests/test_auth.py`
- **Requirements & Business Logic:**
  - Implement FastAPI dependency `get_current_tenant` to extract and validate `X-Household-ID` request header.
  - Verify `X-Household-ID` against JWT claims (`household_id`, `active_household_id`, or `households`).
  - Return HTTP 403 Forbidden if household mismatch occurs; return HTTP 401 Unauthorized if token missing/invalid.
- **Verification:**
  - `cd apps/budget/backend && uv run pytest src/tests/test_auth.py`

### [ ] TASK-202: Immutable Audit Log System & Event Hooks
- **Domain/Layer:** Backend / Core Audit
- **Scope & Files:**
  - `apps/budget/backend/src/core/audit/models.py`
  - `apps/budget/backend/src/core/audit/repository.py`
  - `apps/budget/backend/src/core/audit/hooks.py`
  - `apps/budget/backend/src/tests/test_audit.py`
- **Requirements & Business Logic:**
  - Define `AuditLog` SQLModel entity: `id` (UUID), `household_id` (UUID), `user_id` (UUID), `action` (CREATE/UPDATE/DELETE), `entity_name` (str), `entity_id` (UUID), `old_values` (JSON), `new_values` (JSON), `timestamp` (datetime).
  - Setup SQLAlchemy session event listeners or model hooks to intercept insert/update/delete operations and automatically insert an immutable audit record.
- **Verification:**
  - `cd apps/budget/backend && uv run pytest src/tests/test_audit.py`

---

## Phase 3: Backend Domain Features (Strict FDD)

### [ ] TASK-301: Accounts Domain Implementation
- **Domain/Layer:** Backend / Accounts
- **Scope & Files:**
  - `apps/budget/backend/src/features/accounts/models.py`
  - `apps/budget/backend/src/features/accounts/repository.py`
  - `apps/budget/backend/src/features/accounts/service.py`
  - `apps/budget/backend/src/features/accounts/router.py`
  - `apps/budget/backend/src/features/accounts/__init__.py`
  - `apps/budget/backend/src/tests/test_accounts.py`
- **Requirements & Business Logic:**
  - Model accounts: Girokonto (`CHECKING`), Tagesgeld/Sparkonto (`SAVINGS`), Bausparer (`BUILDING_SAVINGS` with target amount & maturity date), Depot (`INVESTMENT` for Net-Worth tracking).
  - Repository methods for CRUD filtered strictly by `household_id`.
  - Service functions for balance calculations and net worth aggregates.
  - Export public interface via `__all__` in `__init__.py`. Private helper methods prefixed with `_`.
- **Verification:**
  - `cd apps/budget/backend && uv run pytest src/tests/test_accounts.py`

### [ ] TASK-302: Virtual Pots (Buckets) & Sinking Fund Calculator
- **Domain/Layer:** Backend / Pots
- **Scope & Files:**
  - `apps/budget/backend/src/features/pots/models.py`
  - `apps/budget/backend/src/features/pots/repository.py`
  - `apps/budget/backend/src/features/pots/service.py`
  - `apps/budget/backend/src/features/pots/router.py`
  - `apps/budget/backend/src/features/pots/__init__.py`
  - `apps/budget/backend/src/tests/test_pots.py`
- **Requirements & Business Logic:**
  - Model virtual pots with priority numbers (1 = Sinking Funds / fixed bills up to 10 = fun money).
  - Priority cascade overflow logic (`cascade` to next priority pot, `unassigned` buffer, or `investment`).
  - Sinking Fund Calculator: Compute dynamic target savings rate vs actual rate, returning warning status if gap detected.
  - Endpoint to receive maintenance reserve requests from `maintenance` app.
- **Verification:**
  - `cd apps/budget/backend && uv run pytest src/tests/test_pots.py`

### [ ] TASK-303: Plans & Categories Allocation Domain
- **Domain/Layer:** Backend / Plans
- **Scope & Files:**
  - `apps/budget/backend/src/features/plans/models.py`
  - `apps/budget/backend/src/features/plans/repository.py`
  - `apps/budget/backend/src/features/plans/service.py`
  - `apps/budget/backend/src/features/plans/router.py`
  - `apps/budget/backend/src/features/plans/__init__.py`
  - `apps/budget/backend/src/tests/test_plans.py`
- **Requirements & Business Logic:**
  - Separate plan types: `MONTHLY` (recurring monthly budget) vs `EVENT` (project-based budget, e.g., Relocation with subcategories like Kitchen -> Refrigerator).
  - Plans represent budget allocations; transactions optionally link to pot, account, and plan/category.
- **Verification:**
  - `cd apps/budget/backend && uv run pytest src/tests/test_plans.py`

### [ ] TASK-304: Transactions & RustFS S3 Receipt Uploads
- **Domain/Layer:** Backend / Transactions & Receipts
- **Scope & Files:**
  - `apps/budget/backend/src/features/transactions/models.py`
  - `apps/budget/backend/src/features/transactions/repository.py`
  - `apps/budget/backend/src/features/transactions/service.py`
  - `apps/budget/backend/src/features/transactions/router.py`
  - `apps/budget/backend/src/features/transactions/__init__.py`
  - `apps/budget/backend/src/tests/test_transactions.py`
- **Requirements & Business Logic:**
  - Support manual booking and quick-add transactions.
  - S3 client integration with RustFS Object Storage for receipt upload presigned URLs and binary storage.
  - Model receipt OCR/AI extracted payload: vendor name, total amount, line items split.
- **Verification:**
  - `cd apps/budget/backend && uv run pytest src/tests/test_transactions.py`

---

## Phase 4: FastMCP Tool Server

### [ ] TASK-401: FastMCP SSE Server & Tool Definitions
- **Domain/Layer:** Backend / FastMCP
- **Scope & Files:**
  - `apps/budget/backend/src/mcp/server.py`
  - `apps/budget/backend/src/mcp/tools.py`
  - `apps/budget/backend/src/tests/test_mcp.py`
- **Requirements & Business Logic:**
  - Mount FastMCP SSE router in FastAPI app.
  - Tools must call service layer exclusively:
    - `get_pot_balances(household_id: UUID)`
    - `suggest_budget_allocation(household_id: UUID, income: float)`
    - `analyze_spending_gap(household_id: UUID, month: str)`
    - `calculate_sinking_gap(household_id: UUID, pot_id: UUID)`
- **Verification:**
  - `cd apps/budget/backend && uv run pytest src/tests/test_mcp.py`

---

## Phase 5: Shared UI Primitives (@alfheim/shared)

### [ ] TASK-501: Shared Financial Components & Form Elements
- **Domain/Layer:** Shared / UI
- **Scope & Files:**
  - `packages/shared/src/features/finance/BucketMeter.tsx`
  - `packages/shared/src/features/finance/CurrencyInput.tsx`
  - `packages/shared/src/features/finance/MoneyDisplay.tsx`
  - `packages/shared/src/features/finance/ReceiptDropzone.tsx`
  - `packages/shared/src/features/finance/MetricStatCard.tsx`
  - `packages/shared/src/index.ts`
- **Requirements & Business Logic:**
  - Build accessible, responsive UI primitives for finance apps in `@alfheim/shared`.
  - Max 200 LOC per file limit.
  - Export components from `@alfheim/shared` entrypoint.
- **Verification:**
  - `pnpm --filter @alfheim/shared build`
  - `pnpm --filter @alfheim/shared test`

---

## Phase 6: Frontend Feature Implementation

### [ ] TASK-601: Next.js 16 App Router Setup & Auth Proxy
- **Domain/Layer:** Frontend / Setup
- **Scope & Files:**
  - `apps/budget/frontend/package.json`
  - `apps/budget/frontend/next.config.js`
  - `apps/budget/frontend/src/proxy.ts`
  - `apps/budget/frontend/src/app/layout.tsx`
  - `apps/budget/frontend/src/app/page.tsx`
- **Requirements & Business Logic:**
  - Create Next.js 16 app with `src/proxy.ts` for route auth forwarding.
  - Ensure strict line count constraint (<= 200 LOC per file).
- **Verification:**
  - `pnpm --filter @alfheim/budget-frontend check-types`
  - `pnpm --filter @alfheim/budget-frontend build`

### [ ] TASK-602: Mobile Bottom-Tab & Responsive Layout Shell
- **Domain/Layer:** Frontend / Navigation
- **Scope & Files:**
  - `apps/budget/frontend/src/features/navigation/MobileTabBar.tsx`
  - `apps/budget/frontend/src/features/navigation/DesktopSidebar.tsx`
- **Requirements & Business Logic:**
  - Mobile view: Exactly 4 bottom tabs (Dashboard, Planning [Monat / Event Segmented Control], Quick-Add [+], Pots).
  - Desktop view: Full sidebar navigation including Sankey cashflow view & Net-Worth analytics.
- **Verification:**
  - `pnpm --filter @alfheim/budget-frontend test`

### [ ] TASK-603: i18n Dictionary Integration (DE, EN, PL)
- **Domain/Layer:** Shared / i18n
- **Scope & Files:**
  - `packages/shared/src/features/i18n/locales/de/budget.json`
  - `packages/shared/src/features/i18n/locales/en/budget.json`
  - `packages/shared/src/features/i18n/locales/pl/budget.json`
- **Requirements & Business Logic:**
  - Provide translation dictionaries for German, English, and Polish for all budget entities and actions.
- **Verification:**
  - `pnpm --filter @alfheim/shared build`

---

## Phase 7: Ecosystem Integration & End-to-End Gate

### [ ] TASK-701: Maintenance Reserve Cross-App Trigger
- **Domain/Layer:** Cross-App / Integration
- **Scope & Files:**
  - `apps/maintenance/backend/src/services/budget_client.py`
  - `apps/budget/backend/src/features/pots/router.py`
- **Requirements & Business Logic:**
  - Integrate webhook trigger between `maintenance` app (e.g. washing machine filter maintenance alert) and `budget` pots reservation endpoint.
- **Verification:**
  - `cd apps/budget/backend && uv run pytest`

### [ ] TASK-702: Dashboard Core App Registration
- **Domain/Layer:** Core / Registry
- **Scope & Files:**
  - `core/dashboard/backend/internal/features/apps/tier1_core_registry.go`
- **Requirements & Business Logic:**
  - Register Budget & Treasury app in Go Tier-1 Core Apps registry (`ID: "budget"`, `Slug: "budget"`, `Title: "Budget & Treasury"`).
- **Verification:**
  - `cd core/dashboard/backend && go test -v -race -cover ./...`

### [ ] TASK-703: Staged Boot Script (`scripts/up.sh`) Integration
- **Domain/Layer:** DevOps / Scripts
- **Scope & Files:**
  - `scripts/up.sh`
- **Requirements & Business Logic:**
  - Add Stage for Budget App Slice (`budget-db` -> `budget-backend` -> `budget-frontend`) into `scripts/up.sh` boot sequence.
- **Verification:**
  - `./scripts/up.sh --help`

### [ ] TASK-704: Full Workspace Verification Gate
- **Domain/Layer:** Quality Gate
- **Scope & Files:** Workspace-wide
- **Requirements & Business Logic:**
  - Execute full workspace verification including Python lint/tests, Go backend tests, and Frontend type checking/tests.
- **Verification:**
  - `./scripts/verify.sh`
