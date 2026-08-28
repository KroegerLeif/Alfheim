# Backlog: Core Native App `library`

## 1. Executive Summary

### 1.1 Goal & Overview
The `library` application is a Tier-1 Core Native App within the Alfheim household management ecosystem. It serves as a unified **Media, Entertainment & Inventory Hub** for books, board games, video games, movies, and TV series. The application enables household members to catalog physical and digital media items, organize them in hierarchical storage locations, manage item lending to contacts, configure streaming provider subscriptions, and discover media via rich filtering and full-text search.

### 1.2 Architecture Classification
- **Classification:** Tier 1 Core Native App (Integrated core service registered in `core/dashboard/backend/internal/features/apps/tier1_core_registry.go`).
- **Frontend Stack:** Next.js 16 (App Router with `src/proxy.ts`), React 19, Tailwind CSS, TypeScript, `@alfheim/shared` UI components and layout shell wrappers.
- **Backend Stack:** Python 3.12, FastAPI, Async SQLAlchemy, PostgreSQL with native `tsvector`/Trigram full-text search, `uv` dependency & workspace management.
- **Object Storage:** MinIO / RustFS S3 storage for media attachments (e.g., game manuals as PDFs).

### 1.3 Multi-Tenancy & Security Model
- **Strict Household Multi-Tenancy:** All records (`items`, `locations`, `lending_records`, `provider_subscriptions`) belong strictly to a household (`household_id`).
- **No Isolated User State:** Data is shared across members of the active household.
- **Enforcement:** Keycloak JWT verification and mandatory `X-Household-ID` request header validation in FastAPI dependencies. Attempts to access data outside the active household context yield `403 Forbidden`.

---

## 2. Architecture & Component Mapping

### 2.1 Shared Primitives (`@alfheim/shared`)
- **UI Components:** `Button`, `Badge`, `Dialog`, `Progress`, `Table`, `Input`, `Select`, `Card`, `Tabs`.
- **Layout Shell:** `AppShell`, `AppHeader`, `PageHeader`, `Navigation`.
- **i18n Dictionaries:** Locales under `packages/shared/src/features/i18n/locales/{de,en,pl}/`.

### 2.2 Application Structure & Routes
- **Frontend App Directory:** `apps/library/frontend/`
  - Base Path / Proxy Routing: `/library` (Locale subpaths: `/library/de`, `/library/en`, `/library/pl`)
  - Sub-routes:
    - `/library/[locale]/catalog` - Unified media catalog (Books, Games, Movies/Series)
    - `/library/[locale]/locations` - Hierarchical storage locations (Room -> Shelf/Cabinet -> Box)
    - `/library/[locale]/lending` - Lending tracking & history
    - `/library/[locale]/providers` - Active household streaming & subscription services
- **Backend App Directory:** `apps/library/backend/`
  - API Base URL: `/api/v1/library`
  - API Sub-routes:
    - `/api/v1/library/items` - CRUD & search for library items
    - `/api/v1/library/locations` - CRUD & tree representation for locations
    - `/api/v1/library/lending` - Lending records management
    - `/api/v1/library/providers` - Household provider subscription configurations
    - `/api/v1/library/lookup/isbn` - External Open Library / Google Books lookup
    - `/api/v1/library/lookup/bgg` - External BoardGameGeek lookup
    - `/api/v1/library/lookup/tmdb` - External TMDB movie/series lookup
    - `/api/v1/library/items/{id}/manual` - Game manual PDF upload & download presigned URLs

### 2.3 Network & Gateway Configuration
- **Caddyfile Proxies:**
  - Frontend: `handle /library* { reverse_proxy library-frontend:3000 }` (Redirection `/library` -> `/library/en`)
  - Backend: `handle /api/v1/library* { reverse_proxy library-backend:8000 }`
- **Docker Compose Networks:**
  - `gateway-net`, `infra-net`, `core-net`, `app-library-net`, `observability-internal`

### 2.4 Object Storage Keys
- **S3 Bucket Path Scheme:** `library/households/{household_id}/manuals/{item_id}/{filename}.pdf`

---

## 3. Task Roadmap

### Phase 1: Scaffolding & Monorepo Setup

#### [TASK-01] Create Backend Project Scaffolding for `library`
- **Status:** [x] Abgeschlossen
- **Scope:** `apps/library/backend/`
- **Description:** Initialize Python 3.12 FastAPI backend structure for `apps/library/backend/` using `uv` workspace configuration. Include `pyproject.toml` referencing `backend-shared`, basic FastAPI app initialization, lifespan handling, health check endpoint (`/health`), and logging setup.
- **Definition of Done:**
  1. `apps/library/backend/pyproject.toml` created with workspace dependency on `backend-shared`.
  2. `apps/library/backend/src/main.py` starts a FastAPI app with `/health` returning HTTP 200 `{"status": "ok"}`.
  3. `uv run pytest` executes successfully in `apps/library/backend/`.

