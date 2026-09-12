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

- **Backend:** Go 1.25 microservice utilizing Chi router, SSE streaming, AES-256 crypto, and FastMCP client integrations.
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
| `CHAT_MCP_SERVERS` | `pantry=http://pantry-backend:8000/mcp,...` | Comma-separated FastMCP endpoints |
| `NEXT_PUBLIC_CHAT_API_URL` | `http://api.alfheim.loegien.localhost/api/v1/chat` | Browser API gateway endpoint |

---

## 📁 Domain Features (`internal/features/`)

- `conversations`: Conversation sessions, message histories, and SSE streaming handlers.
- `modelblocks`: Provider configuration blocks (Ollama, OpenAI) with AES-256 key encryption.
- `attachments`: File attachment uploads backed by RustFS S3 object storage.
- `mcpservers`: FastMCP server connection definitions and dynamic tool discovery.

---
