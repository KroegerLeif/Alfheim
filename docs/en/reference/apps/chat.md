---
title: "ALFI Chat & AI Assistant"
description: "Natural language AI assistant, provider-agnostic LLM model blocks, real-time SSE response streaming, and cross-service FastMCP tool calling for Alfheim."
---

> **TL;DR:** Natural language AI assistant, provider-agnostic LLM model blocks, real-time SSE response streaming, and cross-service FastMCP tool calling for Alfheim.

Source: [`apps/chat/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/chat)

---

## 🎯 Purpose & Value Proposition

| Feature | Description |
| :--- | :--- |
| **Provider-Agnostic LLM Engine** | Supports local Ollama models and cloud OpenAI-compatible APIs with runtime Model Block configuration. |
| **Cross-App FastMCP Tool Calling** | Queries and modifies household state (pantry stock, chores, maintenance tasks) via FastMCP. |
| **Encrypted Model Credentials** | Model Block API keys are encrypted at rest using AES-256-GCM. |
| **Multi-Modal Attachments** | Image upload support backed by RustFS S3 storage for vision models. |
| **Real-Time Streaming** | Low-latency response streaming via Server-Sent Events (SSE) with live tool execution feedback. |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Go 1.27 microservice utilizing Chi router, SSE streaming, AES-256 crypto, and FastMCP client integrations.
- **Frontend:** Next.js 16 (App Router) microfrontend, SSE stream parser, Tailwind CSS v4, and `@alfheim/shared`.
- **Database:** Hosted on `postgres-core` (`alfheim_chat` database, owned by `chat_user`).

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Protocol & Description |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Shared multi-zone networks | PostgreSQL 16 Core Database Server |
| `chat-backend` | 8080 | `/api/v1/chat` | Go REST API, SSE & MCP Bridge |
| `chat-frontend` | 3000 | `alfheim.loegien.localhost/chat` | Next.js Microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://chat_user:postgres@postgres-core:5432/alfheim_chat?sslmode=disable` | PostgreSQL connection string |
| `CHAT_ENCRYPTION_KEY` | *(Generated 32-byte base64 key)* | AES-256-GCM key for encrypting LLM API keys |
| `CHAT_ATTACHMENT_URL_SECRET` | *(generated secret, at least 32 bytes)* | HMAC key signing attachment download URLs. Required in production (compose refuses to start without it); the installer generates it and backfills it on update. Without it outside production, a random key is used per process |
| `CHAT_ATTACHMENT_URL_TTL_MINUTES` | `15` | Lifetime of a signed attachment download URL |
| `CHAT_MCP_SERVERS` | `pantry=http://pantry-backend:8000/mcp,...` | Comma-separated FastMCP endpoints |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Base URL of the household membership API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generated secret)* | Shared secret sent as `Authorization: Bearer …` on membership checks. Required; the backend refuses to start without it |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/chat` | Browser API base URL. Compose derives it from `ALFHEIM_BASE_URL` (build argument and runtime env) |

### Household Authorization

Every chat API route runs `middleware.RequireHousehold` after JWT validation: `X-Household-ID` is required and confirmed with `core/household` ([ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md)). Errors follow the shared contract (`400 household_required` / `household_invalid`, `403 household_forbidden`, `503 household_service_unavailable`).

- A conversation belongs to one owner in one household. The list shows only the caller's conversations in the active household; other conversations return `403`.
- Shared model blocks are keyed by the verified household.
- MCP calls carry the caller's bearer token and `X-Household-ID`, set per request.
- `PATCH /api/v1/chat/mcp-servers/{id}` (toggling a server in the installation-wide registry) needs the `OWNER` or `ADMIN` role; otherwise `403` with `{"detail": {"code": "household_role_forbidden", "message"}}`. Without household context it answers `400 household_required`.

---

## 📁 Domain Features (`internal/features/`)

- `conversations`: Conversation sessions, message histories, and SSE streaming handlers.
  - A conversation keeps the model block it was created with. The sidebar picker only sets the model of the next new conversation; the header of an open conversation shows that conversation's own model ("Model unavailable" when the block was deleted or is no longer visible).
  - `GET /conversations/{id}/stream` emits `delta`, `tool_call` (`{"ID", "ToolName", "Arguments"}`), `done` and `error` events. Closing the connection cancels the model request and any running tool call; nothing is stored for the cancelled reply, so the pending user message can be streamed again (the UI's Stop and Retry actions).
  - Every tool call outcome is stored as a `tool` message whose `tool_calls` holds `{"tool_call_id", "tool_name", "is_error"}`; transport failures are stored with a generic text, never the internal endpoint URL. History replay sends the id as `tool_call_id`. The UI shows tool calls as collapsed entries (name and status; arguments and result on expand, credential-like argument keys, bearer tokens and JWTs masked).
- `modelblocks`: Provider configuration blocks (Ollama, OpenAI) with AES-256 key encryption. Only `ollama` and `openai_compatible` can run; the UI offers only these two (#632).
- `attachments`: File attachment uploads backed by RustFS S3 object storage. Each upload records its uploader (`image_refs.owner_user_id`); reading an attachment by ID returns `404` to anyone else, and a message can only link unlinked attachments owned by the conversation owner (otherwise `400`). Attachments uploaded before this ownership column existed have no owner and can no longer be read by ID or linked.
  - Uploads (JPEG, PNG or WebP, up to 10 MB, checked by content) are normalised before they are stored: the EXIF orientation is applied, all metadata including GPS is dropped, and the longest edge is capped at 2048 px. Opaque images are stored as JPEG, images with transparency as PNG. Images above 40 megapixels are refused with `400`. The pipeline is pure Go, so the binary stays CGO-free.
  - The bucket stays private and the API never returns storage URLs. Every `url` (upload response, `GET /attachments/{id}`, message `attachments`) is `GET /api/v1/chat/attachments/{id}/content?token=…` on the gateway (`ALFHEIM_BASE_URL`), minted fresh on each read. The token is an HMAC-SHA256 over attachment, user and household with an expiry (15 minutes by default), so `<img>` can load it without a bearer header. The endpoint also accepts a normal bearer token with `X-Household-ID`.
  - A token request re-checks that the user is still a member of the household and that the uploader owns the attachment and the object lives in the household's storage namespace. Invalid or expired token: `401`; user no longer a member: `403`; other user's attachment or missing object: `404`; membership service unreachable: `503`. Responses carry the stored image type, `Content-Disposition: inline` for images (`attachment` otherwise), `X-Content-Type-Options: nosniff`, a sandboxing `Content-Security-Policy` and `Cache-Control: private`. The UI refetches the conversation once when an image fails to load and then shows an "Attachment unavailable" notice.
- `mcpservers`: FastMCP server connection definitions and dynamic tool discovery.

---

## 🔌 MCP Tools

Chat exposes no MCP tools of its own — it is the MCP **client** for every other app's FastMCP
server (`internal/shared/mcp`, a from-scratch Streamable HTTP client). `CHAT_MCP_SERVERS` seeds
the registry (`app_slug` → `internal_url`, e.g. `http://pantry-backend:8000/mcp`); re-seeding on
startup upserts the URL but never resets an admin's enabled/disabled toggle. Every call forwards
the caller's bearer token and `X-Household-ID` so the target app authorizes it the same way it
authorizes a REST request. A 404 from an MCP endpoint is reported to the caller as a configuration
error (mismatched `CHAT_MCP_SERVERS` path) rather than treated as reachable.

