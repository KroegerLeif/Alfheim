<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — core/household/frontend

Next.js frontend: Household UI: onboarding, members, invites, profile. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, API client, household gate, Tailwind pairing): [Next.js and Tailwind](../../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter household-frontend exec tsc --noEmit
pnpm --filter household-frontend test
pnpm --filter household-frontend build
./scripts/verify.sh --frontend   # full gate from the repo root, must exit 0
```

## Specific to this app

- The household app keeps its own `src/i18n`; every new key goes into all three locales there.

Reference page: [docs/en/reference/apps/household.md](../../../docs/en/reference/apps/household.md).
