# Implementation Plan: Fix Issues for workout-backend-architecture-9d8656

> **Source:** `bugs-jules-8537550087956981552-9188f80b.md`
> **Total Open Issues:** 7

---

## Phasen & Roadmap

### Phase 1: High Priority & Blockers (Critical Fixes & Logic)

- [x] **Step 1.1: [ISSUE-01] Plan Editor Updates Silently Drop Edited Days, Exercises, and Sets**
  - **Betroffene Dateien:**
    - `apps/workout/backend/src/features/plans/schemas.py`
    - `apps/workout/backend/src/features/plans/services/plan_crud_service.py`
    - `apps/workout/frontend/src/features/plans/types.ts`
    - `apps/workout/frontend/src/app/[locale]/plans/[planId]/page.tsx`
    - `apps/workout/backend/src/features/plans/tests/test_plans_service.py`
    - `apps/workout/frontend/src/features/plans/tests/`
  - **Geplante Änderung:**
    - `PlanUpdate`-Schema im Backend um das optionale Feld `days: list[PlanDayCreate] | None = None` erweitern.
    - In `PlanCrudService.update_plan`: Wenn `payload.days is not None`, bestehende Tage/Übungen/Sätze des Plans in einer atomaren Transaktion durch die neu übergebenen Tage ersetzen (`plan.days = [_build_day(d, i) for i, d in enumerate(payload.days)]`), während Plan-Metadaten aktualisiert werden.
    - Im Frontend `PlanUpdate`-Interface in `types.ts` um `days?: PlanDayCreate[]` ergänzen.
    - In `PlanDetailPage` (`apps/workout/frontend/src/app/[locale]/plans/[planId]/page.tsx`) beim Speichern das vollständige Payload inkl. `days: payload.days` an `updatePlanMutation.mutateAsync` übergeben.
  - **Prüfung/Validierung:**
    - Backend Pytest-Test: Plan-Update mit geänderten Tagen/Übungen/Sätzen verifizieren.
    - Frontend Vitest-Test: Save-Handler-Aufruf mit kompletten Plan-Daten prüfen.

- [x] **Step 1.2: [ISSUE-07] Overuse of Unconstrained `any` Types in Shared Map and Autocomplete Utilities**
  - **Betroffene Dateien:**
    - `packages/shared/src/features/ui/components/OSMMapViewer.tsx`
    - `packages/shared/src/features/ui/components/AddressAutocomplete.tsx`
  - **Geplante Änderung:**
    - In `OSMMapViewer.tsx` alle `any`-Typen durch konkrete Leaflet-Typen (`L.Map`, `L.FeatureGroup`, `L.LeafletMouseEvent`, `L.MarkerOptions`) ersetzen.
    - In `AddressAutocomplete.tsx` ein typisiertes Interface für Nominatim-Geocoding-Ergebnisse (`NominatimSearchItem`, `NominatimAddress`) einführen und `item: any` entfernen.
  - **Prüfung/Validierung:**
    - TypeScript Type-Checking (`pnpm --filter @alfheim/shared build` / `tsc --noEmit`).
    - Vitest-Tests für Shared Components.

---

### Phase 2: Code Quality & Hardcoded Values (Refactoring & Security)

- [x] **Step 2.1: [ISSUE-03] Hardcoded Localhost URL in Client Header Back-to-Dashboard Link**
  - **Betroffene Dateien:**
    - `apps/workout/frontend/src/components/shared/ClientHeader.tsx`
  - **Geplante Änderung:**
    - Die statische Entwicklungs-URL `"http://alfheim.loegien.localhost"` entfernen.
    - Stattdessen auf den standardmäßigen Environment-Fallback `process.env.NEXT_PUBLIC_FRONTEND_URL || "/"` zurückgreifen bzw. die interne Fallback-Logik von `AppHeader` nutzen.
  - **Prüfung/Validierung:**
    - Vitest-Komponententest für `ClientHeader`.

