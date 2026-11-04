<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — apps/budget/frontend

Next.js frontend: Budget UI: accounts, pots, plans, transactions. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, API client, household gate, Tailwind pairing): [Next.js and Tailwind](../../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter @alfheim/budget-frontend exec tsc --noEmit
pnpm --filter @alfheim/budget-frontend test
pnpm --filter @alfheim/budget-frontend build
./scripts/verify.sh --frontend   # full gate from the repo root, must exit 0
```

## Specific to this app

- i18n keys: `packages/shared/src/features/i18n/locales/{en,de,pl}/budget.json`.

Reference page: [docs/en/reference/apps/budget.md](../../../docs/en/reference/apps/budget.md).
