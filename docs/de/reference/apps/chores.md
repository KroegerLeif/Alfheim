---
title: "Haushaltsaufgaben"
description: "Gamifizierte Haushaltszuweisung, Gewohnheitsbildung, Streak-Zähler, Punkte-Tracking und Ausführungs-Audit-Historie für Alfheim."
---

> **Kurzfassung:** Gamifizierte Haushaltszuweisung, Gewohnheitsbildung, Streak-Zähler, Punkte-Tracking und Ausführungs-Audit-Historie für Alfheim.

Quelle: [`apps/chores/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/chores)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Aufgaben-Verantwortung ist mehrdeutig | Zuweisbare tägliche Aufgaben-Instanzen mit klaren Verantwortungsgrenzen |
| Aufgaben stapeln sich bei Vernachlässigung | Nicht-kumulative Reset-Zeitplanern, die verpasste Aufgaben nachts auslaufen lässt |
| Mangelnder Anreiz zu putzen | Punkte-basiertes Belohnungssystem mit Live-Feedback-Schleifen |
| Haushaltskonsistenz ist schwierig | Streak-Zähler zur Verfolgung aufeinanderfolgender Tage vollständiger Aufgaben-Fertigstellung |
| Fehlende Ausführungs-Audit-Historie | Unveränderliche Completion-Histoire, die jede Ausführung aufzeichnet |

---

## 🏗️ Architektur & Tech Stack

- **Backend:** Python 3.12 / FastAPI-Microservice mit SQLModel (async SQLAlchemy), FastMCP-KI-Tools und Background-Reset-Scheduler-Schleife.
- **Frontend:** Next.js 16 (App Router) Microfrontend, TanStack Query, Tailwind CSS v4 und `@alfheim/shared`.
- **Datenbank:** Gehostet auf `postgres-core` (`alfheim_chores`-Datenbank, Besitzer `chores_user`).

### FDD Domain-Features (`src/features/chores/`)
- `templates`: Aufgaben-Vorlagen (Punkte, Anweisungen, Wiederholungsregeln).
- `instances`: Geplante tägliche Aufgaben-Instanzen, die den Ausführungsstatus verfolgen.
- `streaks`: Haushalt-Streak-Engine zur Verfolgung aufeinanderfolgender Tage mit 100%-Fertigstellung.
- `history`: Unveränderliche Completion-Audit-Zeitleiste (Timestamp, Benutzer, vergebene Punkte).

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway & Netzwerk-Matrix
| Service | Interner Port | Host-Mapping / Gateway-Route | Protokoll & Beschreibung |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Gemeinsame Multi-Zone-Netzwerke | PostgreSQL 16 Kern-Datenbankserver |
| `chores-backend` | 8000 | `/api/v1/chores` | FastAPI REST API & FastMCP-Tools |
| `chores-frontend` | 3000 | `alfheim.loegien.localhost/chores` | Next.js Microfrontend |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://chores_user:postgres@postgres-core:5432/alfheim_chores` | Async PostgreSQL-Verbindungszeichenkette |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | Generischer OIDC-Authentifizierungs-Aussteller-URL |
| `OIDC_AUDIENCE` | `alfheim` | Erwartete OIDC-Audience |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Basis-URL der Mitgliedschafts-API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generiertes Secret)* | Gemeinsames Secret, gesendet als `Authorization: Bearer …` bei Mitgliedschaftsprüfungen. Pflicht; ohne es startet das Backend nicht |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/chores` | Browser-API-Basis-URL. Compose leitet sie aus `ALFHEIM_BASE_URL` ab (Build-Argument und Laufzeit-Umgebung) |

---

## 🔑 Domain-Modell & Schlüsselkonzepte

- **Aufgaben-Vorlage** (`chore_templates`): Blueprint-Konfiguration für eine Aufgabe (Name, Anweisungen, Punkte, Wiederholungs-Eigenschaften).
- **Aufgaben-Instanz** (`chore_instances`): Geplante Kopie einer Aufgabe, die einem bestimmten Tag zugewiesen ist.
- **Completion-Historie** (`chore_completion_history`): Unveränderliche Audit-Zeitleiste, die jedes Aufgaben-Fertigstellungs-Event aufzeichnet.
- **Haushalt-Streak** (`household_streaks`): Kumulativer Tages-Zähler, erhöht bei Ausführung geplanter Aufgaben bis Mitternacht.

---

## 🔌 MCP-Tools

Bereitgestellt unter `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`), authentifiziert genauso wie die REST-API. Tools nehmen keine `household_id`/`user_id`-Parameter entgegen – sie lesen `get_mcp_household_context()`.

| Feature | Tools |
| :--- | :--- |
| `chore_management` | `get_daily_chores_overview`, `complete_chore_by_name`, `assign_chore` |

Das clientseitig übergebene Feld `completed_by` wurde beim Abschließen von Aufgaben entfernt; erfasst wird immer der authentifizierte Aufrufer.

---

## 🏠 Haushalts-Scoping

Jede Route hängt von `backend_shared.household.require_household` ab (jede Mitgliedsrolle darf lesen und schreiben). Der tägliche Reset (Streak-Erhöhung oder Rücksetzung auf 0) läuft rückwirkend und heilt sich beim ersten Zugriff auf die Aufgabenliste eines Haushalts an dem Tag selbst, falls das System offline war. Siehe [ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Bekannte Probleme & offene Folgearbeiten

Keine bekannten offenen Probleme über die allgemeinen Punkte zur Haushalts-Autorisierung in [Bekannte Probleme](../../explanation/known-issues.md) hinaus.

---
