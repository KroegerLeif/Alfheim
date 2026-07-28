# Loeger-OS — Sprint Context (`ai/CONTEXT.md`)

> **READ THIS FIRST.** Future AI agents must read this document before performing any file audit.
> It captures the current sprint state, completed work, DB schema invariants, and active feature flags
> so agents can resume work immediately without expensive repo-wide exploration.

---

## Quick-Resume Checklist for AI Agents

1. Read [`ai/CORE.md`](./CORE.md) — universal coding standards (English comments, FDD, Conventional Commits).
2. Read this file (`ai/CONTEXT.md`) — current sprint state and DB invariants.
3. Read [`ai/ARCHITECTURE.md`](./ARCHITECTURE.md) — full service map, Traefik routing, JWT claims.
4. Read the relevant stack guide in [`ai/stacks/`](./stacks/) for the service you are modifying.
5. **Do NOT re-audit the entire monorepo.** Use the architecture doc as your map.

---

## Current Sprint — Completed Commits

### `feat(shopping): overhaul UI with unified light/dark mode, figma sidepanel, and stitch layout`

**Date**: 2026-07-28

#### Summary
1. **Unified Global Light/Dark Mode System**:
   - Removed legacy multi-variant theme pickers ("obsidian", "kinetic").
   - Implemented a clean, standard 2-way Light/Dark toggle switch (`ThemeToggle.tsx`) that dynamically toggles `.dark` on `document.documentElement` (`next-themes`).
   - All surfaces (sidepanel, top bar, main canvas cards, quick-add tiles, checklist rows, modal overlays) switch color scheme simultaneously with full contrast and high legibility.
2. **Global Top Header Bar Integration**:
   - Created sticky top application bar (`Header.tsx`) across all views consolidating system chrome:
     - Left: "Back to Dashboard" button (`http://loeger-os/`) with back arrow icon and sidebar toggle.
     - Right: i18n Language Selector (DE/EN toggle) updating `next-intl` locale and standardized 2-way Light/Dark switch button.
3. **Figma Export & Stitch Sidepanel Refactoring**:
   - Replaced legacy sidebar with Figma Export structure (`Sidebar.tsx`):
     - Workspace brand header (`loeger-os / Shopping List Management`).
     - System Lists section featuring protected Household List ("Haushalt") and Personal User List ("{username} - Liste") pinned at top with icon badges and active indicators.
     - Custom Lists section with inline "+ New List" creation input and item count badges (`completed/total`).
     - User Profile / Account section at bottom displaying Keycloak user avatar, display name, username, and functioning Logout CTA button (`useKeycloakUser.ts`).
     - Desktop persistent/collapsible drawer & Mobile overlay drawer with backdrop blur (`Sidebar.tsx`).
4. **Main Content Canvas Redesign (`stitch_loeger_os` Alignment)**:
   - Active list summary header banner with progress ring indicator (`% completed`), list type badge, and action bar ("Share", "Print", "Clear Completed", "Store Einkauf").
   - Quick Add Article Form Card (`AddManualItem.tsx`) with item search input, quantity stepper, category selector, and unit popover.
   - Frequently Bought Quick-Tile Grid (`QuickAddGrid.tsx`) with scaling micro-interactions.
   - Categorized Main Checklist View (`ChecklistContainer.tsx`) with intelligent category grouping (Produce 🥦, Dairy 🧀, Bakery 🍞, Household 🧹, Meat 🥩, Pantry 🥫, Beverages 🥤, Other 📦), custom checkboxes (`GlassCheckbox.tsx`), strikethrough animations, and Pantry integration badges.

#### Verification
- `pnpm --filter shopping-frontend exec tsc --noEmit` passed cleanly with exit code 0.

---

#### Root cause
1. **Transaction Rollback in Startup `init_db()`**: In `apps/shopping/backend/src/core/database.py`, `init_db()` ran `SQLModel.metadata.create_all` inside the same `async with engine.begin() as conn:` transaction block as raw DDL statements (`ALTER TABLE shoppinglist ...`). Because table `shoppinglist` (singular) did not exist, PostgreSQL threw an `UndefinedTableError`. Even though Python caught the exception, SQLAlchemy 2.0 transaction managers mark any failed DB-level statement within an `engine.begin()` block as aborted and automatically rolled back the entire transaction including `create_all`. This left the `shopping` database with 0 tables, causing `GET /api/v1/shopping/lists` to throw `UndefinedTableError: relation "shopping_lists" does not exist` (HTTP 500).