MCP sessions are kept per endpoint, household and user: `ClientPool` resolves the client for
every call from that call's caller credentials, so a session id and the cached tool list are
never shared between users or households. Idle sessions are dropped after 15 minutes. The MCP
servers themselves do not yet bind a session id to the caller that opened it (#633).

---

## 🗄️ Data Model Invariants

### Table `model_blocks`

| Column | Notes |
| --- | --- |
| `id` | UUID, PK |
| `owner_user_id` | Zitadel `sub` |
| `household_id` | Nullable; `NULL` means private |
| `visibility` | `private` or `shared`. Shared blocks are usable by household members but editable only by the owner |
| `provider_type` | `ollama` or `openai_compatible` (`anthropic` is planned) |
| `base_url`, `model_identifier` | |
| `api_key_encrypted` | AES-256-GCM ciphertext, BYTEA, nullable |
| `api_key_key_id` | Default `v1`; enables key rotation |
| `health_status` | `ok`, `unreachable`, `auth_invalid` or `unknown`; with `health_checked_at` and `health_detail` |
| `is_bootstrap` | Set on the idempotent, first-startup-only upsert seeded from `CHAT_BOOTSTRAP_*` |

### Table `mcp_server_registry`

Seeded and re-synced on every startup from `CHAT_MCP_SERVERS` (`internal/features/mcpservers`) with `app_slug`, `internal_url` (for example `http://pantry-backend:8000/mcp`) and `enabled`. Re-seeding upserts `internal_url` by `app_slug` but never resets an admin's `enabled` toggle. `internal/shared/mcp` is a from-scratch Streamable HTTP **client** (initialize handshake, session id, JSON or SSE bodies) for the FastMCP servers of the other apps; chat adds no MCP server code.

### Tables `conversations`, `messages`, `image_refs`

- `conversations.source_app` and `source_context` record the host app and its context when a conversation starts in the embedded chat widget; both are `NULL` for the full chat app.
- `messages.role` is one of `user`, `assistant`, `system`, `tool`.
- `image_refs.storage_key` points at an object in RustFS.

### Invariants

1. The API key plaintext never leaves the backend; response DTOs expose only `has_api_key: bool`.
2. Shared `model_blocks` are usable by household members; only `owner_user_id` may edit, delete or health-check them (`ModelBlock.CanModify` in `internal/features/modelblocks/entity.go`).
3. Bootstrap blocks (`is_bootstrap = true`, `owner_user_id = "system"`) are the exception: any authenticated user may see and modify them. The one-time seed is tracked in the separate `bootstrap_state` table, so deleting or editing the seeded block never makes it reappear after a restart.
4. `internal/shared/llm.Provider` is built from primitive parameters (provider type, base URL, model, API key), never from a `modelblocks.ModelBlock`, so `internal/shared/llm` does not depend on `internal/features/modelblocks`.
5. JWT validation in `internal/shared/middleware/auth.go` checks both issuer and audience (`OIDC_AUDIENCE`); this deliberately differs from the issuer-only check in `core/dashboard/backend`.
6. Conversations are always personal (`owner_user_id` only). A household member with access to a shared model block gets their own separate conversation.
7. `GET /api/v1/chat/conversations/{id}/stream` requires the last message to be an unanswered `user` message (`ErrNoPendingUserMessage` otherwise). The finished assistant reply is persisted by `AppendMessageAndTouchConversation` (one transaction: insert the message and bump `conversations.updated_at`) with a fresh 5 s `context.Background()` timeout, independent of the HTTP request, so a client disconnecting at the end of the stream cannot lose the reply. A stream that ends in an `Err` chunk persists nothing.
8. `internal/features/conversations` depends on `internal/shared/llm` and defines its own narrow `ModelBlockResolver` interface (satisfied structurally by `modelblocks.Service`) instead of importing `internal/features/modelblocks`. Go interfaces are defined at the consumer.
9. The HTTP server sets a 10-minute `WriteTimeout` (`cmd/server/main.go`) because the SSE endpoint holds the response open while the model replies; `ReadTimeout` stays at 15 s.
10. The frontend cannot use the native `EventSource`, which cannot send an `Authorization` header. `streamAssistantReply` in `apps/chat/frontend/src/lib/api.ts` reads the `text/event-stream` body through `fetch()` and a `ReadableStream`.
11. The tool-calling loop (`conversations.service.runToolLoop`) forwards every provider chunk live (`delta`, `tool_call`) but never forwards the `Done` chunk of an intermediate round. Only the final round (no more tool calls, or the round limit reached) emits the terminal `Done` or `Err` chunk that ends the SSE response.
12. `tool_round_limit` (default 8) and `allowed_mcp_apps` live in a model block's `config_json` and are parsed into `llm.ProviderPolicy` by `modelblocks.parseProviderPolicy`. The type lives in `internal/shared/llm` so both features share it without importing each other.
13. `conversations` never imports `mcpservers` or the concrete `*mcp.ClientPool` in its exported `Service` / `NewService` signature. It defines the consumer interfaces `MCPServerLister` and `MCPClientPool` (`toolbridge.go`). `mcp.ClientPool.Get` returns the `mcp.ToolCaller` interface so tests can substitute a fake.
14. `OpenAICompatibleProvider` (`internal/shared/llm/openai_compatible_provider.go`) expects `model_blocks.base_url` **without** a trailing `/v1` (for example `https://api.openai.com`) and appends `/v1/chat/completions` and `/v1/models` itself. Streamed tool-call arguments arrive as fragmented JSON string deltas keyed by index; they are buffered per index and emitted as `StreamChunk{ToolCall: ...}` once `finish_reason == "tool_calls"` or the connection closes without a `data: [DONE]` frame, which some providers omit.

---

## ⚠️ Known Issues & Open Follow-Ups

- **Legacy conversations after the UUID migration**: migration `000004_household_ids_uuid` casts
  `conversations.household_id` and `model_blocks.household_id` to UUID; non-UUID values become
  `NULL`. Conversations from before household checks existed are no longer reachable, and shared
  model blocks without a household became private. See
  [Known Issues](../../explanation/known-issues.md).
- No other known open issues beyond the general household-authorization items in
  [Known Issues](../../explanation/known-issues.md).

---
