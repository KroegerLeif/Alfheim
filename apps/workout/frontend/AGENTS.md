<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — apps/workout/frontend

Next.js frontend: Workout UI: plans, live session logger with offline queue. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, API client, household gate, Tailwind pairing): [Next.js and Tailwind](../../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter workout-frontend exec tsc --noEmit
pnpm --filter workout-frontend test
pnpm --filter workout-frontend build
./scripts/verify.sh --frontend   # full gate from the repo root, must exit 0
```

## Specific to this app

- Offline set sync replays `client_idempotency_key`s; never regenerate a key for a queued set.
- i18n keys: `…/locales/{en,de,pl}/workout.json`.

Reference page: [docs/en/reference/apps/workout.md](../../../docs/en/reference/apps/workout.md).