#### [TASK-02] Create Frontend Project Scaffolding for `library`
- **Status:** [x] Abgeschlossen
- **Scope:** `apps/library/frontend/`
- **Description:** Initialize Next.js 16 App Router frontend project structure for `apps/library/frontend/`. Configure `@alfheim/shared` dependency in `package.json`, Tailwind CSS setup, Next.js proxy config in `src/proxy.ts`, and basic page layout shell.
- **Definition of Done:**
  1. `apps/library/frontend/package.json` created with workspace dependencies (e.g., `@alfheim/shared`, `next`, `react`, `ky`).
  2. `src/proxy.ts` created and configured according to Next.js 16 proxy guidelines.
  3. Basic layout shell (`AppShell`, `AppHeader`) renders without errors on `/library/en`.
  4. `pnpm --filter library-frontend check-types` passes with zero errors.

#### [TASK-03] Register `library` App in Core Registry & Docker Compose
- **Status:** [x] Abgeschlossen
- **Scope:** `core/dashboard/backend/internal/features/apps/tier1_core_registry.go`, `compose.yaml`, `apps/library/compose.yml`
- **Description:** Register `library` as a Tier-1 Core application in Go backend registry (`tier1_core_registry.go`) and add service definition in `apps/library/compose.yml` integrated into root `compose.yaml`.
- **Definition of Done:**
  1. `CoreApps` list in `tier1_core_registry.go` includes `library` entry (Slug: `"library"`, Title: `"Media & Library Hub"`, Icon: `"local_library"`, URL: `"/library"`).
  2. `apps/library/compose.yml` defines `library-backend` and `library-frontend` services attached to `app-library-net` and `gateway-net`.
  3. `compose.yaml` includes `./apps/library/compose.yml` and `app-library-net` network.

---

### Phase 2: Backend Core & Database Schema

#### [TASK-04] Implement Database Models & Async SQLAlchemy Engine Setup
- **Status:** [x] Abgeschlossen
- **Scope:** `apps/library/backend/src/db/`
- **Description:** Set up PostgreSQL database models using Async SQLAlchemy. Models must include: `Location` (hierarchical parent-child), `Item` (with media type discriminators for Book, Game, Movie/Series, flags like `is_cookbook`, player counts, runtimes, FSK), `LendingRecord` (contact name, status `AVAILABLE`/`LENT_OUT`, lent date, optional `due_date`, notes), and `ProviderSubscription` (provider name, type, active status).
- **Definition of Done:**
  1. SQLAlchemy models for `Location`, `Item`, `LendingRecord`, `ProviderSubscription` created with mandatory `household_id` columns.
  2. Alembic migration scripts generated and executable.
  3. Foreign key constraints and indexes (including `household_id` composite indexes) properly defined.

#### [TASK-05] Implement Keycloak Auth & Multi-Tenancy Middleware Dependency
- **Status:** [x] Abgeschlossen
- **Scope:** `apps/library/backend/src/api/dependencies.py`
- **Description:** Implement FastAPI dependency that extracts and validates Keycloak JWT token and `X-Household-ID` request header using `backend-shared`. Enforce household access control across all API routes.
- **Definition of Done:**
  1. Dependency checks `X-Household-ID` header against JWT authorized households (`household_id`, `active_household_id`, or `households`).
  2. Returns `403 Forbidden` if header is missing or household access is unauthorized.
  3. Provides `current_household_id` to route handler signatures.

#### [TASK-06] Implement CRUD API Endpoints for Locations & Items
- **Status:** [x] Abgeschlossen
- **Scope:** `apps/library/backend/src/api/v1/items.py`, `apps/library/backend/src/api/v1/locations.py`
- **Description:** Build REST API endpoints for managing media items and locations. Locations must support parent-child hierarchy (e.g. Living Room -> Main Bookshelf -> Shelf 2). Items support filter by location, media type (`BOOK`, `GAME`, `MOVIE`, `SERIES`), and `is_cookbook`.
- **Definition of Done:**
  1. CRUD endpoints for `/api/v1/library/locations` (Create, List Tree, Update, Delete).
  2. CRUD endpoints for `/api/v1/library/items` (Create, List with pagination/filtering, Get Detail, Update, Delete).
  3. Pytest suite verifies multi-tenancy isolation for items and locations.

