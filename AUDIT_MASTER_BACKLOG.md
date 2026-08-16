# Alfheim Architectural Audit & Master Backlog

**Audit Version:** 1.0.0
**Date:** August 16, 2026
**Auditor:** Principal Software Architect, Frontend Specialist & Security Auditor
**Scope:** Entire Alfheim Monorepo (`apps/`, `core/`, `packages/`, `infrastructure/`, `scripts/`, `.ai/`)

---

## 1. Executive Monorepo Health Scorecard

| Category | Score | Grade | Status & Key Highlights |
| :--- | :---: | :---: | :--- |
| **.ai System Knowledge & Docs** | **82 / 100** | **B+** | Comprehensive architectural guidelines exists, but contains outdated references (e.g. `ky` vs `fetch`, `pnpm check-types` vs `pnpm type-check`), missing Go/Python quality commands in quality-gates, and missing Java/Spring stack documentation in actual code reality. |
| **Architecture (FDD & SRP)** | **74 / 100** | **C+** | Strict Feature-Driven Design structure is maintained in file hierarchy across services, but massive SRP violations exist in monolith services (`shopping_lists/service.py` at 619 lines, `chore_management/service.py` at 420 lines) and monolith React components (`HouseholdDetailView.tsx` at 381 lines, `CustomThemeBuilder.tsx` at 306 lines). |
| **Frontend Quality & i18n** | **78 / 100** | **B-** | Tailwind v4 dark mode pairing is well implemented with CSS variables and `@theme`, but hardcoded user-facing strings were discovered in auth modal providers, dialog action labels, status badges, and documentation pages. |
| **Test Coverage & Quality** | **65 / 100** | **D+** | Python backend test coverage is strong (67%-84%), but Go backend coverage is critically low (18%-26%), frontend component testing is severely deficient (`apps/chores/frontend` has **0 test files**), and unit tests for `packages/shared` UI/i18n primitives are missing. |
| **Dependencies & Security** | **88 / 100** | **A-** | Modern tooling in place (Python 3.12, `uv`, Go 1.22+, pnpm workspace, React 19/Next.js, Biome/Ruff). Zero private keys or live `.env` files tracked. Minor risk around test authentication headers (`PYTEST_CURRENT_TEST` fallback logic) in production code paths. |
| **OVERALL MONOREPO HEALTH** | **77.4 / 100** | **B** | **Solid technical foundation with high architectural discipline, requiring focused remediation on SRP refactoring, Go/Frontend test coverage, and full i18n localization.** |

---

## 2. Current Test Coverage Matrix

| Service / Package | Tech Stack | Unit Tests | Integration Tests | Coverage % | Status & Identified Gaps |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `apps/pantry/backend` | Python 3.12 / FastAPI | ✅ | ✅ | **84%** | Excellent coverage. Strong isolated `aiosqlite` integration tests & unit tests. |
| `apps/pantry/frontend` | Next.js 14 / Vitest | ✅ | ⚠️ Partial | **~65%** | Good coverage for services & views (`ProductCatalogView`, `AnalyticsView`, `LocationsGridView`), but missing UI modal coverage. |
| `apps/chores/backend` | Python 3.12 / FastAPI | ✅ | ⚠️ Partial | **71%** | Good coverage on chore services and auth, needs coverage for recurring timeline logic edge cases. |
| `apps/chores/frontend` | Next.js 14 / Vitest | ❌ | ❌ | **0%** | **CRITICAL GAP**: Zero test files exist in `apps/chores/frontend`. Vitest passes with `passWithNoTests`. |
| `apps/maintenance/backend` | Python 3.12 / FastAPI | ✅ | ✅ | **73%** | Solid coverage on tasks and maintenance services; `app/core/storage.py` (0%) and `mcp_tools.py` (23%) lack tests. |
| `apps/maintenance/frontend` | Next.js 14 / Vitest | ⚠️ Partial | ❌ | **~30%** | Only 1 test file (`DevicesView.test.tsx`). Missing tests for `MaintenanceMode`, `AddDeviceWizard`, `HistoryView`. |
| `apps/shopping/backend` | Python 3.12 / FastAPI | ✅ | ✅ | **67%** | High flow coverage in `test_shopping_flow.py`, but low unit coverage inside `shopping_lists/service.py` (30%) and HTTP clients (27%). |
| `apps/shopping/frontend` | Next.js 14 / Vitest | ⚠️ Partial | ❌ | **~35%** | Only `ItemRow.test.tsx` and `sanity.test.tsx`. Missing coverage for `ListSelector`, `EinlagernModal`, `ChecklistContainer`. |
| `core/dashboard/backend` | Go / Chi / PGX | ⚠️ Unit | ❌ Integration | **22.8%** | Low coverage across Go services (`household` 26.6%, `contact` 18.7%, `profile` 22.2%, `apps` 25.3%, `shared` 0%). |
| `core/dashboard/frontend` | Next.js 14 / Vitest | ⚠️ Partial | ❌ | **~25%** | Only `AddAppModal.test.tsx`. Missing coverage for `HouseholdDetailView`, `ContactModal`, `SystemShellLogs`, `CustomThemeBuilder`. |
| `packages/shared` | TS / React | ❌ | ❌ | **0%** | **CRITICAL GAP**: Shared primitives (`useTranslation`, `ThemeContext`, `OSMMapViewer`, `HouseholdSwitcher`) have 0 test files. |

