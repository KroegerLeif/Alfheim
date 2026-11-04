<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — apps/chat/frontend

Next.js frontend: Chat UI with SSE streaming. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, API client, household gate, Tailwind pairing): [Next.js and Tailwind](../../../docs/en/reference/conventions/nextjs-tailwind.md).

## Commands

```bash
pnpm --filter chat-frontend exec tsc --noEmit
pnpm --filter chat-frontend test
pnpm --filter chat-frontend build
./scripts/verify.sh --frontend   # full gate from the repo root, must exit 0
```

## Specific to this app

- Stream replies with `fetch()` and a `ReadableStream` (`src/lib/api.ts`); the native `EventSource` cannot send an `Authorization` header.
- i18n keys: `…/locales/{en,de,pl}/chat.json`.

Reference page: [docs/en/reference/apps/chat.md](../../../docs/en/reference/apps/chat.md).
