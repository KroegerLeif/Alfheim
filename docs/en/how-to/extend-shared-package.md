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

## Use the shared brand assets

`packages/shared` is the only home of the Alfheim brand. Apps consume it; they never keep a copy.

| Asset | Location | How an app uses it |
| --- | --- | --- |
| Alfheim logo | `src/assets/brand/` (`logo-mark.svg`, `logo-mark-white.svg`, `AlfheimMark`) | Render `AlfheimMark`, or resolve a path from `BRAND_ASSETS` |
| Favicons and web manifest | `src/assets/favicon_io/` | Copied into `public/` at `predev`/`prebuild`, linked by `createAppMetadata` |
| App icons | `src/assets/apps/<app>.svg` (`APP_ICONS`) and `src/assets/appGlyphs.ts` (`APP_GLYPH_ICONS`) | Render `AppLogo`; change an app's icon in these two registries only |

To give a frontend its favicons:

1. Add the copy step to the frontend's `package.json`, with the relative path to the repository root:

   ```json
   "predev": "node ../../../packages/shared/scripts/sync-brand-assets.mjs",
   "prebuild": "node ../../../packages/shared/scripts/sync-brand-assets.mjs"
   ```

   The copied files are ignored by `.gitignore`; do not commit them, and do not add a `src/app/favicon.ico`.
2. Spread the helper into the root layout's metadata. It prefixes every URL with the app's base path (`/<app>`, or the root for the dashboard), because Next.js does not:

   ```typescript
   export const metadata: Metadata = { title: 'Pantry', ...createAppMetadata({ app: 'pantry' }) };
   ```

3. Make sure the Docker runner stage copies `public/` from the builder stage, where `pnpm run build` generated it.

## Create an app's API client

Every frontend talks to its backend through one `createApiClient` instance from `@alfheim/shared`. Do not write a `fetch` or `ky` wrapper that attaches tokens or household headers yourself.

1. Create the instance once, in the module that owns the app's API calls:

   ```typescript
   import { createApiClient } from '@alfheim/shared';

   export const api = createApiClient({
     basePath: '/api/v1/<app>',
     apiUrl: process.env.NEXT_PUBLIC_API_URL,
     session: true,
   });
   ```

   `session: true` attaches the bearer token from the shared token store, refreshes it once on a 401 (and starts a new login when that fails), sets `X-Household-ID` (never `X-Household-Role`) and reports household errors to the `HouseholdGate`. With a session, non-2xx responses reject with an `ApiError` (`status`, `code`, parsed `data`).
2. Call it from the feature's `api/` module: `api.get('items').json<Item[]>()`, `api.post('items', payload)` (plain objects are sent as JSON, `FormData` as multipart).
3. Every request has an 8 s timeout and rejects with `ApiTimeoutError` when it elapses. Override it with `timeoutMs`, or pass `stream: true` for Server-Sent Events and other long-lived responses.
4. Map errors for users with `isApiError` and `isApiTimeoutError`; pass `mapError` to `createApiClient` when an app needs its own error type.

In tests, inject `fetch` and a custom `session` instead of mocking modules.
