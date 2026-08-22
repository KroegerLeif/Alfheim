# Blueprint: Adding a Shared Component (`@alfheim/shared`)

Follow this checklist whenever you add a reusable component to the shared workspace package.

---

## 🚦 Step-by-Step Blueprint

### 1) Choose the correct feature module
Identify the purpose of your component and place it in the appropriate subdirectory under `packages/shared/src/features/`:
* `features/i18n/components/` for localization UI
* `features/theme/components/` for theme controls
* `features/layout/` for structural shell, headers, and sidepanels
* `features/ui/components/` for atomic primitives (buttons, badges, inputs)

### 2) Create the component file
* Use **English** file and symbol names.
* Prefer named exports instead of default exports.
* Keep props explicit, documented, and strictly typed.
* Example path:
  `packages/shared/src/features/<feature>/components/MyComponent.tsx`

### 3) Use translation keys (Zero Hardcoding Rule)
* Use the `useTranslation()` or `useTranslations()` hooks.
* Avoid hardcoded user-facing strings.
* Register missing translation keys across all three locale files:
  `packages/shared/src/features/i18n/locales/{de,en,pl}/`
* Keep German (`de`) as the canonical default/fallback.

### 4) Use theme tokens
* Consume CSS custom properties from the shared design system (`var(--surface-canvas)`, `var(--text-main)`, `var(--primary-main)`).
* Do **NOT** use hardcoded hexadecimal or RGB color strings in component styling.
* If a new theme token is required, refer to [blueprints/theme.md](.ai/blueprints/theme.md) to register it correctly.

### 5) Register exports
* Export the component from the feature's local `index.ts`.
* Re-export from `packages/shared/src/features/index.ts`.
* Expose publicly in the root `packages/shared/src/index.ts`.

### 6) Validate
Verify typechecks compile cleanly across the shared package:
```bash
pnpm --filter @alfheim/shared exec tsc --noEmit
```

### 7) Missing Backend / API fallbacks
* Do not inject mock/hardcoded fake arrays or items directly into the components.
* Render a clean placeholder/empty state.
* Register a task in the backlog to implement the missing endpoint, specifying the app and domain context.
