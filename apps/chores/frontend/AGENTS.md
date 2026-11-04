<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — apps/chores/frontend

Next.js frontend: Chores UI: today list, streaks, templates. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, API client, household gate, Tailwind pairing): [Next.js and Tailwind](../../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter chores-frontend exec tsc --noEmit
pnpm --filter chores-frontend test
pnpm --filter chores-frontend build
./scripts/verify.sh --frontend   # full gate from the repo root, must exit 0
```

## Specific to this app

- i18n keys: `…/locales/{en,de,pl}/chores.json`.

Reference page: [docs/en/reference/apps/chores.md](../../../docs/en/reference/apps/chores.md).
