<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — apps/pantry/frontend

Next.js frontend: Pantry UI: inventory, locations, barcode scan. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, API client, household gate, Tailwind pairing): [Next.js and Tailwind](../../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter pantry-frontend exec tsc --noEmit
pnpm --filter pantry-frontend test
pnpm --filter pantry-frontend build
./scripts/verify.sh --frontend   # full gate from the repo root, must exit 0
```

## Specific to this app

- End-to-end tests live in `e2e/` (Playwright).
- i18n keys: `…/locales/{en,de,pl}/pantry.json`.

Reference page: [docs/en/reference/apps/pantry.md](../../../docs/en/reference/apps/pantry.md).