#### Fix
1. **Isolated Database Transactions (`database.py`)**: Ran `SQLModel.metadata.create_all` in its own isolated `async with engine.begin()` transaction block. Wrapped subsequent DDL column migration statements for `shopping_lists` in separate individual `async with engine.begin()` blocks, removing non-existent table references.

#### Verification
- `docker exec shopping-db psql -U postgres -d shopping -c "\dt"` verified all 3 tables (`shopping_lists`, `shopping_items`, `shopping_history`) created and persisted.
- `./scripts/seed.sh` executed cleanly and populated demo lists ("Haushalt" and "Personal").
- `curl -s -o /dev/null -w "%{http_code}" -H "Host: loeger-os" http://localhost/shopping/en` returned HTTP 200 OK.

---

#### Root cause
1. **Uninitialized SQLAlchemy Model Relationship Serialization**: When lazy auto-provisioning created new `ShoppingList` records in `_ensure_personal_list` and `_ensure_household_list`, the `items` relationship attribute on freshly instantiated models remained uninitialized (`None`). Pydantic's `ShoppingListRead` schema expected `items: List[ShoppingItemRead] = []` and threw a Pydantic `ValidationError` when attempting to serialize `None`, resulting in HTTP 500 Internal Server Errors.
2. **Non-String Claim Evaluation**: `_personal_list_name` was vulnerable to `AttributeError` if `username` was non-string.

#### Fix
1. **Schemas (`schemas.py`)**: Added `@field_validator("items", mode="before")` to `ShoppingListRead` to normalize `None` inputs to `[]`.
2. **Service (`service.py`)**: Explicitly normalized `personal.items` and `household.items` to `[]` prior to returning from `_ensure_personal_list`, `_ensure_household_list`, and `get_lists`. Hardened `_personal_list_name` with `isinstance(username, str)`.

#### Verification
- Pytest suite in `apps/shopping/backend` passed 100% (7/7 passed).
- Container rebuild (`shopping-backend`) completed and health check returned HTTP 200 OK.

---

#### Root cause
1. **Container JWKS Resolution & PyJWT Validation**: In `apps/shopping/backend`, `KEYCLOAK_URL` defaulted to `http://localhost:8080/auth`. Inside Docker containers, `localhost:8080` points to the container itself (where Keycloak is absent), causing JWKS fetches to fail with Connection Refused (`127.0.0.1:8080`) and returning HTTP 401 Unauthorized. Additionally, PyJWT issuer validation rejected browser tokens issued with `iss="http://loeger-os/auth/realms/loeger-os"` when decoded internally.
2. **Frontend 401 Unhandled State**: `apps/shopping/frontend/src/lib/api.ts` lacked a 401 response interceptor to handle token refresh or trigger re-authentication, leaving React Query in an unhandled error state.

#### Fix
1. **Shopping Backend (`compose.yml`, `config.py`, `dependencies.py`)**:
   - Passed `KEYCLOAK_URL=http://keycloak:8080/auth` and `KEYCLOAK_PUBLIC_URL=http://loeger-os/auth` in `compose.yml`.
   - Updated `config.py` with `KEYCLOAK_PUBLIC_URL` and `jwks_fallback_urls` helper.
   - Updated `dependencies.py` `decode_keycloak_token()` to iterate through fallback JWKS endpoints and pass `options={"verify_aud": False, "verify_iss": False}` to PyJWT `jwt.decode(...)`.
2. **Shopping Frontend (`providers.tsx`, `api.ts`, `page.tsx`)**:
   - Attached `keycloak` instance to `(window as any).__keycloak_instance__` in `providers.tsx`.
   - Added a 401 response interceptor in `lib/api.ts` that triggers `keycloak.updateToken(30)` or `keycloak.login()`.
   - Enhanced `page.tsx` list query error state to render a dedicated **"Session Expired - Re-authenticate"** UI card with a direct **"Log In"** button when 401/403 errors occur.

