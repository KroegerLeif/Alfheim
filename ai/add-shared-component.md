# Adding a Shared Component (`@loeger-os/shared`)

Follow this checklist whenever you add a reusable shared component.

## 1) Choose the correct feature module

- `features/i18n/components/` for localization UI
- `features/theme/components/` for theme controls
- `features/layout/` for structural shell/header/panel components
- `features/ui/components/` for atomic primitives

## 2) Create the component file

- Use **English** file and symbol names.
- Prefer named exports.
- Keep props explicit and typed.

Example path:

```text
packages/shared/src/features/<feature>/components/MyComponent.tsx
```

## 3) Use translation keys (no hardcoded product text)

- Use `useTranslation()` for user-facing text.
- Add missing keys in all locale files under:

```text
packages/shared/src/features/i18n/locales/{de,en,pl}/
```

- Keep German (`de`) as canonical default/fallback.

## 4) Use theme tokens (no hardcoded hex in component styles)

- Prefer CSS variables from shared theme tokens (`var(--surface-canvas)`, `var(--text-main)`, etc.).
- If you need new semantic token names, add them in:
  - `features/theme/types.ts`
  - `features/theme/tokens/index.ts`
  - each theme JSON in `features/theme/tokens/themes/*.json`

## 5) Register exports

- Export from the feature-local `index.ts`
- Re-export from `packages/shared/src/features/index.ts`
- Keep root API clean through `packages/shared/src/index.ts`

## 6) Validate

Run typecheck:

```bash
pnpm --filter @loeger-os/shared exec tsc --noEmit
```

## 7) If backend/API is missing

- Do not add fake/mock data in shared components.
- Render a clean placeholder/empty state.
- Add a structured task to `ai/backlog.md` with app + domain + missing endpoint/logic.
