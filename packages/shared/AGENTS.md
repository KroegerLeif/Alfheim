# AGENTS.md — packages/shared (`@alfheim/shared`)

Shared UI primitives, i18n, auth, household context, theme and assets used by every frontend.
Adds to the [root rules](../../AGENTS.md). Frontend conventions:
[Next.js and Tailwind](../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter @alfheim/shared exec tsc --noEmit
pnpm --filter @alfheim/shared test
./scripts/verify.sh --frontend   # full gate, must exit 0
```

## Specific to this package

- Code is organised by feature under `src/features/{api,auth,config,finance,household,i18n,layout,mascot,theme,ui}`. Export each new symbol through the feature `index.ts`, `src/features/index.ts` and `src/index.ts`.
- Use named exports and explicit, typed props. No hardcoded colors: consume the theme CSS variables.
- Every new translation key goes into `src/features/i18n/locales/{en,de,pl}/`.
- A change here affects every frontend: run the full frontend gate, not only this package's tests.
- Adding a component or a theme: [Extend the shared package](../../docs/en/how-to/extend-shared-package.md).
- Household context (`HouseholdProvider`, `useActiveHousehold`, `HouseholdGate`, `applyHouseholdHeaders`) must stay free of role claims; roles come from the membership API.
