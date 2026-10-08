# ALFI Chat & AI Assistant Application (`apps/chat/`)

> **TL;DR:** Natural language AI assistant, provider-agnostic LLM model blocks, real-time SSE response streaming, and cross-service FastMCP tool calling for Alfheim.

📖 **Full specification** — purpose, architecture, ingress routing, environment
variables and domain model — lives in the documentation portal:
[Reference → ALFI Chat & AI Assistant](../../docs/en/reference/apps/chat.md)

Behaviour worth knowing before changing the code (details in the reference page):

- MCP sessions are pooled per endpoint, household and user (`internal/shared/mcp/pool.go`), never shared between callers.
- Tool results are stored as `tool` messages tagged with `{"tool_call_id", "tool_name", "is_error"}`; the frontend shows tool calls as collapsed entries and masks credentials.
- Closing the SSE connection cancels the reply without storing it, which is what the UI's Stop and Retry actions rely on.
- An open conversation always shows its own model; the sidebar picker only applies to the next new conversation.

---

## 🚀 Local Development & Commands

### 1. Run via Docker Compose
```bash
docker compose up -d
```

### 2. Run Backend Locally
```bash
cd backend
go run ./cmd/server
```

### 3. Run Frontend Locally
```bash
cd frontend
pnpm install
pnpm dev
```

---

## 🧪 Testing & Quality Gates

```bash
# Execute Go Backend Tests with Race Detector
cd backend && go test -race -cover ./...

# Execute Frontend Typecheck & Vitest Suite
cd frontend && pnpm check-types && pnpm test
```
