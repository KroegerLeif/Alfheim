# chat-frontend

Next.js 16 frontend for the Alfheim AI chat feature (`apps/chat`). Follows [`.ai/blueprints/new_app.md`](../../../.ai/blueprints/new_app.md).

## Status

Phase 3 skeleton: conversation list + a chat streaming view built primarily to manually verify the backend's SSE pipeline end to end. No model-block management UI, sharing UI, or MCP tool-call rendering yet (later phases). Not yet wired into `compose.yaml`/Caddy/`scripts/up.sh`/the dashboard registry.

## Structure

```text
src/proxy.ts                                 # next-intl locale routing (Next.js 16 proxy convention)
src/i18n.ts, src/navigation.ts               # next-intl config, merges @alfheim/shared locales
src/core/authContext.tsx                     # local auth context (Keycloak-backed, see providers.tsx)
src/lib/api.ts                               # typed fetch client, incl. manual SSE stream reader
src/app/[locale]/{layout,providers,page}.tsx # AppShell + Keycloak init + page composition
src/features/conversations/                  # ConversationList, ChatStreamView, React Query hooks, types
```

### Why not `EventSource` for streaming?

The backend's `/stream` endpoint requires a Keycloak bearer token on every request, and the browser's native `EventSource` API cannot send custom headers. `src/lib/api.ts`'s `streamAssistantReply` instead opens the `text/event-stream` response with `fetch()` (which does support an `Authorization` header) and parses the SSE framing manually from the response's `ReadableStream`.

## Local development

```bash
pnpm install
pnpm --filter chat-frontend dev
```

## Quality gates

```bash
pnpm --filter chat-frontend exec tsc --noEmit
pnpm --filter chat-frontend test
pnpm --filter chat-frontend build
```
