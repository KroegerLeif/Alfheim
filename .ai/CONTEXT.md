# Alfheim — Sprint Context (`.ai/CONTEXT.md`)

> **READ THIS FIRST.** This is the single source of truth for the AI agent's memory (Active Sprint, Active Apps Index, DB Schema Invariants).

---

## 📅 Current Sprint & Completed Commits

The current sprint focuses on monorepo stabilization, Feature-Driven Design (FDD) migrations, zero-hardcoding compliance, and database migrations.

### Completed Commits (Recent first):
* **`feat(chat): enforce household sharing rules and permissions for model blocks`**
  - Refined access rules and ownership permissions in `apps/chat/backend/internal/features/modelblocks/`: `Get` and `TriggerHealthCheck` allow owner and shared household members (`IsVisibleTo`), while `Update` and `Delete` strictly require ownership (`CanModify` -> `ErrForbidden`).
  - Added `Get` endpoint (`GET /api/v1/chat/model-blocks/{id}`) and extended handler with household context propagation for health checks.
  - Implemented `features/model-blocks/` frontend architecture (`ModelBlockCard`, `ModelBlockFormModal`, `ModelBlockManagementView`, `modelBlockService`) with clear badges ("Geteilt im Haushalt", "Privat", "System-Modell"), visibility switching, and conditional edit/delete actions.
  - Added comprehensive unit and component test suites in backend (`service_test.go`, `handler_test.go`) and frontend (`ModelBlockManagement.test.tsx`).
  - Added full i18n dictionaries across `de`, `en`, and `pl` for all model management interactions.
* **`feat(deploy): configure compose, caddy routing, and tier-1 chat app registration`**
  - Created `apps/chat/compose.yml` with `chat-db` (Postgres 16), `chat-backend` (Go), and `chat-frontend` (Next.js 16).
  - Integrated `apps/chat/compose.yml` into root `compose.yaml` and declared `app-chat-net` bridge network.
  - Added Stage 7 Chat App Slice to `scripts/up.sh` and teardown routines in `scripts/down.sh`.
  - Configured Caddy reverse-proxy routing for `/chat*` and `/api/v1/chat*`.
  - Removed orphaned `librechat` entry from `deploy/stack-apps.yaml` and registered `apps/chat` as Tier-1 Core App in `tier1_core_registry.go`.
* **`feat(pantry): integrate alfi chatwidget with contextual product data`**
  - Integrated `PantryChatProvider` and `PantryChatOverlay` into `apps/pantry/frontend/src/app/[locale]/providers.tsx`.
  - Added ALFI assistant trigger button to `ClientHeader` using `actionsSlot` in `AppHeader`.
  - Implemented dynamic contextual product triggering in `ProductList` and `InventoryTableRow` passing `entityType: "product"`, `entityId`, and `entityData` (name, barcode, brand, quantity, location).
  - Added active household ID extraction from `localStorage` (`alfheim_active_household_id`) with event listener synchronization.
  - Added `askAlfi` and `askAlfiAboutProduct` i18n keys across `de`, `en`, and `pl` `pantry.json` locale files.
  - Added Vitest test suite in `chatContext.test.tsx` verifying Header trigger, product list context forwarding, and inventory table row context forwarding.
* **`feat(shared): implement alfi chatwidget on sidepanel base`**
  - Created `packages/shared/src/features/layout/ChatWidget/` with `ChatWidget`, `ChatWidgetHeader`, `ChatWidgetMessages`, `ChatWidgetInput`, `AlfiAvatar`, `useChatStream`, and `sseClient`.
  - Implemented `AlfiAvatar` SVG mascot with interactive status states (`idle`, `thinking`, `tool_calling`, `streaming`).
  - Added app context forwarding (`sourceApp`, `sourceContext`, `entityType`, `entityId`, `entityData`) to conversation creation API.
  - Implemented SSE streaming reader in `sseClient.ts` with Bearer auth token resolution (from props or `sessionStorage` fallback).
  - Added multi-language dictionary extensions across `de`, `en`, and `pl` in `chat.json`.
  - Added Vitest and axe accessibility test suites in `ChatWidget.test.tsx`.
