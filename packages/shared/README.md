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
- Always call `t()` with the full dictionary path, including the namespace (`t('budget.accounts.create')`,
  `t('common.save')`). `t()` returns the key itself when it is missing, so never write `t('key') || 'Fallback'`;
  compare the result with the key if a component needs a fallback.
- Every new key goes into `en`, `de` and `pl` in the same change. `src/features/i18n/tests/localeParity.test.ts`
  enforces parity (and matching `{placeholders}`), and `translationKeys.test.ts` fails on any literal key passed
  to the shared `t()` in `packages/shared` or a consumer frontend that does not resolve.
- In app tests, prefer the real `useTranslation` (optionally wrapped to throw on unresolved keys, as in
  `apps/budget/frontend/src/tests/setup.ts`) over mocks that return hardcoded strings.

## Icons and Assets

- Use `lucide-react` icons in shared components; do not inline `<svg>` markup or rely on the Material Symbols font.
- Brand artwork lives in `src/assets`: `AlfheimMark` (the line-art brand mark), `APP_GLYPH_ICONS` (per-app glyphs used
  by `AppLogo`; change an app icon there), the static brand/app SVG files, and the Alfi mascot poses.

## Theme Rules

- Theme variants: `nordic` (default), `obsidian`, `kinetic`, `slate`, `custom`
- Every variant provides both `dark` and `light` token sets
- Consumers must use CSS variables provided by `ThemeProvider` (`--surface-*`, `--text-*`, `--primary-*`, etc.)

## Consumption Guidelines

- Do not deep-import files from `src/features/*` in applications.
- Add new shared components inside the appropriate feature module and expose them via the module `index.ts` and root `src/index.ts`.
- Keep all component names, folder names, and exports in English.
