# AGENTS.md — apps/chat/backend

Go backend: Chat assistant: model blocks, conversations with SSE streaming, MCP tool loop, attachments. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, interfaces, errors, household auth): [Go](../../../docs/en/reference/conventions/go.md).

## Commands

```bash
cd apps/chat/backend && go test -race ./...
gofmt -l .                  # must print nothing
./scripts/verify.sh --go    # full gate from the repo root, must exit 0
```

## Specific to this app

- Migrations: `migrations/`. Schema changes are new numbered migration files, never edits to old ones.
- Never expose API key plaintext; DTOs only carry `has_api_key`. Keys are AES-256-GCM encrypted (`api_key_key_id` enables rotation).
- JWT validation checks issuer and audience (`OIDC_AUDIENCE`), unlike `core/dashboard`.
- `internal/shared/llm` must not import `internal/features/modelblocks`; `conversations` declares its own consumer interfaces.
- The tool loop never forwards the `Done` chunk of an intermediate round. The SSE endpoint needs the long `WriteTimeout`.
- Outbound LLM URLs go through `internal/shared/netguard` (`CHAT_ALLOWED_LLM_HOSTS`).

Reference page: [docs/en/reference/apps/chat.md](../../../docs/en/reference/apps/chat.md).