* **`feat(chat): implement rustfs/s3 image attachments, upload flow, and message rendering`**
  - Created `internal/shared/storage` S3 client wrapping AWS SDK v2 with idempotent bucket check (`EnsureBucketExists`), multipart upload, and tenant-isolated object key generator (`households/{household_id}/chat/...` and `users/{user_id}/chat/...`).
  - Created `internal/features/attachments` with `POST /api/v1/chat/attachments` and `GET /api/v1/chat/attachments/{id}` endpoints persisting to Postgres `image_refs`.
  - Updated `internal/features/conversations` to link uploaded `image_refs` when posting messages, returning attachments in `MessageResponseDTO`.
  - Updated `apps/chat/frontend` with `ChatInput` file picker, live upload indicator, `AttachmentPreview` staging component, and `MessageItem` attachment rendering.
  - Added unit and handler test suites for storage, attachments, and frontend components.
* **`chore(test): configure pnpm allowBuilds for msw and harmonize vitest scripts`**
  - Configured `msw: true` under `allowBuilds` in `pnpm-workspace.yaml` for pnpm 11 security policy compatibility.
  - Added `"test": "vitest run"` and `"test:watch": "vitest"` across `maintenance-frontend`, `dashboard-frontend`, and `chores-frontend` (`--passWithNoTests`).
* **`test(workspace): modernize frontend testing stack and implement FDD test suites`**
  - Integrated Vitest, React Testing Library, MSW v2, and `vitest-axe` across all workspace frontends.
  - Added FDD component, service, and accessibility test suites for Maintenance (`DevicesView`) and Dashboard (`AddAppModal`).
  - Added mock servers, handlers, and test setup harnesses across microfrontends.
  - Updated `.github/workflows/python-ci.yml` to run `uv sync --all-packages --all-groups` in root linting and type-checking jobs.
  - Added workspace synchronization step to `scripts/verify.sh` to ensure complete environment parity.
  - Updated `README.md` and `.ai/guidelines/new-app-scaffolding.md` documentation to specify `--all-packages --all-groups`.
* **`docs(ai): harmonize stack guidelines with monorepo reality (#129)`**
  - Updated `.ai/stacks/nextjs_tailwind.md` and `.ai/blueprints/new_app.md` to standardize on native `fetch` with typed API wrappers (removing deprecated `ky` client references).
  - Harmonized quality gate documentation across `.ai/guidelines/quality-gates.md`, `.ai/INDEX.md`, and `.ai/CONTEXT.md` to align with `./scripts/verify.sh` and workspace `pnpm` scripts (`pnpm check-types` / `tsc`).
* **`docs(ai): implement monorepo quality gate guidelines and local verification runner`**
  - Created `.ai/guidelines/quality-gates.md` documenting mandatory multi-stack quality gates (Python, Go, Frontend, Security, and MCP).
  - Created `scripts/verify.sh` local pre-flight runner supporting `--all`, `--python`, `--go`, `--frontend`, and `--security` checks.
  - Added `detect-private-key` and `check-case-conflict` to `.pre-commit-config.yaml`.
  - Updated `.ai/INDEX.md` and `.ai/CONTEXT.md` requiring agents to run `./scripts/verify.sh` before staging/committing code.
* **`fix(types): resolve static type checking errors reported by ty`**
  - Resolved 94 `ty` diagnostics across Pantry, Shopping, Maintenance, and Chores using `sqlmodel.col()` wrappers.
  - Standardized `Index` definitions to use string column names.
  - Added primary key null-safety assertions following database refreshes.
* **`docs(ai): add new-app scaffolding guide with ruff, ty, and pytest coverage standards`**
  - Created `.ai/guidelines/new-app-scaffolding.md` detailing workspace registration, `ruff`, `ty`, `pytest` in-memory `aiosqlite`, and standalone Docker build setup.
  - Added `ty` to root dev dependencies and `.github/workflows/python-ci.yml` quality gates.
* **`fix(docker): resolve uv workspace lockfile synchronization across backend docker builds`**
  - Standardized standalone `Dockerfile` builds using `uv sync --no-dev --no-install-project` without workspace lockfile coupling.
  - Added standard `.dockerignore` files across all backend directories to exclude `.venv`, local `uv.lock`, and caches.
