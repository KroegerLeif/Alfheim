<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — apps/shopping/frontend

Next.js frontend: Shopping UI: lists, reorder, stock-in. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, API client, household gate, Tailwind pairing): [Next.js and Tailwind](../../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter shopping-frontend exec tsc --noEmit
pnpm --filter shopping-frontend test
pnpm --filter shopping-frontend build
./scripts/verify.sh --frontend   # full gate from the repo root, must exit 0
```

## Specific to this app

- Protected lists are identified by `is_personal` / `is_default`, never by name.
- i18n keys: `…/locales/{en,de,pl}/shopping.json`.

Reference page: [docs/en/reference/apps/shopping.md](../../../docs/en/reference/apps/shopping.md).