#### Verification
- `pnpm --filter shopping-frontend exec tsc --noEmit` passed cleanly (exit code 0).
- Pytest unit tests in `apps/shopping/backend` passed 100% (7/7 passed).
- Docker image rebuild and startup verified healthy startup in container logs.

---

#### Root cause
1. **Multi-statement DDL in `asyncpg`**: In `apps/shopping/backend/src/core/database.py`, multiple SQL statements were passed in a single string separated by `;` to `conn.execute(text(...))`. `asyncpg` raises `PostgresSyntaxError: cannot insert multiple commands into a prepared statement` when executing multiple SQL commands in a single prepared statement context.
2. **Traefik Router Priority**: `apps/maintenance/compose.yml` specified explicit `priority=1` and `priority=10` on frontend routers, which overrode Traefik's automatic rule length matching and routed subpath requests to `dashboard-frontend` instead of `maintenance-frontend`.

#### Fix
1. **Shopping Backend (`database.py`)**: Iterated over DDL statements individually in a loop (`for stmt in statements: await conn.execute(text(stmt))`), wrapping each in `try/except` to prevent asyncpg syntax errors.
2. **Maintenance Compose (`compose.yml`)**: Removed explicit priority overrides from `maintenance-frontend` routers, allowing Traefik's default rule length matching (`/maintenance` > `/`) to correctly route to `maintenance-frontend`.

#### E2E Lifecycle Verification Results
- `./scripts/down.sh -v` — Clean teardown including named volumes and external networks (exit code 0).
- `./scripts/up.sh` — Sequential 5-stage stack boot completed with 100% healthy services across all backends & frontends (exit code 0).
- `./scripts/seed.sh` — Demo data seeding completed with zero errors for Pantry products, Shopping lists ("Haushalt" & "Personal"), and Maintenance Hub devices.
- HTTP endpoint verification: `/shopping/en`, `/maintenance/en`, and `/maintenance/de` all returned HTTP 200 OK responses.

---

#### What was delivered

| Area | Change |
|---|---|
| Shopping DB Auto-Migration | `apps/shopping/backend/src/core/database.py` now executes raw DDL SQL (`ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS is_default...`, `is_personal...`) directly inside `init_db()` on application startup so legacy database instances update automatically without manual DDL. |
| On-Demand Lazy List Provisioning | `apps/shopping/backend/src/features/shopping_lists/service.py` `get_lists()` checks and lazily auto-provisions both the Personal List (`is_personal=True`, `owner_id=user_id`) and Household List (`is_default=True`, `home_id=household_id`) on-the-fly for any existing Keycloak user account without relying on user-creation hooks. Guaranteed 200 OK. |
| Maintenance App Routing | Fixed `apps/maintenance/frontend/src/middleware.ts` route matcher (`matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]`), preventing `next-intl` from skipping locale resolution and resolving `notFound()` 404s when accessing `/maintenance` or `/maintenance/de`. |
| `scripts/down.sh` | New executable teardown script (`./scripts/down.sh`). Cleanly stops stack, removes orphans, and supports `--volumes` / `-v` flag to tear down volumes and external networks (`observability-internal`). |
| `scripts/seed.sh` | New executable seeding script (`./scripts/seed.sh`). Populates presentation demo data across Pantry (demo products), Shopping ("Haushalt" and "Personal" list items), and Maintenance (devices & maintenance steps). |

---

### `fix(apps): resolve shopping infinite skeleton and maintenance 404 routing`

**Date**: 2026-07-27

#### Root cause
1. **Shopping App**: `providers.tsx` Keycloak `.catch()` was swallowing initialization errors without updating state, leaving `isAuthenticated` as `false` and hanging on the authentication spinner indefinitely. Additionally, `page.tsx` lacked `isError` destructuring and error UI fallback for React Query list queries.
2. **Maintenance App**: The route structure under `app/[locale]/` lacked `dashboard/page.tsx` route matching for requests to `/maintenance/[locale]/dashboard`. When hit, Next.js rendered a 404 `notFound()` view inside the main `{children}` content layout while keeping the `Sidebar` and `Header` intact.

