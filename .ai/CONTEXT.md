# Alfheim — Sprint Context (`.ai/CONTEXT.md`)

> **READ THIS FIRST.** This is the single source of truth for the AI agent's memory (Active Sprint, Active Apps Index, DB Schema Invariants).

---

## 📅 Current Sprint & Completed Commits

The current sprint focuses on monorepo stabilization, Feature-Driven Design (FDD) migrations, zero-hardcoding compliance, and database migrations.

### Completed Commits (Recent first):
* **`feat(storage): deploy rustfs s3 container and implement fastapi tenant storage helper`** (Active)
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
| **`core/dashboard`** | Go, Next.js, OIDC | `alfheim.loegien.de/` (Catch-all) | `dashboard-db` (`dashboard_postgres_data`) |
| **`apps/pantry`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/pantry` / `api.alfheim.loegien.de/pantry` | `pantry-db` (`pantry_postgres_data`, Port `5432`) |
| **`apps/shopping`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/shopping` / `api.alfheim.loegien.de/shopping` | `shopping-db` (`postgres_data_shopping`, Port `5433`) |
| **`apps/maintenance`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/maintenance` / `api.alfheim.loegien.de/maintenance` | `maintenance-db` (`maintenance_postgres_data`) |
| **`apps/chores`** | FastAPI, Next.js, OIDC | `alfheim.loegien.de/chores` / `api.alfheim.loegien.de/api/v1/chores` | `chores-db` (`postgres_data_chores`, Port `5435`) |
| **`apps/logging-stack`**| SigNoz (Otel / ClickHouse) | `api.alfheim.loegien.de/signoz` | Clickhouse |
| **`infrastructure`** | Keycloak, Caddy, RustFS | `api.alfheim.loegien.de/auth` (OIDC) / `/storage/` (S3) | `postgres-iam` & `rustfs_data` |

### Docker Network Map:
* **`gateway-net`** (Bridge, pre-created in `up.sh`): Ingress proxy (Caddy) ↔ Frontends, Keycloak, RustFS S3, and API Backends.
* **`infra-net`** (Bridge, pre-created in `up.sh`): Keycloak ↔ `postgres-iam` database ↔ RustFS S3 backend.
* **`core-net`** (Bridge, pre-created in `up.sh`): Control plane `dashboard-backend` ↔ `dashboard-db`.
* **`app-<name>-net`** (Bridge, pre-created in `up.sh`): Isolated per-app database network (e.g. `app-pantry-net`, `app-shopping-net`).
* **`observability-internal`** (External, pre-created in `up.sh`): Backends ↔ Otel Collector ↔ ClickHouse.

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
