---
title: "Haushaltskasse & Budget"
description: "Multi-Tenant-Haushaltsverwaltung, Kontosaldo-Tracking, Notgroschen-Töpfe, monatliche Envelope-Pläne und Transaktions-Ledger mit Quittungs-Anhängen."
---

> **Kurzfassung:** Multi-Tenant-Haushaltsverwaltung, Kontosaldo-Tracking, Notgroschen-Töpfe, monatliche Envelope-Pläne und Transaktions-Ledger mit Quittungs-Anhängen.

Quelle: [`apps/budget/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/budget)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Fragmentierte Haushaltskonten | Zentralisiertes Balance-Tracking (Giro, Sparen, Bargeld, Kreditkarte) |
| Sparziel-Zuordnung | Virtuelle Notgroschen-Töpfe mit Prozent-/fixen Ziel-Tracking |
| Unerwartete Ausgaben | Envelope-Stil monatliche & event-gesteuerte Budget-Pläne |
| Ausgaben-Audit-Trail | Kategorisiertes Transaktions-Ledger mit RustFS S3 Quittungs-Bild-Anhängen |

---

## 🏗️ Architektur & Tech Stack

- **Backend:** Python 3.12 / FastAPI-Microservice mit SQLModel (async SQLAlchemy), RustFS S3-Integration und OpenTelemetry.
- **Frontend:** Next.js 16 (App Router) Microfrontend, Tailwind CSS v4, Lucide React und `@alfheim/shared`.
- **Datenbank:** Gehostet auf `postgres-core` (`alfheim_budget`-Datenbank, Besitzer `budget_user`).

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway & Netzwerk-Matrix
| Service | Interner Port | Host-Mapping / Gateway-Route | Protokoll & Beschreibung |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Gemeinsame Multi-Zone-Netzwerke | PostgreSQL 16 Kern-Datenbankserver |
| `budget-backend` | 8000 | `/budget/api/v1` | FastAPI REST API & Telemetrie |
| `budget-frontend` | 3000 | `alfheim.loegien.localhost/budget` | Next.js Microfrontend |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://budget_user:postgres@postgres-core:5432/alfheim_budget` | Async PostgreSQL-Verbindungszeichenkette |
| `S3_ENDPOINT_URL` | `http://rustfs:9000` | S3-kompatibler Objektspeicher-Endpunkt |
| `S3_BUCKET_NAME` | `budget-receipts` | S3-Bucket für Quittungs-Uploads |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Basis-URL der Mitgliedschafts-API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generiertes Secret)* | Gemeinsames Secret, gesendet als `Authorization: Bearer …` bei Mitgliedschaftsprüfungen. Pflicht; ohne es startet das Backend nicht |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/budget` | Browser-API-Basis-URL. Compose leitet sie aus `ALFHEIM_BASE_URL` ab (Build-Argument und Laufzeit-Umgebung) |

---

## 📁 Domain-Features (`src/features/`)

- `accounts`: Bank-, Bargeld- und Kreditkarten-Kontenverwaltung, Balance-Tracking und Kontotypen.
- `pots`: Virtuelle Notgroschen und Ziel-Zuordnungs-Töpfe mit Fortschritts-Tracking.
- `plans`: Envelope-basierte monatliche und event-gesteuerte Budget-Planung.
- `transactions`: Unveränderliches Ledger für Einkommens- und Ausgabentransaktionen mit Quittungs-Anhängen.

---

## 🔌 MCP-Tools

Bereitgestellt unter `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`), gleich authentifiziert
wie die REST-API. Die Tools nehmen keinen `household_id`-Parameter entgegen: sie lesen
`get_mcp_household_context()`. Die Tools liegen in `src/mcp/` (`server.py` erzeugt die
FastMCP-Instanz und registriert `get_budget_status`; `tools.py` registriert die übrigen).
`discover_and_import_mcp_tools()` importiert außerdem jede `mcp_tools.py` unter `src/features/`,
aber bisher liefert kein Budget-Feature eine solche Datei.

| Tool | Parameter | Funktion |
| :--- | :--- | :--- |
| `get_budget_status` | keine | Liveness-Probe. Gibt eine feste Meldung zurück und liest keine Budget-Daten |
| `get_pot_balances` | keine | Listet die aktiven Töpfe des Haushalts mit Priorität, aktuellem Betrag, Ziel und Überlauf-Ziel |
| `suggest_budget_allocation` | `income` | Führt die Prioritäts-Kaskade über die Töpfe aus und meldet die vorgeschlagene Verteilung je Topf, den nicht zugewiesenen Puffer und den Investment-Überlauf. Ein Probelauf: nichts wird gespeichert |
| `analyze_spending_gap` | `month` (`YYYY-MM`) | Vergleicht die Summe der aktiven Pläne mit den in diesem Monat gebuchten Ausgaben und meldet die Lücke, über oder unter Budget, und die Zahl der Transaktionen |
| `calculate_sinking_gap` | `pot_id` | Meldet Fehlbetrag, verbleibende Monate, Soll- und Ist-Monatsrate sowie die monatliche Lücke für einen Sinking-Fund-Topf |

Alle fünf Tools lesen nur Budget-Daten; keines legt Konten, Töpfe, Pläne oder Transaktionen an oder
ändert sie. Ein Fehler in einem Tool wird als `Error …`-Zeichenkette zurückgegeben statt als
Exception.

---

## 🏠 Haushalts-Scoping

Jede Route hängt von `backend_shared.household.require_household` ab (jede Mitgliedsrolle darf lesen und schreiben). Budgets eigene, geforkte claim-basierte Auth (`src/core/auth.py`) wurde zugunsten dieser gemeinsamen Abhängigkeit entfernt; Maintenance und Shopping leiten beim Aufruf der Budget-API das Bearer-Token des Aufrufers und `X-Household-ID` weiter. Siehe [ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Bekannte Probleme & offene Folgearbeiten

Keine bekannten offenen Probleme über die allgemeinen Punkte zur Haushalts-Autorisierung in [Bekannte Probleme](../../explanation/known-issues.md) hinaus.

---
