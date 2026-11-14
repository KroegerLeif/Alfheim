---
title: "Next.js and Tailwind Conventions"
description: "Canonical conventions for Alfheim Next.js frontends: feature layout, data fetching, household gate and Tailwind theme pairing."
sidebar:
  label: "Next.js & Tailwind"
---

> **TL;DR:** Canonical conventions for every frontend (`apps/*/frontend`, `core/*/frontend`). Nested `AGENTS.md` files link here instead of repeating these rules.

---

## Stack

Next.js (App Router, `src/proxy.ts` instead of the deprecated `middleware.ts`), Tailwind CSS v4, TanStack Query v5, the shared API client (`createApiClient`), TypeScript with Zod schemas, `@alfheim/shared` for UI primitives, i18n, auth and household context.

## Layout

```text
src/
├── app/            # pages, layouts, route handlers only
├── features/<domain>/
│   ├── components/ # feature UI
│   ├── hooks/      # TanStack Query hooks
│   ├── api/        # calls through the shared client
│   ├── types/      # interfaces and Zod schemas
│   └── index.ts    # public barrel
└── shared/         # domain-agnostic components, hooks, lib (cn, formatters)
```

## App scaffold

The locale routing and shell files are thin calls into `@alfheim/shared`, so a fix to locale handling lands in one place:

| File | Shared factory | App-specific part |
| --- | --- | --- |
| `src/navigation.ts` | `createNavigation()` (`@alfheim/shared/i18n/navigation`) | none |
| `src/proxy.ts` | `createProxy({ defaultLocale })` (`@alfheim/shared/i18n/proxy`) | default locale; the literal `config.matcher`, which Next.js reads statically |
| `src/i18n.ts` | `createRequestConfig()` (`@alfheim/shared/i18n/request`) | none; pass `loadMessages` for another catalogue |
| `src/app/[locale]/providers.tsx` | `AppProviders` (`@alfheim/shared/app-shell`) | theme defaults and app providers as children |
| `src/app/[locale]/loading.tsx` | `AppLoading` (`@alfheim/shared/app-shell`) | optional `messageKey` |

Every app serves `en`, `de` and `pl` with the locale always in the URL (`/pantry/de/inventory`). The header is the shared `ClientHeader`, wrapped in `src/components/shared/ClientHeader.tsx` with the app name and brand title. These factories live on subpaths, not the package root, because they need next-intl and TanStack Query, which non-Next consumers of `@alfheim/shared` do not install. The household app keeps its own `src/i18n` messages and the dashboard its own proxy.

## Data fetching

- All HTTP goes through one `createApiClient({ basePath, apiUrl: process.env.NEXT_PUBLIC_API_URL, session: true })` instance from `@alfheim/shared` (usually `src/core/api.ts`), with a timeout. Components and features never call bare `fetch` and apps write no token-attaching wrapper of their own; see [Create an app's API client](../../how-to/extend-shared-package.md#create-an-apps-api-client).
- The session attaches `Authorization: Bearer <token>` from `sessionStorage.alfheim_access_token`, refreshes it once on a 401, sets `X-Household-ID` (never `X-Household-Role`) and passes failed responses to `reportHouseholdErrorResponse`.
- Wrap calls in hooks under `features/<domain>/hooks/`. Household-scoped queries include the household id in the query key and are enabled only when the household is ready:

```typescript
const { householdId, status } = useActiveHousehold();
return useQuery({
  queryKey: ['items', householdId],
  queryFn: () => api.get('items').json<Item[]>(),
  enabled: status === 'ready',
});
```

## Feature isolation

Features do not import from other features directly; they expose components and hooks through the feature's `index.ts` barrel. Generic concerns (auth, query client, base HTTP client, providers) live in `src/shared/`. Dynamic routes are async Server Components that resolve `params` with `await`; wrap client components that depend on search params in `<Suspense>` to avoid hydration crashes.

## Household gate

`HouseholdProvider` is mounted by the shared `AppShell`. Wrap household-scoped pages in `HouseholdGate`, which shows onboarding, switch and retry states. Take the household id from `useActiveHousehold()`; never read `localStorage.alfheim_active_household_id` or token claims.

## Tailwind v4 theme pairing

No arbitrary color values such as `bg-[#0f172a]`. Pair every light class with a dark class from the standard tokens:

| UI role | Classes |
| --- | --- |
| Page background | `bg-slate-50 dark:bg-slate-950` |
| Card or surface | `bg-white dark:bg-slate-900` |
| Primary text | `text-slate-900 dark:text-slate-100` |
| Muted text | `text-slate-600 dark:text-slate-400` |
| Subtle border | `border-slate-200 dark:border-slate-800` |
| Hover | `hover:bg-slate-100 dark:hover:bg-slate-800` |

Shared components consume the CSS custom properties from the shared theme (`var(--surface-canvas)`, `var(--text-primary)`, `var(--primary-main)`). To add a component or theme to the shared package, see [Extend the shared package](../../how-to/extend-shared-package.md).

## Testing setup

Frontend configuration comes from `packages/shared`; each app keeps only what differs:

| File | Shared source | Per app |
| --- | --- | --- |
| `tsconfig.json` | `extends: "../../../packages/shared/tsconfig.base.json"` | `paths` and `include` |
| `vitest.config.ts` | `defineAlfheimVitestConfig()` from `packages/shared/vitest.preset.ts` | `testTimeout`, `coverageInclude`; no thresholds (#385) |
| `src/tests/setup.ts` | `setupAlfheimTests()` and the module doubles from `@alfheim/shared/testing` | app-specific mocks only |

`setupAlfheimTests({ server })` registers the jest-dom and vitest-axe matchers (their type augmentation ships with it, so apps keep no `jest-dom.d.ts` or `vitest-axe.d.ts`), a 5 s async-utility timeout, in-memory `localStorage`/`sessionStorage`, the MSW server lifecycle and an optional `matchMedia` double. Mock modules in the app's setup with the shared doubles, loaded inside the factory because `vi.mock` is hoisted:

```typescript
vi.mock('next/navigation', async () => (await import('@alfheim/shared/testing')).nextNavigationMock());
vi.mock('@alfheim/shared', async (importOriginal) =>
  (await import('@alfheim/shared/testing')).strictTranslationMock(await importOriginal<typeof import('@alfheim/shared')>()));
```

`appNavigationMock()` replaces `@/navigation`, `nextIntlKeyMock()` replaces `next-intl` with key passthrough, and `strictTranslationMock` keeps the real dictionaries but throws on a key that does not resolve.

## Gates

`./scripts/verify.sh --frontend` runs `tsc --noEmit` and Vitest for every frontend. `pnpm build` verifies the production build. Read the Next.js guide in `node_modules/next/dist/docs/` before using an API you are unsure about; this version differs from older releases.
