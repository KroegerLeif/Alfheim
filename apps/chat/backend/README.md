# chat-backend

Go backend for the Alfheim AI chat feature (`apps/chat`). Provides LLM provider abstraction (Ollama + OpenAI-compatible APIs), an MCP tool-calling bridge against the existing Fach-App MCP servers (Pantry, Chores, Maintenance), runtime "model block" management, and chat history persistence.

Full architecture and rollout plan: see the approved planning document referenced by the current sprint.

## Status

Phase 0-6: backend skeleton, database migrations, JWT auth middleware (issuer + audience validation), `/api/v1/chat/health`, the provider-agnostic `internal/shared/llm` abstraction (Ollama **and** OpenAI-compatible implemented; Anthropic still returns a clear "not implemented yet" error), the `model-blocks` feature (CRUD, AES-256-GCM API key encryption, ownership/sharing rules, on-demand health checks, ENV-based bootstrap seeding), the `conversations` feature (CRUD for conversations/messages, the `GET .../stream` SSE endpoint, and a full multi-round MCP tool-calling loop with a hard round limit), the `mcpservers` registry (seeded from `CHAT_MCP_SERVERS`, admin enable/disable), `internal/shared/mcp` (a Streamable HTTP client for the Fach-Apps' FastMCP servers), and `attachments` / `internal/shared/storage` (S3/RustFS storage client, idempotent bucket check, multipart upload, tenant-isolated object keys, and `image_refs` metadata persistence).

## Structure

Follows [`.ai/stacks/golang.md`](../../../.ai/stacks/golang.md):

```text
cmd/server/main.go                     # entry point & dependency wireup
config/config.go                       # env-based configuration
internal/features/modelblocks/         # model block CRUD, ownership/sharing, health-check trigger, bootstrap
internal/features/conversations/       # conversations/messages CRUD, SSE streaming + persistence, tool-calling loop
internal/features/mcpservers/          # MCP server registry: CHAT_MCP_SERVERS seeding, admin enable/disable
internal/features/attachments/         # image attachment uploads, multipart validation, image_refs metadata
internal/shared/db/                    # pgx pool + golang-migrate runner
internal/shared/logger/                # structured slog logger
internal/shared/middleware/            # JWT auth (issuer + audience), CORS, request logging
internal/shared/crypto/                # AES-256-GCM helpers for model block API key encryption
internal/shared/llm/                   # provider-agnostic LLM interface (Ollama + OpenAI-compatible implemented)
internal/shared/mcp/                   # MCP Streamable HTTP client (initialize handshake, tools/list, tools/call)
internal/shared/storage/               # RustFS/S3 storage client, bucket ensure, tenant-isolated key generation
migrations/                            # golang-migrate SQL migrations
```

### API endpoints

```
GET    /api/v1/chat/health
GET    /api/v1/chat/model-blocks
POST   /api/v1/chat/model-blocks
PATCH  /api/v1/chat/model-blocks/{id}
DELETE /api/v1/chat/model-blocks/{id}
POST   /api/v1/chat/model-blocks/{id}/health-check
GET    /api/v1/chat/conversations
POST   /api/v1/chat/conversations
DELETE /api/v1/chat/conversations/{id}
GET    /api/v1/chat/conversations/{id}/messages
POST   /api/v1/chat/conversations/{id}/messages
GET    /api/v1/chat/conversations/{id}/stream   (SSE: event: delta|tool_call|done|error)
GET    /api/v1/chat/mcp-servers
GET    /api/v1/chat/mcp-servers/diagnostics
PATCH  /api/v1/chat/mcp-servers/{id}            (body: {"enabled": bool})
POST   /api/v1/chat/attachments                 (Multipart Form: file, returns AttachmentResponseDTO)
GET    /api/v1/chat/attachments/{id}            (returns AttachmentResponseDTO with public URL)
```

### ALFI Persona Prompt & i18n
The chat engine embeds the canonical ALFI system prompt specification (`prompts/alfi_system.md`) which establishes ALFI's smart-home domain mastery, witty ALF-inspired personality traits (Melmac memories, cat protection, midnight snacks), and strict automatic language detection and mirroring (German by default, English, Polish).


### MCP tool-calling loop

`conversations.service.StreamAssistantReply`/`runToolLoop`: on each round, the model's tools are the union of `tools/list` results from every enabled MCP server (subject to a model block's `allowed_mcp_apps`, if set); a requested tool call is dispatched via `internal/shared/mcp.Client.CallTool` to the owning server, the result is persisted as a `role: "tool"` message, and another round starts — up to `tool_round_limit` (from the model block's `config_json`, default 8) round-trips to the provider. Every round's `delta`/`tool_call` chunks are forwarded live over SSE; only the final round's completion ends the SSE response.

## Local development

```bash
cp .env.example .env
go run ./cmd/server
```

## Quality gates

```bash
go build ./...
go test -race -cover ./...
golangci-lint run   # if installed
```
