# Alfheim — Sprint Context (`.ai/CONTEXT.md`)

> **READ THIS FIRST.** This is the single source of truth for the AI agent's memory (Active Sprint, Active Apps Index, DB Schema Invariants).

---

## 📅 Current Sprint & Completed Commits

The current sprint focuses on monorepo stabilization, Feature-Driven Design (FDD) migrations, zero-hardcoding compliance, and database migrations.

### Completed Commits (Recent first):
* **`refactor(dashboard): implement 3-tier app & link architecture`** (Active)
  - Tier 1 (Core Apps): Pre-defined in `tier1_core_registry.go`, default visible, toggleable via `user_preferences` table.
  - Tier 2 (Stack Apps): Loaded from `deploy/stack-apps.yaml` on startup, dynamically role-filtered via Keycloak.
  - Tier 3 (User Links): Stored per-user in PostgreSQL `user_links` table with full REST CRUD API.
* **`docs(chores): update CONTEXT.md with final operational route configurations`**
* **`fix(dashboard): update chores portal target URL to include locale fallback (/chores/de)`**
* **`docs(chores): finalize 3-README system and update CONTEXT.md`**
* **`feat(chores): configure keycloak client, traefik routing priority, stop grace periods, and dashboard portal integration`**
* **`feat(chores): update chores-frontend Traefik routing and healthcheck to German locale fallback`**
* **`feat(chores): register chores-frontend container service and configure up.sh staged pipeline`**
* **`feat(chores): implement chores-frontend Next.js 16 app with keycloak, tailwind v4, and react query`**
* **`docs(chores): update CONTEXT.md and add chores-backend architecture details`**
* **`feat(chores): scaffold and implement chores-backend microservice with SQLModel and FastMCP`**
* **`docs(maintenance): create 3-README system (WHY/HOW app/frontend/backend) and update CONTEXT.md`**
* **`refactor(maintenance): apply Feature-Driven Design, split monolithic components (<200 lines each), and ensure null-safety guards`**
  - AddDeviceWizard (420→110 lines) → DeviceDetailsForm, MaintenanceStepsForm
  - MaintenanceMode (409→125 lines) → ManualsPanel, WizardStepContent, SuppliesPanel
  - MaintenanceView (302→95 lines) → MaintenanceMetrics, DeviceMaintenanceList
  - DeviceDetailPanel (245→65 lines) → OverviewTab, StepsTab, TimelineTab
  - ScheduledTaskItem (205→105 lines) → ScheduledTaskItemDetails
* **`docs(pantry): create 3-README system (WHY/HOW app/frontend/backend) and update CONTEXT.md`**
* **`refactor(pantry): split monolithic views into FDD-compliant SRP subcomponents (<200 lines each) and apply ?? null-safety fallbacks`**
  - StockActionModal (675→90 lines) → ProductSearchStep, QuickProductForm, QuickCategoryForm, TransactionForm
  - DashboardView (344→85 lines) → MetricSummaryCards, AlertsFeed, ShoppingSyncPanel
  - InventoryTableView (274→90 lines) → InventoryFilterBar, InventoryTableRow
  - LedgerHistoryView (230→75 lines) → LedgerFilterBar, LedgerTableRow
  - ProductCatalogView (382→55 lines) → ProductList, ProductCreateForm
  - LocationsGridView (298→70 lines) → LocationCard, LocationCreateForm
  - AnalyticsView (229→75 lines) → ConsumptionChart, CategoryStockChart
  - All 35 Vitest tests pass.
* **`refactor(pantry): migrate src/lib to src/core, split domain types, add barrel index files, fix Vitest localStorage mock`**
  - Core migration: `src/lib/ → src/core/` (api.ts, authContext.tsx, utils.ts)
  - Domain types isolated into `features/{products,locations,categories}/types.ts`
  - Barrel `index.ts` created for all 5 feature domains
  - Fixed Vitest JSDOM `localStorage` mock in `src/tests/setup.ts`
* **`docs(context): update context map and add app READMEs for reordering`**
* **`refactor(shopping): apply FDD, component splitting, and backend-driven reordering`**
  - Split monolithic page, sidebar, and modals into clean single-responsibility subcomponents.
  - Added backend-driven reordering endpoint and list `position` column.
  - Replaced frontend localStorage sorting hacks with backend mutation updates.
* **`docs(context): refactor .ai architecture for token efficiency and strict separation`**
* **`refactor(pantry): Apply Shared FDD Architecture, Enforce Zero-Hardcoding & Connect Real Data`**
  - Migrated pantry frontend components to centralized translations in `@alfheim/shared`.
  - Replaced fake database fetches with `pantryClient` calls.
* **`refactor(shopping): Apply Shared FDD Architecture, Enforce Zero-Hardcoding & Connect Real Data`**
  - Hooked up `shoppingListService.ts` to real database endpoints, deprecating mock lists.
* **`refactor(dashboard): Apply Shared FDD Architecture, Enforce Zero-Hardcoding & Connect Real Data`**
  - Replaced fake telemetry/shell log generators with empty states; registered backend tasks in backlog.
* **`refactor(shared): feature-driven shared architecture and centralized locale domains`**
  - Organised `@alfheim/shared` into `features/{i18n,theme,layout,ui}` structure.
* **`refactor(infra): enforce granular vertical up.sh pipeline and sync new-app guidelines`**
  - Split `scripts/up.sh` boot sequence into standalone sequential stages (DB -> Backend -> Frontend) per app to limit resources.

---

## 📱 Active Apps Index

This index maps the active applications and services running inside the monorepo.

| Application / Folder | Tech Stack | Ingress Route (Caddy Gateway) | Database (Postgres) |
| :--- | :--- | :--- | :--- |
| **`apps/dashboard`** | Go, Next.js, OIDC | `alfheim.loegien.de/` (Catch-all) | `dashboard-db` |
| **`apps/pantry`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/pantry` / `api.alfheim.loegien.de/pantry` | `pantry-db` (Port `5432` in dev) |
| **`apps/shopping`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/shopping` / `api.alfheim.loegien.de/shopping` | `shopping-db` (Port `5433` in dev) |
| **`apps/maintenance`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/maintenance` / `api.alfheim.loegien.de/maintenance` | `maintenance-db` |
| **`apps/chores`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/chores` / `api.alfheim.loegien.de/api/v1/chores` | `chores-db` (Port `5435` in dev) |
| **`apps/logging-stack`**| SigNoz (Otel / ClickHouse) | `api.alfheim.loegien.de/signoz` | Clickhouse |
| **`infrastructure`** | Keycloak, Caddy | `api.alfheim.loegien.de/auth` (OIDC provider) | `postgres-iam` |

### Docker Network Map:
* **`public-ingress`** (External, owned by `infrastructure`): Connects Caddy gateway to frontends and keycloak.
* **`iam_network`** (Owned by `infrastructure`): Keycloak ↔ `postgres-iam` database.
* **`observability-internal`** (External, pre-created in `up.sh`): Backends ↔ Otel Collector ↔ ClickHouse.
* **`<app-name>-internal`** (Owned by each app's `compose.yml`): Backend ↔ DB container (isolated, not external).

---

## 🔑 Keycloak JWT Invariants
All backends validate bearer tokens issued by Keycloak (`http://alfheim/auth`).
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
* SigNoz Observability UI: `http://api.alfheim.loegien.localhost/signoz`
