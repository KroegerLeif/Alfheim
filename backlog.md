# Alfheim — Living Tech-Debt & Monorepo Backlog

**Status:** open / rolling
**Convention:** `TD-<AREA>-<NN>` or `[Category] Title`

This is the **living** backlog for open technical debt, routing issues, missing documentation, feature sync gaps, and maintenance tasks. It is deliberately separate from [`AUDIT_MASTER_BACKLOG.md`](AUDIT_MASTER_BACKLOG.md), which is a frozen `v1.0.0` audit snapshot.

---

## Legend

| Severity | Meaning |
| :--- | :--- |
| 🔴 **Critical** | Prevents builds/deployments, causes port collisions, or breaches security/tenancy |
| 🟠 **High** | Broken user-visible functionality, broken routing, or missing core features |
| 🟡 **Medium** | Incomplete documentation, missing CI jobs, or architectural inconsistencies |
| 🟢 **Low** | Dead code, minor lint issues, or ergonomic improvements |

---

## Reverse Proxy & Routing Audit (Caddy & Microfrontend Integrations)

### 🟠 `[Routing/Dashboard]` Cross-Microfrontend Navigation Fails via Next.js Router Links
- **Severity:** High
- **Root Cause / Findings:**
  In `core/dashboard/frontend/src/features/apps/components/CoreAppsSection.tsx:106`, app launching is implemented using Next.js client-side router `<Link href={targetUrl}>`. When users click to open micro-apps (`/library`, `/pantry`, `/budget`, `/workout/de`, `/chores/de`), Next.js attempts internal SPA navigation within the Dashboard application rather than full-page browser navigation. Because these paths are separate microfrontends served by Caddy, client-side route resolution fails, causing 404 or page load errors.
- **Proposed Resolution:**
  - [ ] Replace `<Link href={targetUrl}>` in `CoreAppsSection.tsx` with standard HTML `<a>` tags or handle click events to perform native browser location redirects (`window.location.href = targetUrl`).
  - [ ] Verify that clicking each Tier 1 core app card from the main dashboard navigates directly to the target microfrontend.

---


### 🟠 `[Bug/Budget UI]` Budget Microfrontend UI is an Incomplete Placeholder
- **Severity:** High
- **Root Cause / Findings:**
  In `apps/budget/frontend/src/app/[locale]/page.tsx` and `apps/budget/frontend/src/features/`, the Budget frontend UI consists of a placeholder shell displaying static click counters and active path labels. The backend domain features implemented in `apps/budget/backend/src/features/` (`accounts`, `pots`, `plans`, `transactions`) have no corresponding UI components or API integration.
- **Proposed Resolution:**
  - [ ] Create UI feature components under `apps/budget/frontend/src/features/` for Account Overview, Sinking Funds / Virtual Pots, Monthly/Event Budget Plans, and Transaction Ledger.
  - [ ] Connect frontend components to `budget-backend` REST endpoints using a typed `ky` API client with Keycloak token and `X-Household-ID` propagation.

---

## Folder Documentation (`README.md` Audit)

### 🟡 `[Docs/README]` Missing Microservice and Infrastructure Module Documentation
- **Severity:** Medium
- **Root Cause / Findings:**
  Several microservices and infrastructure components lack local `README.md` documentation detailing API endpoints, configuration parameters, and run instructions:
  - App Roots: `apps/budget/`, `apps/library/`, `apps/workout/`, `apps/chat/`.
  - App Subdirectories: `apps/budget/backend/`, `apps/budget/frontend/`, `apps/library/frontend/`.
  - Infrastructure: `infrastructure/caddy/`, `infrastructure/keycloak/`, `infrastructure/postgres-iam/`, `infrastructure/rustfs/`.
- **Proposed Resolution:**
  - [ ] Add `README.md` files for all missing application root, backend, and frontend directories specifying purpose, environment variables, dependencies, and local dev commands.
  - [ ] Add `README.md` files for infrastructure directories explaining Caddy reverse proxy mappings, Keycloak realm imports, IAM setup, and RustFS S3 configuration.

---

## Feature Inventory & GitHub Pages Sync

