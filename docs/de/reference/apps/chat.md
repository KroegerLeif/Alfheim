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
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Basis-URL der Mitgliedschafts-API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generiertes Secret)* | Gemeinsames Secret, gesendet als `Authorization: Bearer …` bei Mitgliedschaftsprüfungen. Pflicht; ohne es startet das Backend nicht |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/chat` | Browser-API-Basis-URL. Compose leitet sie aus `ALFHEIM_BASE_URL` ab (Build-Argument und Laufzeit-Umgebung) |

### Haushalts-Autorisierung

Jede Chat-API-Route führt nach der JWT-Prüfung `middleware.RequireHousehold` aus: `X-Household-ID` ist Pflicht und wird bei `core/household` bestätigt ([ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md)). Fehler folgen dem gemeinsamen Vertrag (`400 household_required` / `household_invalid`, `403 household_forbidden`, `503 household_service_unavailable`).

- Eine Unterhaltung gehört einem Eigentümer in einem Haushalt. Die Liste zeigt nur die Unterhaltungen des Aufrufers im aktiven Haushalt; andere Unterhaltungen liefern `403`.
- Geteilte Model-Blocks sind an den bestätigten Haushalt gebunden.
- MCP-Aufrufe tragen das Bearer-Token des Aufrufers und `X-Household-ID`, pro Anfrage gesetzt.
- `PATCH /api/v1/chat/mcp-servers/{id}` (Umschalten eines Servers in der installationsweiten Registry) verlangt die Rolle `OWNER` oder `ADMIN`; sonst `403 household_role_forbidden`.

---

## 📁 Domain-Features (`internal/features/`)

- `conversations`: Gesprächs-Sessions, Nachrichts-Historien und SSE-Streaming-Handler.
- `modelblocks`: Provider-Konfigurationsblöcke (Ollama, OpenAI) mit AES-256-Schlüssel-Verschlüsselung.
- `attachments`: Datei-Anhang-Uploads mit RustFS S3-Objektspeicher. Jeder Upload speichert den Hochladenden (`image_refs.owner_user_id`); allen anderen liefert das Lesen eines Anhangs per ID `404`, und eine Nachricht kann nur noch nicht verknüpfte Anhänge des Gesprächsinhabers verknüpfen (sonst `400`). Anhänge aus der Zeit vor dieser Spalte haben keinen Inhaber und lassen sich weder per ID lesen noch verknüpfen.
- `mcpservers`: FastMCP-Server-Verbindungsdefinitionen und dynamische Tool-Ermittlung.

---
