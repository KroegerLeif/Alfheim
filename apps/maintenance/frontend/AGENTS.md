<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — apps/maintenance/frontend

Next.js frontend: Maintenance UI: devices, steps, service history. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, API client, household gate, Tailwind pairing): [Next.js and Tailwind](../../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter maintenance-frontend exec tsc --noEmit
pnpm --filter maintenance-frontend test
pnpm --filter maintenance-frontend build
./scripts/verify.sh --frontend   # full gate from the repo root, must exit 0
```

## Specific to this app

- i18n keys: `…/locales/{en,de,pl}/maintenance.json`.

Reference page: [docs/en/reference/apps/maintenance.md](../../../docs/en/reference/apps/maintenance.md).