#### Fix
1. **Shopping Frontend (`providers.tsx`, `page.tsx`)**: Added `authError` state and retry UI to Keycloak initialization in `providers.tsx`. Destructured `isError`, `error`, and `refetch` from `useShoppingLists()` in `page.tsx`, displaying an actionable error card instead of hanging on the skeleton.
2. **Maintenance Frontend (`app/[locale]/dashboard/page.tsx`, `providers.tsx`)**: Added `app/[locale]/dashboard/page.tsx` re-exporting `MaintenancePage` to support `/dashboard` subpaths cleanly. Added `authError` state and retry UI to Keycloak init in `providers.tsx`.

#### Verification
- `pnpm --filter shopping-frontend exec tsc --noEmit` passed cleanly (exit 0).
- `pnpm --filter maintenance-frontend exec tsc --noEmit` passed cleanly (exit 0).

---

### `fix(infra): align docker network creation in up.sh for clean compose execution`

**Date**: 2026-07-27

#### Root cause
`scripts/up.sh` STAGE 0 used a `for`-loop to call `docker network create` for four networks:
`public-ingress`, `observability-internal`, `pantry-internal`, `shopping-internal`.
Bare `docker network create` produces networks **without** Docker Compose project labels
(`com.docker.compose.network`, `com.docker.compose.project`). When STAGE 3 then ran
`dc up ... shopping-backend`, Compose found `pantry-internal` and `shopping-internal` already
existing but label-less → **"network was found but has incorrect label"** crash.

#### Fix
STAGE 0 now only pre-creates `observability-internal` — the single network declared
`external: true` in **every** sub-compose file (including `logging-stack`), meaning no Compose
project owns it and raw creation with no labels is correct.

All other networks are Compose-owned and must **never** be pre-created manually:

| Network | Owner | Created by |
|---|---|---|
| `public-ingress` | `infrastructure/compose.yml` | STAGE 1 `dc up -d postgres-iam traefik` |
| `pantry-internal` | `apps/pantry/compose.yml` | STAGE 3 `dc up ... pantry-backend` |
| `shopping-internal` | `apps/shopping/compose.yml` | STAGE 3 `dc up ... shopping-backend` |
| `dashboard-internal` | `apps/dashboard/compose.yml` | STAGE 3 `dc up ... dashboard-backend` |
| `maintenance-internal` | `apps/maintenance/compose.yml` | STAGE 4 `dc up ... maintenance-frontend` |
| `iam_network` | `infrastructure/compose.yml` | STAGE 1 |

#### Verification
`./scripts/up.sh --no-build` completed exit 0 through all 5 stages with every service healthy.

---

### `feat(infra): add scripts/up.sh for staged stack boot and ensure auto-provisioned household shopping list`

**Date**: 2026-07-27

#### What was delivered

| Area | Change |
|---|---|
| `scripts/up.sh` | New sequential boot orchestrator (5-stage pipeline, animated spinner, health polling, URL summary). Supports `--no-build` and `--skip-logging` flags. |
| Shopping backend — `models.py` | Added `is_default: bool` and `is_personal: bool` columns to `ShoppingList`. Both default to `false` with `server_default="false"`. |
| Shopping backend — `schemas.py` | Added `is_default: bool` and `is_personal: bool` to `ShoppingListRead` response schema. |
| Shopping backend — `service.py` | Full rewrite: `get_lists()` now auto-provisions both a **Personal List** (per `owner_id`, `is_personal=True`) and a **Household List** (per `home_id`, `is_default=True`). `delete_list()` raises `ShoppingListProtectedError` for both protected types. |
| Shopping backend — `exceptions.py` | Added `ShoppingListProtectedError` with i18n key `shopping.error.list_protected`. |
| Shopping backend — `router.py` | `get_lists()` route now passes `username=context.username` to the service for Personal List naming. |
| Shopping frontend — `schemas.ts` | Added `is_default` and `is_personal` to `ShoppingListSchema` (Zod). |
| Shopping frontend — `ListSelector.tsx` | Delete button suppressed for `is_default` and `is_personal` lists. Personal lists display `<User />` icon (blue), Household lists display `<Home />` icon (emerald). |
| Shopping frontend — `page.tsx` | Replaced async `useEffect` default-list selection with synchronous `useMemo`. Introduced `resolvedListId = activeListId ?? defaultListId` pattern to eliminate blank-screen flicker. |
| `ai/ARCHITECTURE.md` | New — comprehensive architecture reference. |
| `ai/CONTEXT.md` | New — this file. |