#### [TASK-07] Implement Lending Management API Endpoints
- **Status:** [x] Abgeschlossen
- **Scope:** `apps/library/backend/src/api/v1/lending.py`
- **Description:** Build API endpoints to lend items to contacts and mark items returned. Statuses: `AVAILABLE`, `LENT_OUT`. Required fields: `contact_name`, `lent_at`, optional `due_date` and `notes`.
- **Definition of Done:**
  1. Endpoints: `POST /items/{id}/lend`, `POST /items/{id}/return`, `GET /lending/history`.
  2. Lending an item sets item status to `LENT_OUT` and records lending details.
  3. Returning an item sets status back to `AVAILABLE` and updates `returned_at`.
  4. Unit & integration tests pass.

#### [TASK-08] Implement Streaming Provider Subscription API Endpoints
- **Status:** [x] Abgeschlossen
- **Scope:** `apps/library/backend/src/api/v1/providers.py`
- **Description:** Build API endpoints to manage active household streaming & subscription services (e.g., Netflix, Amazon Prime, Disney+, PS Plus, Xbox Game Pass).
- **Definition of Done:**
  1. Endpoints: `GET /providers`, `POST /providers`, `PUT /providers/{id}`, `DELETE /providers/{id}`.
  2. Items can be associated with digital provider IDs.
  3. Provider configuration per household is strictly isolated.

---

### Phase 3: External Providers & RustFS Integration

#### [TASK-09] Implement External Metadata Lookup Services (ISBN, BGG, TMDB)
- **Status:** [x] Abgeschlossen
- **Scope:** `apps/library/backend/src/services/external/`
- **Description:** Implement external API clients for media metadata retrieval:
  - **Books:** Open Library / Google Books API client for ISBN lookup.
  - **Board Games:** BoardGameGeek (BGG) API client for game details (player min/max, playing time, categories).
  - **Movies & Series:** TMDB API client for title lookup, runtime, genre, FSK ratings.
- **Definition of Done:**
  1. Endpoint `GET /api/v1/library/lookup/isbn?isbn={code}` returns parsed book details.
  2. Endpoint `GET /api/v1/library/lookup/bgg?query={name}` returns board game metadata.
  3. Endpoint `GET /api/v1/library/lookup/tmdb?query={name}` returns movie/series metadata.
  4. External API errors are gracefully handled and returned as standard error payloads.

#### [TASK-10] Implement RustFS / MinIO S3 Manual PDF Upload & Presigned URLs
- **Status:** [x] Abgeschlossen
- **Scope:** `apps/library/backend/src/services/storage.py`, `apps/library/backend/src/api/v1/manuals.py`
- **Description:** Integrate RustFS / S3 storage client using `backend-shared` storage utilities. Enable PDF game manual upload, storage at `library/households/{household_id}/manuals/{item_id}/{filename}.pdf`, and generation of secure presigned download URLs.
- **Definition of Done:**
  1. Endpoint `POST /items/{id}/manual` accepts PDF file upload and stores it in S3 bucket.
  2. Endpoint `GET /items/{id}/manual/url` generates a presigned GET URL for viewing/downloading the PDF manual.
  3. Tests verify bucket paths, file validation (PDF only), and tenant isolation.

#### [TASK-11] Implement Full-Text Search & Multi-Facet Filtering Engine
- **Status:** [ ] Offen
- **Scope:** `apps/library/backend/src/services/search.py`, `apps/library/backend/src/api/v1/search.py`
- **Description:** Implement PostgreSQL full-text search (`tsvector` & Trigram similarity index) combined with multi-facet filters (e.g., "Funny movie under 90 min", "4-player game in max 45 min", JustWatch-style active provider filter).
- **Definition of Done:**
  1. Migration adds PostgreSQL `pg_trgm` extension and `tsvector` index on title/description/author/tags.
  2. Endpoint `GET /api/v1/library/search` supports text search, media type filter, player count range, max duration, FSK, and active household streaming provider filter.
  3. Search query response time under 50ms for 10,000 test items.

---

### Phase 4: Frontend UI, Features & i18n

#### [TASK-12] Implement i18n Dictionaries & Translation Wrappers
- **Status:** [ ] Offen
- **Scope:** `packages/shared/src/features/i18n/locales/{de,en,pl}/library.json`, `apps/library/frontend/src/i18n/`
- **Description:** Add `library` localization dictionaries in German (DE), English (EN), and Polish (PL) under shared locales directory. Provide localized labels for media categories, lending statuses, locations, and provider filters.
- **Definition of Done:**
  1. `library.json` translation files created for `de`, `en`, and `pl`.
  2. Next.js app routes respond to `/library/de`, `/library/en`, and `/library/pl`.
  3. All UI strings use translation keys with zero hardcoded UI strings.

