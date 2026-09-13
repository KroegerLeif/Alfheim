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
| `NEXT_PUBLIC_BUDGET_API_URL` | `http://api.alfheim.loegien.localhost/budget/api/v1` | Browser-API-Gateway-Endpunkt |

---

## 📁 Domain-Features (`src/features/`)

- `accounts`: Bank-, Bargeld- und Kreditkarten-Kontenverwaltung, Balance-Tracking und Kontotypen.
- `pots`: Virtuelle Notgroschen und Ziel-Zuordnungs-Töpfe mit Fortschritts-Tracking.
- `plans`: Envelope-basierte monatliche und event-gesteuerte Budget-Planung.
- `transactions`: Unveränderliches Ledger für Einkommens- und Ausgabentransaktionen mit Quittungs-Anhängen.

---