---

## 3. FDD & SRP Violation Inventory

### A. Oversized / God-Services (> 300 Lines)

1. **`apps/shopping/backend/src/features/shopping_lists/service.py` (619 lines)**
   - **Violation:** Violates SRP by combining list management, item state transitions, barcode resolution, Open Food Facts external fetching, and pantry auto-sync integration in a single 600+ line monolith file.
   - **Recommendation:** Split into domain sub-services: `ShoppingListService`, `ShoppingItemService`, `BarcodeResolverService`, and `PantrySyncService`.

2. **`apps/pantry/backend/src/features/inventory/service.py` (424 lines)**
   - **Violation:** Handles stock quantity updates, ledger item creation, batch expiration alerts, location transfer validation, and CSV export processing.
   - **Recommendation:** Extract `InventoryLedgerService` and `StockAlertService` into distinct modules within the inventory feature.

3. **`apps/chores/backend/src/features/chore_management/service.py` (420 lines)**
   - **Violation:** Manages chore CRUD, rotation scheduling algorithms, member score calculations, and push notification triggers.
   - **Recommendation:** Extract rotation algorithms into a pure function module `rotation_engine.py` and score tracking into `gamification_service.py`.

4. **`apps/pantry/backend/src/features/products/mcp_tools.py` (384 lines)**
   - **Violation:** Contains extensive direct validation and search orchestration logic inside MCP tool wrappers instead of delegating to `service.py`.
   - **Recommendation:** Refactor MCP tool decorators to be thin pass-through handlers delegating pure business logic to `service.py`.

5. **`core/dashboard/backend/internal/features/household/repository.go` (324 lines) & `service.go` (313 lines)**
   - **Violation:** Combines household creation, address geolocation mapping, member role management, and invitation token lifecycle.
   - **Recommendation:** Split repository and service into `household`, `member`, and `invitation` domain entities/handlers.

### B. Monolithic Frontend UI Components (> 250 Lines)

1. **`core/dashboard/frontend/src/features/household/components/HouseholdDetailView.tsx` (381 lines)**
   - **Violation:** Renders household info, address editor, invite modal triggers, member management table, and OSM map view in a single giant component.
   - **Recommendation:** Decompose into `HouseholdHeader`, `AddressSection`, and `MemberManagementTable`.

2. **`apps/shopping/frontend/src/features/shopping-lists/services/shoppingListService.ts` (352 lines)**
   - **Violation:** Monolithic API service containing direct fetch calls, local storage fallback logic, and state mutation maps.
   - **Recommendation:** Modularize into distinct API query modules (`listsApi`, `itemsApi`, `pantrySyncApi`).

3. **`core/dashboard/frontend/src/features/dashboard/components/CustomThemeBuilder.tsx` (306 lines)**
   - **Violation:** Combines color picker UI, JSON parsing, live palette preview, and storage persistence.
   - **Recommendation:** Extract `ColorPalettePicker` and `ThemePreviewPanel` subcomponents.