* **`quality(tooling): implement ruff hooks, pre-commit, and unified pytest matrix suite`**
  - Configured root `pyproject.toml` with `[tool.uv.workspace]` linking all 4 FastAPI microservices (`pantry`, `shopping`, `maintenance`, `chores`).
  - Added centralized `ruff.toml` and `.pre-commit-config.yaml` with Astral Ruff linter/formatter and Git hygiene hooks.
  - Standardized Pytest async test configurations with `asyncio_mode = "auto"`, removing deprecated `event_loop` fixtures.
  - Harmonized in-memory SQLite (`aiosqlite`) test databases with per-test transaction rollbacks.
  - Implemented multi-tenant Household isolation and zero-trust auth integration tests across Pantry, Shopping, and Chores.
  - Resolved SQLModel `session.exec()` deprecations in Maintenance and schema type imports in Pantry.
  - Added `.github/workflows/python-ci.yml` matrix pipeline for parallel linting and pytest coverage reporting.
* **`refactor(telemetry): migrate monitoring stack from signoz to victoriastack and grafana`**
  - Migrated legacy `apps/logging-stack` to `infrastructure/telemetry` (VictoriaMetrics, VictoriaLogs, OTel Collector, Vector, Grafana).
  - Configured unified OTLP entrypoint via OpenTelemetry Collector Contrib (`:4317` / `:4318`) routing to VictoriaMetrics and VictoriaLogs.
  - Configured Vector Docker socket log harvester forwarding OTLP logs.
  - Configured Grafana with VictoriaMetrics and VictoriaLogs provisioning and Keycloak OIDC SSO.
  - Updated Caddyfile, root `compose.yaml`, `up.sh`, and `down.sh`.
  - Refactored Go dashboard backend `telemetry` service to query PromQL and LogSQL with automatic system fallback.
* **`refactor(apps): localize sidebars and docs website components`**
  - Localized expand/collapse sidebar accessibility attributes in Maintenance and Chores.
  - Localized mascot states, network topology labels, storage/basepath tags, and zero-trust footer badges in `websites/docs`.
* **`refactor(dashboard): localize app tiers, modals, and dynamic theme picker in settings`**
  - Refactored Dashboard Tier 1, Tier 2, and Tier 3 headers, counts, empty states, and toast notifications to use `t('dashboard.*')`.
  - Refactored Settings Theme Picker to dynamically iterate over `(Object.keys(THEME_TOKENS) as ThemeVariant[])` and localized builder/status strings.
  - Localized `AddAppModal.tsx`, `EditAppModal.tsx`, and `HouseholdDetailView.tsx`.
* **`feat(i18n): populate locale dictionaries and unify cache keys in shared components`**
  - Synchronized `en`, `de`, and `pl` locale dictionaries for `common.json`, `dashboard.json`, and `docs.json`.
  - Updated `HouseholdSwitcher` cache key to `'alfheim_cached_households'` and localized aria labels.
  - Localized avatar titles and logout actions in `AuthControls`.
* **`style(theme): unify design system tokens and css ingestion across frontends`**
  - Enhanced `@alfheim/shared/styles/theme.css` with `:root` CSS custom property fallbacks and Tailwind v4 `@theme` tokens.
  - Replaced local `theme.css` imports with `@import "@alfheim/shared/styles/theme.css";` across all 4 app globals.css.
  - Standardized default theme variant to `'nordic'` across all 5 layout files (`dashboard`, `pantry`, `shopping`, `maintenance`, `chores`).
* **`feat(shared): sync asset registries with brand logo variants and expanded alfi mascot states`**
  - Added primary logo mark (`logo-mark.svg`) and monochrome white variant (`logo-mark-white.svg`) under `brand/`.
  - Added complete favicon suite under `favicon_io/` (`favicon.ico`, PNGs, and `site.webmanifest`).
  - Added 8 expressive ALFI mascot states (`alfi-idle`, `alfi-thinking`, `alfi-speaking`, `alfi-listenig`, `alfi-eating`, `alfi-fixing`, `alfi-chasing`, `alfi-sleeping`).
  - Extended `AlfiState` and `BRAND_ASSETS` registries in `packages/shared/src/assets/index.ts`.
  - Wired all 8 mascot states and logo variants into `websites/docs`.
