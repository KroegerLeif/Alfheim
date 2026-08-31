# Backlog: Vitest Frontend Coverage Gates (≥90.0%)

## Overview
Vitest coverage threshold gates of **90.0%** for `lines`, `functions`, `branches`, and `statements` have been configured across all workspace `vitest.config.ts` configurations (`packages/shared`, `core/dashboard/frontend`, `apps/*/frontend`, and `websites/docs`).

## Completed Packages & Infrastructure
1. **Workspace Vitest Threshold Configurations:**
   - Enforced global 90% thresholds across all 10 frontend app configs and shared library.
2. **`packages/shared` (@alfheim/shared):**
   - 100% test pass rate with statement, line, and function coverage >90%.
   - Full test coverage for UI primitives (`Button`, `Dialog`, `Table`, `IconPicker`, `AddressAutocomplete`, `HouseholdSwitcher`), layout shell (`AppHeader`, `AppShell`), SSE streaming client, theme context/utilities, and language context.
3. **`apps/budget/frontend` & `apps/chat/frontend`:**
   - Core API direct tests, component integration tests, and feature wrappers added.

## Backlog Tasks for Remaining Frontends to Reach 90.0% Gate
To finalize full workspace 90% coverage gate enforcement across all remaining microservices, add unit and component tests for the following features:

- [ ] **`apps/chores/frontend`**:
  - Add component tests for `src/features/chore_management/` (ChoreCard, ChoreFormModal, DashboardView).
  - Add hook/API tests for `choresService.ts` and `integrationService.ts`.
- [ ] **`apps/library/frontend`**:
  - Add component tests for `src/features/catalog/`, `src/features/lending/`, `src/features/locations/`, `src/features/manuals/`, and `src/features/item-dialog/`.
  - Add API client tests for `src/core/api.ts`.
- [ ] **`apps/maintenance/frontend`**:
  - Add component and API tests for `src/features/devices/`, `src/features/history/`, `src/features/maintenance/`, `src/features/scheduled/`, and `src/features/shopping/`.
- [ ] **`apps/pantry/frontend`**:
  - Add component and API tests for `src/features/inventory/`, `src/features/products/`, `src/features/locations/`, `src/features/categories/`, and `src/features/analytics/`.
- [ ] **`apps/shopping/frontend`**:
  - Add tests for `src/features/shopping-lists/` and `src/features/shopping-history/`.
- [ ] **`apps/workout/frontend`**:
  - Add tests for `src/features/exercises/`, `src/features/plans/`, `src/features/session/`, `src/features/analytics/`, `src/features/equipment/`, and `src/features/offline_sync/`.
- [ ] **`core/dashboard/frontend`**:
  - Add tests for `src/features/dashboard/`, `src/features/profile/`, `src/features/contact/`, `src/features/apps/`, and `src/features/household/`.
- [ ] **`websites/docs`**:
  - Add unit/component tests for `src/components/sections/` (HeroSection, AppsGrid, TechStackSection, ArchitectureSection, AlfiSection, VpnNoticeBanner) and `src/i18n/useDocTranslation.tsx`.

## Verification Commands
```bash
# Workspace frontend typecheck
pnpm check-types

# Workspace frontend linting
pnpm lint

# Run coverage across all frontends
pnpm --recursive test:coverage
```