4. **`core/dashboard/frontend/src/features/contact/components/ContactModal.tsx` (273 lines)**
   - **Violation:** Handles contact modal state, form validation, category selection, and avatar upload handling.
   - **Recommendation:** Extract `CategorySelectDropdown` and `AvatarUploadInput` subcomponents.

5. **`apps/maintenance/frontend/src/features/maintenance/components/MaintenanceMode.tsx` (274 lines)**
   - **Violation:** Blends system status monitoring UI, retry handlers, and fallback navigation.
   - **Recommendation:** Separate view presentation from telemetry retry state hook.

---

## 4. Hardcoding & i18n Finding Log

### A. Hardcoded User-Facing Strings (i18n Missing)

1. **`apps/maintenance/frontend/src/app/[locale]/providers.tsx` (Lines 159, 177)**
   - Hardcoded strings: `"Authentication Error"` and `"Securing session with Keycloak..."`.
   - **Fix:** Move strings to `packages/shared/src/features/i18n/locales/{de,en,pl}/common.json` under `auth.error` and `auth.loading`.

2. **`apps/shopping/frontend/src/app/[locale]/providers.tsx` (Lines 130, 148)**
   - Hardcoded strings: `"Authentication Error"` and `"Securing session with Keycloak..."`.
   - **Fix:** Move strings to shared i18n dictionaries and consume via `useTranslation('common')`.

3. **`apps/maintenance/frontend/src/features/history/components/HistoryView.tsx` (Line 28)**
   - Hardcoded string: `"Failed to load service history. Please try again."`.
   - **Fix:** Add `maintenance.history.load_error` key to i18n dictionaries.

4. **`core/dashboard/frontend/src/features/contact/components/ContactModal.tsx` (Lines 205, 210, 211)**
   - Hardcoded category options: `"Person"`, `"Business"`, `"Important"`.
   - **Fix:** Route category labels through `dashboard.contact.categories` i18n dictionary.

5. **`core/dashboard/frontend/src/features/household/components/MemberGrid.tsx` (Lines 93-95)**
   - Hardcoded role badge text: `"ADMIN"`, `"MEMBER"`, `"GUEST"`.
   - **Fix:** Route role labels through `dashboard.household.roles` i18n dictionary.

6. **`apps/shopping/frontend/src/features/shopping-lists/components/EinlagernItemRow.tsx` (Line 20)**
   - Hardcoded unit text fallback `"Promise"`.
   - **Fix:** Replace with dynamic translation key `shopping.einlagern.unit_fallback`.

7. **`apps/pantry/frontend/src/components/ui/dialog.tsx` (Line 49)**
   - Hardcoded accessibility close button screen-reader text `"Close"`.
   - **Fix:** Use `useTranslation('common')` for `"common.close"`.

### B. Styling & Design Token Violations

1. **`websites/docs/src/App.tsx` & `ArchitectureSection.tsx`**
   - Hardcoded hex colors (`bg-[#0b1326]`, `text-[#f0f6fc]`, `border-[#1c2847]`, `text-[#3eb1ff]`).
   - **Fix:** Align docs styling with shared `@theme` tokens or create a dedicated documentation theme variables configuration.

---

## 5. Prioritized Action Backlog

### Pillar 1: `.ai` System Knowledge & Documentation Coherence

#### Ticket ID: `AUDIT-DOCS-01`
- **Target Path:** `.ai/stacks/nextjs_tailwind.md` & `.ai/guidelines/quality-gates.md`
- **Severity:** `MEDIUM`
- **Problem Description & Rationale:** `.ai/stacks/nextjs_tailwind.md` recommends `ky` for HTTP requests, but all frontends across the monorepo strictly standardise on native `fetch` / custom `client.ts` wrappers. Furthermore, `pnpm check-types` is referenced, whereas `pnpm type-check` / `pnpm check-types` script aliases differ in `package.json`.
- **Step-by-Step Remediation Plan:**
  1. Update `.ai/stacks/nextjs_tailwind.md` section 3 to reflect native `fetch` with typed API client wrappers instead of `ky`.
  2. Harmonize type-check command references in `.ai/` documentation to `./scripts/verify.sh` and `pnpm --recursive exec tsc --noEmit`.
  3. Validate document coherence across `.ai/INDEX.md` and `.ai/CONTEXT.md`.

