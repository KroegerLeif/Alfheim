---
title: "ALFI Chat & KI-Assistent"
description: "Natürlichsprachiger KI-Assistent, Provider-agnostische LLM-Modellblöcke, Echtzeit-SSE-Response-Streaming und Service-übergreifende FastMCP-Tool-Aufrufe für Alfheim."
---

> **Kurzfassung:** Natürlichsprachiger KI-Assistent, Provider-agnostische LLM-Modellblöcke, Echtzeit-SSE-Response-Streaming und Service-übergreifende FastMCP-Tool-Aufrufe für Alfheim.

Quelle: [`apps/chat/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/chat)

---

## 🎯 Zweck & Wertversprechen

| Feature | Beschreibung |
| :--- | :--- |
| **Provider-agnostisches LLM-Engine** | Unterstützt lokale Ollama-Modelle und Cloud-OpenAI-kompatible APIs mit Runtime-Modellblock-Konfiguration. |
| **Cross-App FastMCP-Tool-Aufrufe** | Befragt und modifiziert Haushaltzustand (Speisekammer-Bestände, Aufgaben, Wartungsaufgaben) via FastMCP. |
| **Verschlüsselte Modell-Berechtigungen** | Modellblock-API-Schlüssel werden mit AES-256-GCM verschlüsselt. |
| **Multi-Modal-Anhänge** | Unterstützung für Bild-Uploads mit RustFS S3-Speicher für Vision-Modelle. |
| **Echtzeit-Streaming** | Niedrig-Latenz-Response-Streaming via Server-Sent Events (SSE) mit Live-Tool-Ausführungs-Feedback. |

---

## 🏗️ Architektur & Tech Stack

- **Backend:** Go 1.25 Microservice mit Chi-Router, SSE-Streaming, AES-256-Kryptographie und FastMCP-Client-Integrationen.
- **Frontend:** Next.js 16 (App Router) Microfrontend, SSE-Stream-Parser, Tailwind CSS v4 und `@alfheim/shared`.
- **Datenbank:** Gehostet auf `postgres-core` (`alfheim_chat`-Datenbank, Besitzer `chat_user`).

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway & Netzwerk-Matrix
| Service | Interner Port | Host-Mapping / Gateway-Route | Protokoll & Beschreibung |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Gemeinsame Multi-Zone-Netzwerke | PostgreSQL 16 Kern-Datenbankserver |
| `chat-backend` | 8080 | `/api/v1/chat` | Go REST API, SSE & MCP-Bridge |
| `chat-frontend` | 3000 | `alfheim.loegien.localhost/chat` | Next.js Microfrontend |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://chat_user:postgres@postgres-core:5432/alfheim_chat?sslmode=disable` | PostgreSQL-Verbindungszeichenkette |
| `CHAT_ENCRYPTION_KEY` | *(Generierter 32-Byte-Base64-Schlüssel)* | AES-256-GCM-Schlüssel zum Verschlüsseln von LLM-API-Schlüsseln |
| `CHAT_MCP_SERVERS` | `pantry=http://pantry-backend:8000/mcp,...` | Kommagetrennte FastMCP-Endpunkte |
| `NEXT_PUBLIC_CHAT_API_URL` | `http://api.alfheim.loegien.localhost/api/v1/chat` | Browser-API-Gateway-Endpunkt |

---

## 📁 Domain-Features (`internal/features/`)

- `conversations`: Gesprächs-Sessions, Nachrichts-Historien und SSE-Streaming-Handler.
- `modelblocks`: Provider-Konfigurationsblöcke (Ollama, OpenAI) mit AES-256-Schlüssel-Verschlüsselung.
- `attachments`: Datei-Anhang-Uploads mit RustFS S3-Objektspeicher.
- `mcpservers`: FastMCP-Server-Verbindungsdefinitionen und dynamische Tool-Ermittlung.

---