* **`feat(docs): create react vite documentation site and github pages deployment workflow`**
  - Created `websites/docs` with React 19, TypeScript, Vite 8, Tailwind CSS v4, and Lucide React.
  - Configured `base: './'` for 404-free asset loading on GitHub Pages.
  - Integrated localized documentation strings (`docs.json` for `de`, `en`, `pl`) in `@alfheim/shared`.
  - Added automated GitHub Actions deployment workflow `.github/workflows/deploy-docs.yml`.
  - Registered `websites/*` in `pnpm-workspace.yaml`.
* **`feat(storage): deploy rustfs s3 container and implement fastapi tenant storage helper`**
  - Deployed `rustfs` (MinIO/S3 API) container in `infrastructure/compose.yml` with persistent volume `rustfs_data`.
  - Added Caddy `/storage*` reverse proxy route pointing to `rustfs:9000`.
  - Added `aioboto3` to dependencies across all Python microservice backends (`pantry`, `shopping`, `maintenance`, `chores`).
  - Implemented reusable S3 storage helper `src/core/storage.py` supporting tenant-isolated paths (`households/{id}/{app}/` and `users/{id}/{app}/`) and presigned PUT/GET URLs.
* **`feat(network): enforce multi-zone docker network segmentation`**
  - Segmented Docker networks into `gateway-net`, `infra-net`, `core-net`, and per-app networks (`app-<name>-net`).
  - Removed direct DB network coupling between Pantry and Shopping (Pantry calls Shopping over `gateway-net`).
* **`refactor(core): relocate dashboard to core/dashboard and update orchestrator scripts`**
  - Moved `apps/dashboard` to `core/dashboard` (`core/dashboard/backend` & `core/dashboard/frontend`).
  - Updated Go path loader in `tier2_stack_loader.go` with 3-level parent fallback.
  - Updated `pnpm-workspace.yaml`, `scripts/up.sh`, `scripts/down.sh`, and `compose.yaml`.
* **`fix(db): add persistent volume for dashboard-db and rename pantry volume`**
  - Added persistent volume `dashboard_postgres_data` for `dashboard-db`.
  - Renamed generic `postgres_data` volume in Pantry to `pantry_postgres_data`.
* **`fix(auth): resolve Keycloak OIDC issuer matching, strict mode init, and backend token verification`**
  - Pinned Keycloak `KC_HOSTNAME` & `KC_HOSTNAME_URL` to `http://api.alfheim.loegien.localhost/auth`.
  - Fixed React 18 strict mode double-initialization using `initializedRef` across all 5 microfrontends.
  - Added URL parameter cleanup (`code`, `state`, `session_state`, `iss`) immediately post code exchange.
  - Unified token persistence in `sessionStorage` (`token_<app>` + `alfheim_access_token`).
  - Added strict issuer signature verification (`http://api.alfheim.loegien.localhost/auth/realms/alfheim`) to Go and Python FastAPI backend auth middlewares.

---

## 📱 Active Apps Index

This index maps the active applications and services running inside the monorepo.

| Application / Folder | Tech Stack | Ingress Route (Caddy Gateway) | Database / Storage |
| :--- | :--- | :--- | :--- |
| **`websites/docs`** | React 19, Vite, Tailwind v4 | GitHub Pages / Static Docs | N/A (Static SPA) |
| **`core/dashboard`** | Go, Next.js, OIDC | `alfheim.loegien.de/` (Catch-all) | `dashboard-db` (`dashboard_postgres_data`) |
| **`apps/pantry`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/pantry` / `api.alfheim.loegien.de/pantry` | `pantry-db` (`pantry_postgres_data`, Port `5432`) |
| **`apps/shopping`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/shopping` / `api.alfheim.loegien.de/shopping` | `shopping-db` (`postgres_data_shopping`, Port `5433`) |
| **`apps/maintenance`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/maintenance` / `api.alfheim.loegien.de/maintenance` | `maintenance-db` (`maintenance_postgres_data`) |
| **`apps/chores`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/chores` / `api.alfheim.loegien.de/api/v1/chores` | `chores-db` (`postgres_data_chores`, Port `5435`) |
| **`infrastructure/telemetry`** | VictoriaMetrics, VictoriaLogs, OTel, Vector, Grafana | `api.alfheim.loegien.de/grafana` | `victoriametrics_data` & `victorialogs_data` & `grafana_data` |
| **`infrastructure`** | Keycloak, Caddy, RustFS | `api.alfheim.loegien.de/auth` (OIDC) / `/storage/` (S3) | `postgres-iam` & `rustfs_data` |
| **`apps/chat`** | Go, Next.js 16, OIDC | `alfheim.loegien.de/chat` / `api.alfheim.loegien.de/api/v1/chat` | `chat-db` (`chat_postgres_data`, Port `5436`) |

