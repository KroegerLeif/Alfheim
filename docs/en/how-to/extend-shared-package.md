---
title: "Extend the Shared Package"
description: "Add a reusable component or a design theme to the @alfheim/shared workspace package."
sidebar:
  order: 20
---

> **TL;DR:** Add a component to a feature module of `@alfheim/shared`, or register a new theme token set, and verify the package type-checks.

---

## Add a shared component

1. Pick the feature module under `packages/shared/src/features/`: `ui/components/` for primitives, `layout/` for shell and headers, `theme/components/` for theme controls, `i18n/components/` for localization UI.
2. Create `features/<feature>/components/MyComponent.tsx` with English names, a named export and explicit, typed props.
3. Use `useTranslation()` for every user-facing string and add each key to the `en`, `de` and `pl` files in `packages/shared/src/features/i18n/locales/`.
4. Style with theme tokens (`var(--surface-canvas)`, `var(--text-primary)`, `var(--primary-main)`), never hex or RGB values.
5. Export it from the feature `index.ts`, then `packages/shared/src/features/index.ts`, then `packages/shared/src/index.ts`.
6. Verify: `pnpm --filter @alfheim/shared exec tsc --noEmit`.

If the backend an interface needs does not exist yet, hide the UI and file an issue instead of rendering mock data.

## Add a theme

Each theme defines a `dark` and a `light` variant that match the `ThemeTokens` interface.

1. Create `packages/shared/src/features/theme/tokens/themes/<name>.json` with both variants. Contrast targets: `textMain` / `textPrimary` at least 4.5:1 (AAA 7:1), `textSecondary` at least 4.5:1, `textMuted` at least 3:1.
2. Add `'<name>'` to the `ThemeVariant` union in `features/theme/types/index.ts`.
3. Import the JSON in `features/theme/tokens/index.ts` and add it to `THEME_TOKENS`.
4. The dashboard settings page lists `Object.keys(THEME_TOKENS)` and renders the swatch automatically.
5. Verify with `pnpm --filter shopping-frontend exec tsc --noEmit`, select the theme in the header `ThemeToggle` in both modes and check that `--surface-canvas`, `--text-primary` and `--primary-main` change on `document.documentElement`.

The required token keys are the ones in an existing theme file such as `nordic.json`; copy it as the starting point.
