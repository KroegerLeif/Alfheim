---
title: "Wartungs-Tracker"
description: "Ausrüstungs-Inventar, wiederkehrende Wartungs-Planung, interaktive Service-Checklisten und historische Reparatur-Logs für Alfheim."
---

> **Kurzfassung:** Ausrüstungs-Inventar, wiederkehrende Wartungs-Planung, interaktive Service-Checklisten und historische Reparatur-Logs für Alfheim.

Quelle: [`apps/maintenance/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/maintenance)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Ausrüstungs-Tracking | Haushalt-Geräte-Inventar (HVAC, Geräte, Fahrzeuge, Filter) |
| Vorbeugende Wartung | Zeit-basierte und Nutzungs-basierte wiederkehrende Wartungs-Zeitpläne |
| Komplexe Reparatur-Schritte | Geführte interaktive Wartungs-Checklisten mit Schritt-Bestätigung |
| Reparatur-Historia & Kosten | Historische Service-Logs, Auftragnehmer-Notizen und Teile-Kosten-Tracking |

---

## 🏗️ Architektur & Tech Stack

- **Backend:** Python 3.12 / FastAPI-Microservice mit SQLModel (async SQLAlchemy) und FastMCP-KI-Tools.
- **Frontend:** Next.js 16 (App Router) Microfrontend, Tailwind CSS v4, Lucide React und `@alfheim/shared`.
- **Datenbank:** Gehostet auf `postgres-core` (`alfheim_maintenance`-Datenbank, Besitzer `maintenance_user`).

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway & Netzwerk-Matrix
| Service | Interner Port | Host-Mapping / Gateway-Route | Protokoll & Beschreibung |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Gemeinsame Multi-Zone-Netzwerke | PostgreSQL 16 Kern-Datenbankserver |
| `maintenance-backend` | 8000 | `/maintenance/api/v1` | FastAPI REST API & FastMCP-Tools |
| `maintenance-frontend` | 3000 | `alfheim.loegien.localhost/maintenance` | Next.js Microfrontend |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://maintenance_user:postgres@postgres-core:5432/alfheim_maintenance` | Async PostgreSQL-Verbindungszeichenkette |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | Generischer OIDC-Backend-Auth-Aussteller-URL |
| `OIDC_AUDIENCE` | `alfheim` | Erwarteter OIDC-JWT-Audience-Claim |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Basis-URL der Mitgliedschafts-API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generiertes Secret)* | Gemeinsames Secret, gesendet als `Authorization: Bearer …` bei Mitgliedschaftsprüfungen. Pflicht; ohne es startet das Backend nicht |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/maintenance` | Browser-API-Basis-URL. Compose leitet sie aus `ALFHEIM_BASE_URL` ab (Build-Argument und Laufzeit-Umgebung) |

### Haushalts-Autorisierung

Alle Routen und MCP-Tools nutzen `require_household` aus `backend_shared`; Haushalte sind UUIDs, die `core/household` gehören. Eine lokale Tabelle `household` gibt es nicht mehr.

- `GET /api/v1/households` ist veraltet und liefert nur den aktuellen Haushalt.
- Mit einer Datenbank mit ganzzahligen Haushalts-IDs verweigert das Backend den Start (`LegacyHouseholdSchemaError`). Den einmaligen Reset beschreibt die [Fehlerbehebung](../../how-to/troubleshooting.md#symptom-5-maintenance-backend-scheitert-mit-legacyhouseholdschemaerror).
- Aufrufe an Budget und Shopping leiten das Bearer-Token des Aufrufers und `X-Household-ID` weiter.

---

## 📁 Domain-Features (`src/features/`)

- `equipment`: Gerät-, Geräte- und Fahrzeug-Registrierung.
- `schedules`: Wartungs-Intervalle (z.B. 6-Monats-Filteraustausch).
- `tasks`: Interaktive Wartungs-Aufgaben-Ausführung und Schritt-Checklisten.
- `history`: Permanente Service-Logs, Auftragnehmer-Notizen und Teile-Kosten-Ledger.

---

## 🔌 MCP-Tools

Bereitgestellt unter `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`, `@mcp_server.tool()`), authentifiziert genauso wie die REST-API. Tools nehmen keine `household_id`/`user_id`-Parameter entgegen – sie lesen `get_mcp_household_context()`.

| Feature | Tools |
| :--- | :--- |
| `devices` | `get_device_status`, `list_devices`, `get_device_detail` |
| `tasks` | `list_overdue_tasks`, `update_task_state_tool` |
| `maintenance` | `get_maintenance_summary_tool` |

`/maintenance/wizard` und `/maintenance/summary` verlangen jetzt ein Haushaltsmitglied und sind auf `X-Household-ID` beschränkt; beide waren früher unauthentifiziert, und die Summary lieferte früher alle Haushalte zurück.

---

## ⚠️ Bekannte Probleme & offene Folgearbeiten

- **`LegacyHouseholdSchemaError` beim Upgrade**: Eine Datenbank, die vor der Umstellung auf UUID-Haushalte angelegt wurde, verweigert `maintenance-backend` den Start. Das ist ein einmaliger, erwarteter Daten-Reset – siehe [Fehlerbehebung](../../how-to/troubleshooting.md#symptom-5-maintenance-backend-scheitert-mit-legacyhouseholdschemaerror) und [Bekannte Probleme](../../explanation/known-issues.md).
- Keine weiteren bekannten offenen Probleme über die allgemeinen Punkte zur Haushalts-Autorisierung in [Bekannte Probleme](../../explanation/known-issues.md) hinaus.

---
