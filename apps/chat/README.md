# ALFI Chat Application (`apps/chat/`)

The **Chat App** is the AI assistant and natural language interaction hub for the Alfheim monorepo. It features provider-agnostic LLM integration (Ollama and OpenAI-compatible APIs), real-time Server-Sent Events (SSE) streaming, encrypted API key management via "Model Blocks", S3 attachment storage, and multi-round FastMCP tool calling across household microservices (Pantry, Chores, Maintenance).

---

## 🎯 Purpose & Value Proposition

| Feature | Description |
| :--- | :--- |
| **Provider-Agnostic LLM Engine** | Supports local Ollama models and cloud OpenAI-compatible APIs with runtime Model Block configuration. |
| **Cross-App FastMCP Tool Calling** | Enables the AI assistant to query and modify household state (e.g. check pantry stock, complete chores, check maintenance tasks). |
| **Encrypted Model Credentials** | Model Block API keys are encrypted at rest using AES-256-GCM. |
| **Multi-Modal Attachments** | Image upload support backed by S3/RustFS storage for multi-modal vision models. |
| **Real-Time Streaming** | Low-latency response streaming via Server-Sent Events (SSE) with live tool execution feedback. |

---

## 🏗️ Architecture Overview

```
apps/chat/
├── backend/          # Go backend service (LLM providers, MCP tool loop, AES crypto, SSE streaming)
├── frontend/         # Next.js 16 App Router MFE (Chat UI, SSE parser, attachment uploader)
├── .env.example      # Environment template
└── compose.yml       # Docker orchestration (chat-db, chat-backend, chat-frontend)
```

---

## 🌐 Ingress Routing & Ports

| Service | Internal Port | Host Mapping / Gateway Route | Protocol / Description |
| :--- | :--- | :--- | :--- |
| `chat-db` | 5432 | Internal `app-chat-net` | PostgreSQL 16 database |
| `chat-backend` | 8080 | `/chat/api/v1` or `/api/v1/chat` | Go REST API, SSE & MCP bridge |
| `chat-frontend` | 3000 | `alfheim.loegien.localhost/chat` | Next.js MFE |

---

## 🔑 Key Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (`postgres://postgres:postgres@chat-db:5432/chat_db?sslmode=disable`).
- `KEYCLOAK_BASE_URL` / `KEYCLOAK_REALM`: Keycloak validation parameters (`http://keycloak:8080/auth`, `alfheim`).
- `CHAT_ENCRYPTION_KEY`: Base64-encoded 32-byte key for AES-256-GCM Model Block API key encryption.
- `CHAT_MCP_SERVERS`: Comma-separated FastMCP endpoints (`pantry=http://pantry-backend:8000/mcp,chores=http://chores-backend:8000/mcp,maintenance=http://maintenance-backend:8000/mcp`).
- `S3_ENDPOINT` / `S3_PUBLIC_URL`: RustFS object storage endpoint and public gateway URL.

---

## 🚀 Local Run & Test Commands

### Run via Docker Compose
```bash
docker compose up -d
```

### Backend Development & Testing
```bash
cd apps/chat/backend
cp .env.example .env
go run ./cmd/server
go test -race -cover ./...
```

### Frontend Development & Testing
```bash
cd apps/chat/frontend
pnpm install
pnpm dev
pnpm test
```