#### [TASK-13] Implement Catalog Feature Slice & Item Cards
- **Status:** [ ] Offen
- **Scope:** `apps/library/frontend/src/features/catalog/`
- **Description:** Build catalog view with media tab filters (All, Books, Games, Movies/Series, Cookbooks). Display media items in responsive grids using `@alfheim/shared` Card, Badge, and Button primitives. Enforce 200 LOC per file limit.
- **Definition of Done:**
  1. Catalog page lists media items with image/icon, title, media type badge, location badge, and availability status.
  2. Cookbook toggle filter highlights cookbook items.
  3. Every file in `src/features/catalog/` strictly stays under 200 LOC.

#### [TASK-14] Implement Metadata Lookup & Add/Edit Item Modals
- **Status:** [ ] Offen
- **Scope:** `apps/library/frontend/src/features/item-dialog/`
- **Description:** Implement dialog for adding/editing items with integrated ISBN / BGG / TMDB quick-lookup buttons to auto-populate form fields.
- **Definition of Done:**
  1. Modal permits manual entry or search via ISBN / BGG / TMDB.
  2. Auto-populates title, author/creator, runtime, player count, FSK, and cover image URL upon metadata selection.
  3. Submits data to `/api/v1/library/items`.

#### [TASK-15] Implement Location Manager & Hierarchical Tree View
- **Status:** [ ] Offen
- **Scope:** `apps/library/frontend/src/features/locations/`
- **Description:** Build location management interface for creating, editing, and viewing nested locations (Room -> Shelf -> Box). Display item count per location.
- **Definition of Done:**
  1. Tree view component displays nested locations with item counts.
  2. Create/edit/delete location actions update tree state reactively.
  3. LOC per file remains strictly <= 200 LOC.

#### [TASK-16] Implement Lending Drawer & Tracking UI
- **Status:** [ ] Offen
- **Scope:** `apps/library/frontend/src/features/lending/`
- **Description:** Build lending management drawer/modal to lend items out to contacts, set optional due dates, view active loans, and mark returned items.
- **Definition of Done:**
  1. "Lend Item" action opens drawer requiring contact name and optional due date/notes.
  2. Active loans list shows borrowed items, contact name, days elapsed, and "Mark Returned" action button.
  3. Status updates reactively across catalog views.

#### [TASK-17] Implement Provider Configuration & JustWatch Filter UI
- **Status:** [ ] Offen
- **Scope:** `apps/library/frontend/src/features/providers/`
- **Description:** Build streaming provider manager page and catalog provider filter component. Users can toggle active household services (Netflix, Prime, Disney+, etc.) and filter catalog by "Available on My Providers".
- **Definition of Done:**
  1. Provider setup page allows toggling active household streaming subscriptions.
  2. Catalog filter bar includes "Available on Active Providers" toggle.
  3. Component files strictly comply with 200 LOC limit.

#### [TASK-18] Implement PDF Game Manual Viewer Component
- **Status:** [ ] Offen
- **Scope:** `apps/library/frontend/src/features/manuals/`
- **Description:** Build PDF manual uploader and viewer component for board games and video games.
- **Definition of Done:**
  1. Game detail view displays "Upload Manual (PDF)" button and "View Manual" button.
  2. Viewing manual opens PDF in embedded viewer / modal using presigned S3 URL.
  3. File type validation enforces PDF format.

---

### Phase 5: Routing, Gateway, Dashboard Integration & E2E Verification

#### [TASK-19] Configure Gateway Caddy Routing & Access Rules
- **Status:** [ ] Offen
- **Scope:** `infrastructure/caddy/Caddyfile`
- **Description:** Update Caddy gateway configuration to proxy `/library*` to `library-frontend:3000` and `/api/v1/library*` to `library-backend:8000`. Set up bare path redirects to `/library/en`.
- **Definition of Done:**
  1. Caddyfile includes `redir /library /library/en 302`.
  2. Caddyfile routes `/library*` to `library-frontend:3000`.
  3. Caddyfile routes `/api/v1/library*` to `library-backend:8000`.
  4. CORS headers support `X-Household-Id`.

#### [TASK-20] Execute Full Backend & Frontend Verification Suite
- **Status:** [ ] Offen
- **Scope:** Monorepo root, `scripts/verify.sh`
- **Description:** Run workspace verification scripts to validate Python backend pytest coverage, Go core dashboard tests, frontend TypeScript compilation, Vitest suites, and Ruff code formatting.
- **Definition of Done:**
  1. `PYTHONPATH=. uv run pytest` in `apps/library/backend/` passes 100% of multi-tenancy and CRUD tests.
  2. `pnpm --filter library-frontend check-types` passes with zero errors.
  3. `pnpm --filter library-frontend test` passes Vitest suite.
  4. `./scripts/verify.sh` completes successfully across all workspace apps.