#### Ticket ID: `AUDIT-DOCS-02`
- **Target Path:** `.ai/guidelines/quality-gates.md`
- **Severity:** `LOW`
- **Problem Description & Rationale:** `.ai/guidelines/quality-gates.md` lacks clear documentation on Go backend test verification (`go test -race ./...`) and Python `uv run pytest` execution flags.
- **Step-by-Step Remediation Plan:**
  1. Add explicit code snippets for Go (`go test -v -race -cover ./...`) and Python (`PYTHONPATH=. uv run pytest --cov`) to `quality-gates.md`.
  2. Cross-reference quality gate checks with the actual verification logic in `scripts/verify.sh`.

---

### Pillar 2: Feature-Driven Design (FDD) & Single Responsibility (SRP)

#### Ticket ID: `AUDIT-FDD-01`
- **Target Path:** `apps/shopping/backend/src/features/shopping_lists/service.py`
- **Severity:** `HIGH`
- **Problem Description & Rationale:** `service.py` is 619 lines long and handles shopping list creation, item updates, barcode lookup, Open Food Facts REST calls, and cross-service pantry synchronization. This violates SRP and makes unit testing difficult.
- **Step-by-Step Remediation Plan:**
  1. Create `clients/open_food_facts.py` for external food database calls.
  2. Create `services/pantry_sync_service.py` for cross-app IPC with the pantry service.
  3. Refactor `service.py` to focus solely on core shopping list entity operations.
  4. Write unit tests for each refactored service component.

#### Ticket ID: `AUDIT-FDD-02`
- **Target Path:** `apps/pantry/backend/src/features/inventory/service.py`
- **Severity:** `HIGH`
- **Problem Description & Rationale:** `service.py` is 424 lines long and mixes ledger transactions, stock replenishment logic, batch expiration tracking, and CSV exports.
- **Step-by-Step Remediation Plan:**
  1. Move ledger creation and audit trail history into `ledger_service.py`.
  2. Move expiration monitoring and alert computations into `alert_service.py`.
  3. Keep pure stock level mutations in `service.py`.
  4. Verify existing unit and integration tests pass without regression.

#### Ticket ID: `AUDIT-FDD-03`
- **Target Path:** `core/dashboard/frontend/src/features/household/components/HouseholdDetailView.tsx`
- **Severity:** `MEDIUM`
- **Problem Description & Rationale:** Monolithic React component (381 lines) handling household header UI, address editing modal state, invitation management, member table rendering, and OSM map rendering.
- **Step-by-Step Remediation Plan:**
  1. Extract `HouseholdHeader.tsx` (name, avatar, address display).
  2. Extract `AddressManagementModal.tsx` (OSM map & address autocomplete).
  3. Extract `MemberTable.tsx` (member list, role changes, member deletion).
  4. Compose `HouseholdDetailView.tsx` from these smaller, single-responsibility components.

#### Ticket ID: `AUDIT-FDD-04`
- **Target Path:** `apps/pantry/backend/src/features/products/mcp_tools.py`
- **Severity:** `MEDIUM`
- **Problem Description & Rationale:** FastMCP tool definitions (384 lines) contain business logic and database queries directly in tool callbacks rather than delegating to `service.py`. This violates the Core Architecture Rule (Section 3 of `.ai/stacks/python_fastapi.md`).
- **Step-by-Step Remediation Plan:**
  1. Identify pure domain functions embedded in `mcp_tools.py`.
  2. Move business logic functions into `service.py`.
  3. Update `@mcp.tool()` handlers to delegate directly to `service.py`.

---

### Pillar 3: Frontend Quality, i18n & Zero-Hardcoding

