<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — core/dashboard/frontend

Next.js frontend: Dashboard UI: launcher, settings, theme picker. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, API client, household gate, Tailwind pairing): [Next.js and Tailwind](../../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter dashboard-frontend exec tsc --noEmit
pnpm --filter dashboard-frontend test
pnpm --filter dashboard-frontend build
./scripts/verify.sh --frontend   # full gate from the repo root, must exit 0
```

## Specific to this app

- Strings stay in `packages/shared`; the theme picker iterates `THEME_TOKENS`.

Reference page: [docs/en/reference/apps/dashboard.md](../../../docs/en/reference/apps/dashboard.md).