### 🟡 `[Docs/GitHub Pages]` GitHub Pages Documentation Desync for Recent Microservices
- **Severity:** Medium
- **Root Cause / Findings:**
  The public documentation website in `websites/docs/src/components/sections/AppsGrid.tsx` includes only 5 applications (Pantry, Shopping, Maintenance, Chores, Dashboard). The 4 newer microservices (**Budget & Treasury**, **Media & Library Hub**, **Workout Tracker**, and **ALFI Chat**) are missing from the documentation grid, system architecture diagrams, and translation files (`websites/docs/src/i18n/locales/{de,en,pl}.json`).
- **Proposed Resolution:**
  - [ ] Add feature cards and metadata for Budget, Library, Workout, and Chat services to `websites/docs/src/components/sections/AppsGrid.tsx`.
  - [ ] Add corresponding translation keys for all 4 missing services in `websites/docs/src/i18n/locales/en.json`, `de.json`, and `pl.json`.
  - [ ] Update `ArchitectureSection.tsx` and `TechStackSection.tsx` in `websites/docs` to reflect all 8 active microservices.

---

## Dead Code, Orphan Files & Maintenance Tasks

### 🟢 `[Cleanup/Dead Code]` Unused Theme CSS Files in Pantry and Chores Frontends (`TD-FE-03`)
- **Severity:** Low
- **Root Cause / Findings:**
  `apps/chores/frontend/src/styles/theme.css` and `apps/pantry/frontend/src/styles/theme.css` define CSS custom properties (`--font-heading`, `--font-body`, `--font-mono`), but neither `globals.css` nor any component imports them.
- **Proposed Resolution:**
  - [ ] Either import `theme.css` inside `globals.css` or inline the CSS variables and remove the redundant `theme.css` files.

---

### 🟢 `[Cleanup/Lint]` Missing ESLint Configuration in Chores Frontend (`TD-FE-01`)
- **Severity:** Low
- **Root Cause / Findings:**
  Only `apps/library/frontend`, `apps/budget/frontend`, and `apps/chores/frontend` declare a `"check-types": "tsc --noEmit"` script in `package.json`. Other microfrontends (`maintenance`, `shopping`, `workout`, `pantry`, `chat`, `dashboard`) rely solely on workspace-wide `pnpm check-types` or `tsc` commands without a local script target.
- **Proposed Resolution:**
  - [ ] Add `"check-types": "tsc --noEmit"` script to all microfrontend `package.json` files.

---

### 🟢 `[Cleanup/Lint]` Accumulated Frontend Lint Errors and Warnings Across Microfrontends (`TD-FE-05`)
- **Severity:** Low
- **Root Cause / Findings:**
  Multiple frontend microservices (`maintenance`, `shopping`, `pantry`, `chat`, `budget`, `dashboard`) contain accumulated ESLint errors (`@typescript-eslint/no-explicit-any`, `react-hooks/set-state-in-effect`, `@typescript-eslint/no-require-imports`) preventing clean execution of `pnpm lint`.
- **Proposed Resolution:**
  - [ ] Refactor TypeScript types, effect hooks, and import statements in each microfrontend to achieve zero-warning ESLint execution.

---

## Preserved Open Technical Debt Items


### 🟠 `[CI/CD]` Missing Frontend and Microservice CI Testing (`TD-CI-01`, `TD-CI-02`)
- **Severity:** High
- **Root Cause / Findings:**
  `.github/workflows/python-ci.yml` omits `apps/workout/backend` from its test matrix, and no GitHub Actions workflow exists for frontend TypeScript type-checking or Vitest tests.
- **Proposed Resolution:**
  - [ ] Add `apps/workout/backend` to `.github/workflows/python-ci.yml`.
  - [ ] Create `.github/workflows/frontend-ci.yml` to run `pnpm -r exec tsc --noEmit` and `pnpm -r test`.

---

### 🟢 `[FE/Layout]` Pantry Layout Emits Duplicate `<html>` Tag (`TD-FE-02`)
- **Severity:** Low
- **Root Cause / Findings:**
  `apps/pantry/frontend/src/app/layout.tsx` returns `<html><body>{children}</body></html>` while `src/app/[locale]/layout.tsx` emits `<html>` and `<body>` tags a second time.
- **Proposed Resolution:**
  - [ ] Simplify `apps/pantry/frontend/src/app/layout.tsx` to return `{children}` directly.