### Docker Network Map:
* **`gateway-net`** (Bridge, pre-created in `up.sh`): Ingress proxy (Caddy) ↔ Frontends, Keycloak, RustFS S3, Grafana, and API Backends.
* **`infra-net`** (Bridge, pre-created in `up.sh`): Keycloak ↔ `postgres-iam` database ↔ RustFS S3 backend.
* **`core-net`** (Bridge, pre-created in `up.sh`): Control plane `dashboard-backend` ↔ `dashboard-db`.
* **`app-<name>-net`** (Bridge, pre-created in `up.sh`): Isolated per-app database network (e.g. `app-pantry-net`, `app-shopping-net`).
* **`observability-internal`** (External, pre-created in `up.sh`): Backends & Vector ↔ OTel Collector ↔ VictoriaMetrics & VictoriaLogs.

---

## 🔑 Keycloak JWT Invariants
All backends validate bearer tokens issued by Keycloak (External: `http://api.alfheim.loegien.localhost/auth`, Internal Docker JWKS: `http://keycloak:8080/auth`).
* **`sub`**: Injected as user UUID.
* **`preferred_username`**: Used for Personal List naming.
* **`household_id` / `active_household_id`**: Active household identifier (falls back to `X-Household-ID` header, then mock UUID).

---

## 🗄️ Database Schema Invariants (Shopping Service)

### Table: `shopping_lists`
* **`id`** (UUID, PK)
* **`name`** (VARCHAR(255), NOT NULL)
* **`home_id`** (UUID, NOT NULL, INDEX) - Active household
* **`owner_id`** (UUID, NOT NULL, INDEX) - Creator/Owner
* **`is_default`** (BOOLEAN, NOT NULL, Default `false`) - **Protected** Household List (max 1 per `home_id`)
* **`is_personal`** (BOOLEAN, NOT NULL, Default `false`) - **Protected** Personal List (max 1 per `owner_id`)
* **`position`** (INTEGER, NOT NULL, Default `0`) - Display position ordering index
* **`created_at`** / **`updated_at`** (TIMESTAMPTZ, NOT NULL)

#### Invariant Rules:
1. Max **one** `is_default=true` row per `home_id` (enforced in service layer).
2. Max **one** `is_personal=true` row per `owner_id` (enforced in service layer).
3. **Never** allow deletion of protected lists (`is_default` or `is_personal`) via API.

---

## 🗄️ Database Schema Invariants (Pantry Service)

### Table: `inventory_states` (live stock cache)
* **`id`** (UUID, PK)
* **`product_id`** (UUID, FK → `products.id`)
* **`location_id`** (UUID, FK → `locations.id`)
* **`household_id`** (UUID, NOT NULL, INDEX)
* **`quantity`** (FLOAT, NOT NULL) — current stock level
* **`batch_code`** (VARCHAR, NULLABLE) — lot/batch identifier
* **`expiration_date`** (DATE, NULLABLE)

### Table: `inventory_transactions` (immutable ledger)
* **`id`** (UUID, PK)
* **`product_id`** / **`location_id`** / **`household_id`** (UUID, FK)
* **`transaction_type`** (ENUM: `in`, `out`, `waste`, `reconciliation`)
* **`quantity`** (FLOAT, signed — negative for OUT/WASTE)
* **`unit_input`** (VARCHAR) — raw user unit before Pint normalization
* **`batch_code`** / **`expiration_date`** / **`notes`** (NULLABLE)
* **`created_at`** (TIMESTAMPTZ, NOT NULL)