---

## DB Schema Invariants (Shopping Service)

> These invariants MUST be preserved across all future migrations and feature additions.

### Table: `shopping_lists`

| Column | Type | Default | Constraint | Notes |
|---|---|---|---|---|
| `id` | UUID | `uuid4()` | PK | — |
| `name` | VARCHAR(255) | — | NOT NULL, min 1 | Display name |
| `home_id` | UUID | — | NOT NULL, INDEX | Active household |
| `owner_id` | UUID | — | NOT NULL, INDEX | Creator / owner |
| `is_default` | BOOLEAN | `false` | NOT NULL | **Protected** — Household List (1 per `home_id`) |
| `is_personal` | BOOLEAN | `false` | NOT NULL | **Protected** — Personal List (1 per `owner_id`, cross-household) |
| `created_at` | TIMESTAMPTZ | `now()` | NOT NULL | — |
| `updated_at` | TIMESTAMPTZ | `now()` | NOT NULL | Updated on write |

**Invariant rules:**
- At most **one** `is_default=true` row per `home_id`. Enforced in service layer, not DB constraint.
- At most **one** `is_personal=true` row per `owner_id`. Enforced in service layer, not DB constraint.
- **Never** delete or mutate `is_default` or `is_personal` rows via the REST API. Use direct SQL for maintenance only.

### ⚠️ Migration Note (Existing Databases)

Because this project uses `SQLModel.metadata.create_all` (no Alembic), the new `is_default` and `is_personal` columns **will not be automatically added to existing databases**. Run the following DDL against any existing `shopping` Postgres instance:

```sql
ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;
```

Fresh deployments (empty volume) will have the columns created automatically at startup.

---

## Active Feature Flags

| Flag | Scope | State | Notes |
|---|---|---|---|
| `OTEL_ENABLED` | All Python backends | `true` in Docker Compose | Disable in dev by setting `OTEL_ENABLED=false` |
| `TESTING` env var | Shopping backend | `false` (production) | Set to `"true"` to bypass JWT validation in tests |
| `--no-build` flag | `scripts/up.sh` | Optional | Skip Docker image rebuilds on restart |
| `--skip-logging` flag | `scripts/up.sh` | Optional | Skip the SigNoz observability stack |

---

## Known Constraints & Tech Debt

| Item | Severity | Description |
|---|---|---|
| No Alembic | Medium | Schema migrations require manual DDL for existing DBs. Recommend adding Alembic in a future sprint. |
| `MOCK_HOME_ID` fallback | Low | If `household_id` is absent from the JWT, `home_id` falls back to `00000000-0000-0000-0000-000000000002`. This is intentional for dev mode but must never occur in production. |
| Single Personal List uniqueness | Low | The uniqueness constraint (`is_personal=true` per `owner_id`) is enforced in the service layer only — a concurrent race on first login could theoretically create two. A future DB-level unique partial index would harden this. |
| SigNoz schema migrator wait | Low | `scripts/up.sh` polls for container exit rather than using `condition: service_completed_successfully` — this is intentional to decouple the script from compose dependency chains. |

---

## URLs (Local Development)

| App | URL |
|---|---|
| Dashboard | `http://loeger-os/` |
| Pantry | `http://loeger-os/pantry` |
| Shopping | `http://loeger-os/shopping` |
| Maintenance | `http://loeger-os/maintenance` |
| Keycloak Admin | `http://loeger-os/auth/admin` |
| Traefik Dashboard | `http://localhost:8080` |
| SigNoz | `http://loeger-os/signoz` |

> **Prerequisite**: `loeger-os` must resolve to `127.0.0.1` in `/etc/hosts`.
