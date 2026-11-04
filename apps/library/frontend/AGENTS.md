<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — apps/library/frontend

Next.js frontend: Library UI: catalog, loans, manuals. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, API client, household gate, Tailwind pairing): [Next.js and Tailwind](../../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter library-frontend exec tsc --noEmit
pnpm --filter library-frontend test
pnpm --filter library-frontend build
./scripts/verify.sh --frontend   # full gate from the repo root, must exit 0
```

## Specific to this app

- i18n keys: `…/locales/{en,de,pl}/library.json`.

Reference page: [docs/en/reference/apps/library.md](../../../docs/en/reference/apps/library.md).