- [x] **Step 2.2: [ISSUE-04] Hardcoded Endpoint URL in Household Switcher Component**
  - **Betroffene Dateien:**
    - `packages/shared/src/features/ui/components/HouseholdSwitcher.tsx`
  - **Geplante Änderung:**
    - Den fehleranfälligen Fallback `await fetchHouseholds('http://alfheim/api/v1/households/me')` entfernen.
    - Den Haushaltsabruf ausschließlich über den relativen Standardpfad `/api/v1/households/me` durchführen.
  - **Prüfung/Validierung:**
    - Vitest-Tests für `HouseholdSwitcher`.

---

### Phase 3: UI/UX & Refinements (Translations & UI Terminology)

- [x] **Step 3.1: [ISSUE-02] Incorrect Translation Key Used for Days Count in Plan Cards**
  - **Betroffene Dateien:**
    - `packages/shared/src/features/i18n/locales/de/workout.json`
    - `packages/shared/src/features/i18n/locales/en/workout.json`
    - `packages/shared/src/features/i18n/locales/pl/workout.json`
    - `apps/workout/frontend/src/features/plans/components/PlanCard.tsx`
  - **Geplante Änderung:**
    - Neue Lokalisierungsschlüssel für Tagesanzahl hinzufügen (`workout.daysCount`: DE: "Tage", EN: "Days", PL: "Dni").
    - In `PlanCard.tsx` das fehlerhafte `t("workout.plansTitle")` durch `t("workout.daysCount")` ersetzen.
  - **Prüfung/Validierung:**
    - Vitest-Tests für `PlanCard`.

- [x] **Step 3.2: [ISSUE-05] Dynamic String Capitalization and Any-Casting for Translation Keys in Exercise Row**
  - **Betroffene Dateien:**
    - `apps/workout/frontend/src/features/plans/components/PlanExerciseRow.tsx`
  - **Geplante Änderung:**
    - Dynamische String-Verkettung (`workout.muscle...`) und den `as any`-Cast entfernen.
    - Stattdessen das typisierte Dictionary `MUSCLE_GROUP_LABEL_KEYS[foundExercise.primary_muscle]` aus `@/features/exercises/types` verwenden.
  - **Prüfung/Validierung:**
    - TypeScript Type-Checking (`pnpm --filter workout-frontend check-types`).
    - Vitest-Tests für `PlanExerciseRow`.

- [x] **Step 3.3: [ISSUE-06] Unspecific Headings and Missing Column Header Translation in Analytics Leaderboard**
  - **Betroffene Dateien:**
    - `packages/shared/src/features/i18n/locales/de/workout.json`
    - `packages/shared/src/features/i18n/locales/en/workout.json`
    - `packages/shared/src/features/i18n/locales/pl/workout.json`
    - `apps/workout/frontend/src/features/analytics/components/LeaderboardPanel.tsx`
  - **Geplante Änderung:**
    - Übersetzungsschlüssel `workout.user` in den Sprachdateien ergänzen (DE: "Mitglied", EN: "Member", PL: "Użytkownik").
    - In `LeaderboardPanel.tsx` die `sr-only` Kennzeichnung der Tabellenspalte von `t("workout.leaderboard")` auf `t("workout.user")` korrigieren.
  - **Prüfung/Validierung:**
    - Vitest-Tests für `LeaderboardPanel`.

---

## Review-Checkliste nach Umsetzung
- [x] Type-Check / Build läuft fehlerfrei durch (`pnpm -r exec tsc --noEmit` / `./scripts/verify.sh --all`)
- [x] Linter & Formatierung fehlerfrei (`ruff`, `eslint`, Pre-commit Hooks)
- [x] Englische Code-Kommentare beibehalten
- [x] Status-Update in `bugs-jules-8537550087956981552-9188f80b.md` abhaken (`[x] Closed`)