#### Ticket ID: `AUDIT-I18N-01`
- **Target Path:** `apps/maintenance/frontend/src/app/[locale]/providers.tsx` & `apps/shopping/frontend/src/app/[locale]/providers.tsx`
- **Severity:** `HIGH`
- **Problem Description & Rationale:** Authentication loading and error overlay UI components display unlocalized hardcoded English strings ("Authentication Error", "Securing session with Keycloak...").
- **Step-by-Step Remediation Plan:**
  1. Add `auth.error` and `auth.securing_session` translations to `packages/shared/src/features/i18n/locales/{de,en,pl}/common.json`.
  2. Import `useTranslation` in both `providers.tsx` files and replace hardcoded strings with `t('auth.error')` and `t('auth.securing_session')`.

#### Ticket ID: `AUDIT-I18N-02`
- **Target Path:** `core/dashboard/frontend/src/features/contact/components/ContactModal.tsx` & `MemberGrid.tsx`
- **Severity:** `MEDIUM`
- **Problem Description & Rationale:** Contact category names ("Person", "Business", "Important") and household member roles ("ADMIN", "MEMBER", "GUEST") are hardcoded in UI selection menus and table badges.
- **Step-by-Step Remediation Plan:**
  1. Update `packages/shared/src/features/i18n/locales/{de,en,pl}/dashboard.json` with category and role translation maps.
  2. Replace hardcoded strings with localized getters in `ContactModal.tsx` and `MemberGrid.tsx`.

#### Ticket ID: `AUDIT-I18N-03`
- **Target Path:** `apps/maintenance/frontend/src/features/history/components/HistoryView.tsx` & `apps/pantry/frontend/src/components/ui/dialog.tsx`
- **Severity:** `MEDIUM`
- **Problem Description & Rationale:** User error banners and dialog accessibility labels contain unlocalized hardcoded strings.
- **Step-by-Step Remediation Plan:**
  1. Add `maintenance.history.load_error` and `common.close` translation keys.
  2. Replace hardcoded strings with translation hook calls.

---

### Pillar 4: Test Coverage & Testing Quality

#### Ticket ID: `AUDIT-TEST-01`
- **Target Path:** `apps/chores/frontend`
- **Severity:** `CRITICAL`
- **Problem Description & Rationale:** `apps/chores/frontend` has **0 test files**. Any UI regression or broken interaction will go completely unnoticed in CI.
- **Step-by-Step Remediation Plan:**
  1. Create `src/tests/setup.ts` and `src/tests/test-utils.tsx` with MSW handlers and React Testing Library setup.
  2. Write unit tests for `DashboardView.tsx` and `WizardSteps.tsx`.
  3. Write service unit tests for `choresService.ts`.
  4. Ensure `pnpm --filter chores-frontend test` executes and passes.

#### Ticket ID: `AUDIT-TEST-02`
- **Target Path:** `packages/shared`
- **Severity:** `CRITICAL`
- **Problem Description & Rationale:** Core shared infrastructure (`useTranslation`, `ThemeContext`, `OSMMapViewer`, `HouseholdSwitcher`, `AppHeader`) has **0% test coverage**. Regressions in `packages/shared` will break all consuming microfrontends.
- **Step-by-Step Remediation Plan:**
  1. Configure Vitest test runner in `packages/shared/vitest.config.ts`.
  2. Add unit tests for `useTranslation` hook (verifying fallback behavior and dictionary loading across `de`, `en`, `pl`).
  3. Add component tests for `ThemeToggle`, `HouseholdSwitcher`, and `StatusBadge`.
  4. Add `packages/shared` test execution to `./scripts/verify.sh`.

#### Ticket ID: `AUDIT-TEST-03`
- **Target Path:** `core/dashboard/backend/internal/features/...`
- **Severity:** `HIGH`
- **Problem Description & Rationale:** Go backend services have low test coverage (18% - 26%). Handler HTTP endpoints, SQL middleware, and keycloak authentication parsing lack unit/integration coverage.
- **Step-by-Step Remediation Plan:**
  1. Create table-driven unit tests for HTTP handlers in `household/handler_test.go` and `contact/handler_test.go` using `httptest.NewRecorder()`.
  2. Add unit tests for Keycloak token parsing in `shared/middleware/auth_test.go`.
  3. Increase Go statement coverage across all packages to > 60%.

