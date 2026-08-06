# Loeger-OS — Sprint Context (`.ai/CONTEXT.md`)

> **READ THIS FIRST.** This is the single source of truth for the AI agent's memory (Active Sprint, Active Apps Index, DB Schema Invariants).

---

## 📅 Current Sprint & Completed Commits

The current sprint focuses on monorepo stabilization, Feature-Driven Design (FDD) migrations, zero-hardcoding compliance, and database migrations.

### Completed Commits (Recent first):
* **`docs(context): update context map and add app READMEs for reordering`** (Active)
* **`refactor(shopping): apply FDD, component splitting, and backend-driven reordering`**
  - Split monolithic page, sidebar, and modals into clean single-responsibility subcomponents.
  - Added backend-driven reordering endpoint and list `position` column.
  - Replaced frontend localStorage sorting hacks with backend mutation updates.
* **`docs(context): refactor .ai architecture for token efficiency and strict separation`**
* **`refactor(pantry): Apply Shared FDD Architecture, Enforce Zero-Hardcoding & Connect Real Data`**
  - Migrated pantry frontend components to centralized translations in `@loeger-os/shared`.
  - Replaced fake database fetches with `pantryClient` calls.
* **`refactor(shopping): Apply Shared FDD Architecture, Enforce Zero-Hardcoding & Connect Real Data`**
  - Hooked up `shoppingListService.ts` to real database endpoints, deprecating mock lists.
* **`refactor(dashboard): Apply Shared FDD Architecture, Enforce Zero-Hardcoding & Connect Real Data`**
  - Replaced fake telemetry/shell log generators with empty states; registered backend tasks in backlog.
* **`refactor(shared): feature-driven shared architecture and centralized locale domains`**
  - Organised `@loeger-os/shared` into `features/{i18n,theme,layout,ui}` structure.
* **`refactor(infra): enforce granular vertical up.sh pipeline and sync new-app guidelines`**
  - Split `scripts/up.sh` boot sequence into standalone sequential stages (DB -> Backend -> Frontend) per app to limit resources.

---

## 📱 Active Apps Index

This index maps the active applications and services running inside the monorepo.

| Application / Folder | Tech Stack | Ingress Route (Traefik) | Database (Postgres) |
| :--- | :--- | :--- | :--- |
| **`apps/dashboard`** | Go, Next.js, OIDC | `/` (Catch-all) | `dashboard-db` |
| **`apps/pantry`** | FastAPI, Next.js, OIDC | `/pantry` / `/api/v1/pantry` | `pantry-db` (Port `5432` in dev) |
| **`apps/shopping`** | FastAPI, Next.js, OIDC | `/shopping` / `/api/v1/shopping` | `shopping-db` (Port `5433` in dev) |
| **`apps/maintenance`** | FastAPI, Next.js, OIDC | `/maintenance` / `/api/v1/maintenance` | `maintenance-db` |
| **`apps/logging-stack`**| SigNoz (Otel / ClickHouse) | `/signoz` | Clickhouse |
| **`infrastructure`** | Keycloak, Traefik | `/auth` (OIDC provider) | `postgres-iam` |

### Docker Network Map:
* **`public-ingress`** (External, owned by `infrastructure`): Connects Traefik gateway to frontends and keycloak.
* **`iam_network`** (Owned by `infrastructure`): Keycloak ↔ `postgres-iam` database.
* **`observability-internal`** (External, pre-created in `up.sh`): Backends ↔ Otel Collector ↔ ClickHouse.
* **`<app-name>-internal`** (Owned by each app's `compose.yml`): Backend ↔ DB container (isolated, not external).

---

## 🔑 Keycloak JWT Invariants
All backends validate bearer tokens issued by Keycloak (`http://loeger-os/auth`).
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

## ⚙️ Active Feature Flags
* **`OTEL_ENABLED`**: Enforces OpenTelemetry collection on FastAPI backends.
* **`TESTING`**: Set to `true` to bypass JWT verification in backend pytest suites.
* **`-b` / `--build`**: Rebuilds images before running `up.sh`.
* **`--skip-obs`**: Skips boot of Observability stack in `up.sh`.

---

## 🔗 Local URLs (Requires `/etc/hosts` resolution of `loeger-os` to `127.0.0.1`)
* Dashboard: `http://loeger-os/`
* Pantry: `http://loeger-os/pantry`
* Shopping: `http://loeger-os/shopping`
* Maintenance: `http://loeger-os/maintenance`
* Keycloak Admin: `http://loeger-os/auth/admin`
* Traefik Admin: `http://localhost:8080`