#### Invariant Rules:
1. Transactions are **immutable** — never updated or deleted.
2. Products with a valid EAN/UPC barcode are promoted to `is_global = True` (shared across households).
3. The `Backlog` system location (`is_system = True`) cannot be renamed or deleted.
4. Unit normalization via Pint is applied before writing `quantity` to both tables.
5. Write-locks (`SELECT FOR UPDATE`) guard `inventory_states` against concurrent write races.

---

## 🗄️ Database Schema Invariants (Maintenance Service)

### Table: `device`
* **`id`** (Integer, PK)
* **`name`** / **`model`** / **`serial`** / **`category`** / **`location`** (VARCHAR, NOT NULL)
* **`status`** (VARCHAR, NOT NULL) — active, maintenance, inactive
* **`service_interval_months`** (INTEGER, NULLABLE)
* **`household_id`** (INTEGER, FK → `household.id`)

### Table: `maintenancestep`
* **`id`** (Integer, PK)
* **`title`** (VARCHAR, NOT NULL)
* **`description`** (VARCHAR, NULLABLE)
* **`recurrence`** (INTEGER, NOT NULL) — interval in months
* **`supply_item`** (VARCHAR, NULLABLE)
* **`supply_needed_date`** (VARCHAR, NULLABLE)
* **`last_completed`** (VARCHAR, NULLABLE)
* **`device_id`** (INTEGER, FK → `device.id`)

### Table: `servicehistoryevent`
* **`id`** (Integer, PK)
* **`date`** (VARCHAR, NOT NULL)
* **`performer`** (VARCHAR, NOT NULL)
* **`notes`** (VARCHAR, NULLABLE)
* **`completed_steps`** (JSON, NULLABLE) — list of completed step titles
* **`device_id`** (INTEGER, FK → `device.id`)

---

## 🗄️ Database Schema Invariants (Chores Service)

### Table: `chore_templates`
* **`id`** (UUID, PK)
* **`home_id`** (UUID, NOT NULL, INDEX) - Active household
* **`name`** (VARCHAR(150), NOT NULL)
* **`description`** (VARCHAR(500), NULLABLE)
* **`points`** (INTEGER, NOT NULL, Default `10`)
* **`is_non_cumulative`** (BOOLEAN, NOT NULL, Default `true`)

### Table: `chore_instances`
* **`id`** (UUID, PK)
* **`template_id`** (UUID, FK → `chore_templates.id`, NOT NULL)
* **`home_id`** (UUID, NOT NULL, INDEX)
* **`assigned_to`** (UUID, NULLABLE)
* **`completed_by`** (UUID, NULLABLE)
* **`completed_at`** (TIMESTAMPTZ, NULLABLE)
* **`due_date`** (DATE, NOT NULL, INDEX)
* **`status`** (VARCHAR(20), NOT NULL, Default `"pending"`) - Enum: pending, completed, missed
* **`points_awarded`** (INTEGER, NOT NULL, Default `0`)

### Table: `household_streaks`
* **`id`** (UUID, PK)
* **`home_id`** (UUID, NOT NULL, UNIQUE, INDEX)
* **`current_streak`** (INTEGER, NOT NULL, Default `0`)
* **`longest_streak`** (INTEGER, NOT NULL, Default `0`)
* **`last_completed_date`** (DATE, NULLABLE)

#### Invariant Rules:
1. **Name Uniqueness**: Chore template names must be unique within a household (enforced via index uq_chore_template_name_per_home).
2. **Instance Uniqueness**: Only one instance per chore template can be scheduled for a given date (enforced via index uq_chore_instance_template_per_date).
3. **Streak Integrity**: Streaks are incremented if all scheduled chores for a day are completed. If any chore is left uncompleted, it is marked as "missed" and the streak resets to 0 during the daily reset.
4. **Self-Healing Reset**: If the system is offline, the daily reset runs retroactively on the first access of a household's chores list for that day.

---

## 🗄️ Database Schema Invariants (Chat Service — `apps/chat/backend`, Go)