#### Ticket ID: `AUDIT-TEST-04`
- **Target Path:** `apps/maintenance/frontend` & `apps/shopping/frontend`
- **Severity:** `MEDIUM`
- **Problem Description & Rationale:** Frontends have minimal coverage (1-2 test files each). Core features like `AddDeviceWizard`, `MaintenanceMode`, `ListSelector`, and `EinlagernModal` are untested.
- **Step-by-Step Remediation Plan:**
  1. Create Vitest component test suites for `AddDeviceWizard.test.tsx` and `MaintenanceMode.test.tsx` in maintenance frontend.
  2. Create component test suites for `ListSelector.test.tsx` and `EinlagernModal.test.tsx` in shopping frontend.
  3. Verify accessibility with `vitest-axe` across all new tests.

---

### Pillar 5: Dependencies, Modern Tooling & Security

#### Ticket ID: `AUDIT-SEC-01`
- **Target Path:** `apps/*/backend/src/core/dependencies.py`
- **Severity:** `HIGH`
- **Problem Description & Rationale:** Python authentication dependency fallbacks check `if os.getenv("PYTEST_CURRENT_TEST") or settings.ENVIRONMENT == "testing":` to inject mock user contexts. If `ENVIRONMENT` is accidentally set to `testing` in a staging/prod environment, authentication controls could be bypassed.
- **Step-by-Step Remediation Plan:**
  1. Ensure mock context injection is strictly constrained to explicit test execution contexts and disabled whenever non-localhost production DB/Keycloak URLs are detected.
  2. Implement strict guardrails and logging whenever unauthenticated mock fallback context is utilized.
  3. Add security unit test explicitly verifying that mock fallback fails when `ENVIRONMENT == "production"`.

#### Ticket ID: `AUDIT-TOOL-01`
- **Target Path:** `apps/*/frontend/vitest.config.ts`
- **Severity:** `LOW`
- **Problem Description & Rationale:** Vitest outputs warnings regarding `vite-tsconfig-paths` plugin deprecation in Vite 6 / Vitest 4 (`Vite now supports tsconfig paths resolution natively via resolve.tsconfigPaths`).
- **Step-by-Step Remediation Plan:**
  1. Update `vitest.config.ts` across all frontend projects to use `resolve: { tsconfigPaths: true }`.
  2. Remove obsolete `vite-tsconfig-paths` dependency from `package.json` files.
  3. Confirm clean test execution without deprecation warnings.

---

## 6. Implementation Strategy & Roadmap

```text
  Phase 1: Critical Test Infrastructure & Security (Week 1)
  ├── AUDIT-SEC-01   (Constrain mock auth fallbacks in backend services)
  ├── AUDIT-TEST-01  (Establish Vitest test suite for apps/chores/frontend)
  └── AUDIT-TEST-02  (Establish Vitest test suite for packages/shared)

  Phase 2: Architectural Refactoring & SRP Decomposition (Week 2)
  ├── AUDIT-FDD-01   (Decompose shopping_lists/service.py)
  ├── AUDIT-FDD-02   (Decompose inventory/service.py)
  ├── AUDIT-FDD-03   (Decompose HouseholdDetailView.tsx)
  └── AUDIT-FDD-04   (Refactor MCP tool business logic into service layer)

  Phase 3: i18n & Frontend Quality Remediation (Week 3)
  ├── AUDIT-I18N-01  (Localize auth provider overlays)
  ├── AUDIT-I18N-02  (Localize dashboard categories & member roles)
  └── AUDIT-I18N-03  (Localize dialogs & error banners)

  Phase 4: Coverage Expansion & Tooling Alignment (Week 4)
  ├── AUDIT-TEST-03  (Expand Go backend HTTP handler coverage)
  ├── AUDIT-TEST-04  (Expand maintenance & shopping frontend coverage)
  ├── AUDIT-DOCS-01  (Harmonize .ai knowledge base with reality)
  └── AUDIT-TOOL-01  (Clean up Vite/Vitest tsconfig deprecations)
```

---
*End of Audit Master Backlog.*
