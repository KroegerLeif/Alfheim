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