> **Status**: Phase 0-6. Backend skeleton, migrations, JWT auth (issuer + audience), `/api/v1/chat/health`, the `internal/shared/llm` provider abstraction (**Ollama and OpenAI-compatible implemented**; Anthropic still returns a clear "not implemented yet" error), the `model-blocks` feature (CRUD, AES-256-GCM key encryption, ownership/sharing rules, on-demand health checks, ENV bootstrap seeding), the `conversations` feature (CRUD for conversations/messages, the `GET .../stream` SSE endpoint, and a full multi-round MCP tool-calling loop), the `mcpservers` registry feature (seeded from `CHAT_MCP_SERVERS`, admin enable/disable), `internal/shared/mcp` (a from-scratch Streamable HTTP client for the Fach-Apps' FastMCP servers), and `attachments` / `internal/shared/storage` (S3/RustFS storage client, idempotent bucket check, multipart upload, tenant-isolated object keys, and `image_refs` metadata persistence). Next.js 16 frontend (`apps/chat/frontend`) with conversation list, SSE chat streaming view, `ChatInput` file picker, `AttachmentPreview` staging component, and `MessageItem` attachment rendering. Not yet wired into `compose.yaml`, `scripts/up.sh`, or the Caddyfile.

### Table: `model_blocks`
* **`id`** (UUID, PK), **`owner_user_id`** (Keycloak sub), **`household_id`** (NULLABLE — NULL means private)
* **`visibility`** (`private` | `shared`) — shared blocks are usable by household members but only editable by the owner
* **`provider_type`** (`ollama` | `openai_compatible`, `anthropic` planned), **`base_url`**, **`model_identifier`**
* **`api_key_encrypted`** (AES-256-GCM ciphertext, BYTEA, NULLABLE), **`api_key_key_id`** (default `v1`, enables future key rotation)
* **`health_status`** (`ok` | `unreachable` | `auth_invalid` | `unknown`), **`health_checked_at`**, **`health_detail`**
* **`is_bootstrap`** — set on the idempotent, first-startup-only upsert seeded from `CHAT_BOOTSTRAP_*` env vars

### Table: `mcp_server_registry`
* Seeded/re-synced on every startup from `CHAT_MCP_SERVERS` (`internal/features/mcpservers`) — `app_slug`, `internal_url` (e.g. `http://pantry-backend:8000/mcp`), `enabled`. Re-seeding upserts `internal_url` by `app_slug` but never resets an admin's `enabled` toggle. No MCP server code is added by this feature; `internal/shared/mcp` is a from-scratch Streamable HTTP **client** (initialize handshake, session id, JSON or SSE response bodies) that talks to the Fach-Apps' existing FastMCP servers.

### Tables: `conversations`, `messages`, `image_refs`
* `conversations.source_app`/`source_context` capture the host Fach-App and its context when opened from the embedded chat widget (vs. NULL for the full chat app).
* `messages.role` in (`user`,`assistant`,`system`,`tool`); `image_refs.storage_key` points at RustFS.

#### Invariant Rules:
1. API key plaintext never leaves the backend — response DTOs expose only `has_api_key: bool`.
2. Shared `model_blocks` are usable by household members; only `owner_user_id` may edit, delete, or trigger a health check (`ModelBlock.CanModify` in `internal/features/modelblocks/entity.go`).
3. Bootstrap blocks (`is_bootstrap = true`, `owner_user_id = "system"`) are the one exception: visible and modifiable by any authenticated user, since they have no natural personal owner. The one-time seed is tracked via the separate `bootstrap_state` table (not `model_blocks` row presence), so deleting/editing the seeded block never causes it to reappear on the next restart.
4. `internal/shared/llm.Provider` is constructed with primitive params (provider type, base URL, model, API key) — never a `modelblocks.ModelBlock` — so `internal/shared/llm` has no dependency on `internal/features/modelblocks`.
5. JWT validation in `internal/shared/middleware/auth.go` checks **both** issuer and audience (`KEYCLOAK_EXPECTED_AUDIENCE`), a deliberate divergence from `core/dashboard/backend`'s issuer-only check.
6. Conversations are always personal (`owner_user_id` only) — unlike `model_blocks`, there is no household-shared visibility for a conversation itself; a household member with access to a shared model block still gets their own separate conversation using it.
7. `GET /api/v1/chat/conversations/{id}/stream` requires the conversation's last message to be an unanswered `role='user'` message (`ErrNoPendingUserMessage` otherwise). The completed assistant reply is persisted via `AppendMessageAndTouchConversation` (single transaction: insert message + bump `conversations.updated_at`), using a fresh 5s `context.Background()` timeout independent of the HTTP request context, so a client disconnecting right as the stream finishes cannot cause the reply to be silently lost. A stream that ends in an `Err` chunk persists nothing.
8. `internal/features/conversations` depends on `internal/shared/llm` and defines its own narrow `ModelBlockResolver` interface (satisfied structurally by `modelblocks.Service`) rather than importing `internal/features/modelblocks` — kept decoupled per this repo's Go interface convention (defined at the consumer).
9. The chat-backend HTTP server sets a long `WriteTimeout` (10 minutes, see `cmd/server/main.go`) specifically because the SSE endpoint holds the response open for as long as the model takes to reply; `ReadTimeout` stays short (15s).
10. The frontend cannot use the browser's native `EventSource` for streaming because it cannot send an `Authorization` header; `apps/chat/frontend/src/lib/api.ts`'s `streamAssistantReply` instead reads the `text/event-stream` response body manually via `fetch()` + `ReadableStream`.
11. The tool-calling loop (`conversations.service.runToolLoop`) forwards every provider chunk live to the client (`delta`, `tool_call`) but deliberately **never forwards an intermediate round's `Done` chunk** — a round ending is not the same as the whole assistant turn ending. Only the final round (no more tool calls, or the round limit reached) emits the terminal `Done`/`Err` chunk that ends the SSE response.
12. `tool_round_limit` and `allowed_mcp_apps` live in a model block's `config_json` and are parsed into `llm.ProviderPolicy` by `modelblocks.parseProviderPolicy` (default round limit: 8). `llm.ProviderPolicy` lives in `internal/shared/llm` — not on the `modelblocks` or `conversations` domain types — specifically so both features can share it without one importing the other.
13. `internal/features/conversations` never imports `internal/features/mcpservers` or `internal/shared/mcp`'s concrete `*mcp.ClientPool` type directly in its exported `Service`/`NewService` signature: it defines its own `MCPServerLister` and `MCPClientPool` consumer interfaces (`toolbridge.go`), satisfied structurally. `mcp.ClientPool.Get` returns the `mcp.ToolCaller` interface (not `*mcp.Client`) specifically so tests can substitute a fake without a real MCP server.
14. `OpenAICompatibleProvider` (`internal/shared/llm/openai_compatible_provider.go`) expects `model_blocks.base_url` to be the API root **without** a trailing `/v1` (e.g. `https://api.openai.com`, not `.../v1`) — it appends `/v1/chat/completions` and `/v1/models` itself, per this phase's explicit spec. Streamed tool-call arguments arrive as fragmented JSON-string deltas keyed by index (unlike Ollama's single complete `tool_calls` list); they are buffered per index and only turned into `StreamChunk{ToolCall: ...}` once `finish_reason == "tool_calls"` (or the connection closes without an explicit `data: [DONE]` frame, which some providers omit).

---

## ⚙️ Active Feature Flags
* **`OTEL_ENABLED`**: Enforces OpenTelemetry collection on FastAPI backends.
* **`TESTING`**: Set to `true` to bypass JWT verification in backend pytest suites.
* **`-b` / `--build`**: Rebuilds images before running `up.sh`.
* **`--skip-obs`**: Skips boot of Observability stack in `up.sh`.

---

## 🔗 Local URLs (Requires `/etc/hosts` resolution of `127.0.0.1 alfheim.loegien.localhost api.alfheim.loegien.localhost`)
* Dashboard: `http://alfheim.loegien.localhost/`
* Pantry: `http://alfheim.loegien.localhost/pantry`
* Shopping: `http://alfheim.loegien.localhost/shopping`
* Maintenance: `http://alfheim.loegien.localhost/maintenance`
* Chores: `http://alfheim.loegien.localhost/chores`
* Central API Gateway: `http://api.alfheim.loegien.localhost/api/v1`
* Keycloak IAM: `http://api.alfheim.loegien.localhost/auth`
* Grafana Telemetry UI: `http://alfheim.loegien.localhost/grafana` (API alias: `http://api.alfheim.loegien.localhost/grafana`)
