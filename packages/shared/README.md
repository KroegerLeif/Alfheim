# `@alfheim/shared`

Shared frontend package for reusable cross-app features in Alfheim.

## Feature-Driven Structure

```text
src/
├── features/
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
│   │   └── AppShell/        # Base application shell wrapper
│   └── ui/                  # Atomic primitives namespace
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
} from '@alfheim/shared';
```

## i18n Rules

- Supported locales: `de`, `en`, `pl`
- Default fallback locale: `de`
- Domain dictionaries per locale:
  - `common.json`
  - `dashboard.json`
  - `shopping.json`
  - `pantry.json`
  - `maintenance.json`
- `getSharedMessages(locale)` merges all domain dictionaries for the requested locale and falls back to German keys.

## Theme Rules

- Theme variants: `obsidian`, `kinetic`, `slate`
- Every variant provides both `dark` and `light` token sets
- Consumers must use CSS variables provided by `ThemeProvider` (`--surface-*`, `--text-*`, `--primary-*`, etc.)

## Consumption Guidelines

- Do not deep-import files from `src/features/*` in applications.
- Add new shared components inside the appropriate feature module and expose them via the module `index.ts` and root `src/index.ts`.
- Keep all component names, folder names, and exports in English.
