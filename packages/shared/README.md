# `@alfheim/shared`

Shared frontend package for reusable cross-app features in Alfheim.

## Feature-Driven Structure

```text
src/
├── features/
│   ├── api/                 # ApiClient, fetchWithTrace, traceparent header injection
│   ├── auth/                 # resolveOidcIssuer() helpers, token storage
│   ├── household/            # HouseholdProvider, useActiveHousehold, HouseholdGate, householdStore
│   ├── i18n/
│   │   ├── components/      # Language switcher UI
│   │   ├── locales/         # de (default), en, pl domain dictionaries
│   │   └── utils/           # language context, translation hook, message loader
│   ├── theme/
│   │   ├── components/      # ThemeToggle
│   │   ├── hooks/           # ThemeProvider + useTheme
│   │   ├── tokens/          # CSS variable map + theme token JSON
│   │   └── types.ts
│   ├── layout/
│   │   ├── Header/          # AppHeader, AuthControls, BackToDashboard
│   │   ├── SidePanel/       # Reusable slide-over panel
│   │   ├── ChatWidget/      # Universal ALFI AI Assistant drawer & Mascot
│   │   └── AppShell/        # Base application shell wrapper (mounts HouseholdProvider)
│   ├── mascot/               # Alfi mascot renderer & states
│   ├── finance/              # Shared financial/budget UI components
│   ├── config/               # Shared runtime configuration helpers
│   └── ui/                   # Atomic primitives + HouseholdSwitcher
├── features/index.ts
└── index.ts                 # public exports
```

## Public Exports

Import only from package root:

```ts
import {
  LanguageProvider,
  useTranslation,
  ThemeProvider,
  useTheme,
  AppHeader,
  SidePanel,
  ChatWidget,
  AlfiAvatar,
  AlfiMascot,
  useAlfiChatLifecycle,
  AppShell,
  ThemeToggle,
  LanguageSwitcher,
  getSharedMessages,
  HouseholdProvider,
  useActiveHousehold,
  HouseholdGate,
  HouseholdSwitcher,
  useHouseholdSwitcher,
  applyHouseholdHeaders,
} from '@alfheim/shared';
```

`HouseholdProvider` / `useActiveHousehold()` / `HouseholdGate` (households, memberships,
`X-Household-ID`) implement the frontend side of household authorization
([ADR 0006](../../docs/en/explanation/decisions/0006-household-authorization-via-membership-api.md)).
The active household id is cached in `localStorage` under `alfheim_active_household_id` and
broadcast via a `storage-household-changed` event; consumers should always read it through
`useActiveHousehold()` rather than `localStorage` directly.

## i18n Rules

- Supported locales: `de`, `en`, `pl`
- Default fallback locale: `de`
- Domain dictionaries per locale (`src/features/i18n/locales/<locale>/`):
  - `common.json`, `dashboard.json`, `pantry.json`, `shopping.json`, `maintenance.json`,
    `chores.json`, `budget.json`, `chat.json`, `workout.json`, `library.json`, `docs.json`
- `getSharedMessages(locale)` merges all domain dictionaries for the requested locale and falls back to German keys.

## Theme Rules

- Theme variants: `nordic` (default), `obsidian`, `kinetic`, `slate`, `custom`
- Every variant provides both `dark` and `light` token sets
- Consumers must use CSS variables provided by `ThemeProvider` (`--surface-*`, `--text-*`, `--primary-*`, etc.)

## Consumption Guidelines

- Do not deep-import files from `src/features/*` in applications.
- Add new shared components inside the appropriate feature module and expose them via the module `index.ts` and root `src/index.ts`.
- Keep all component names, folder names, and exports in English.
