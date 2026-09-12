# ALFI Chat & AI Assistant Application (`apps/chat/`)

> **TL;DR:** Natural language AI assistant, provider-agnostic LLM model blocks, real-time SSE response streaming, and cross-service FastMCP tool calling for Alfheim.

📖 **Full specification** — purpose, architecture, ingress routing, environment
variables and domain model — lives in the documentation portal:
[Reference → ALFI Chat & AI Assistant](../../docs/en/reference/apps/chat.md)

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
