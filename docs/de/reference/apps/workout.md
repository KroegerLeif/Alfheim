---
title: "Trainings-Tracker"
description: "Fitness-Management, Übungs-Katalog, Multi-Day-Split-Trainings-Planer, Live-Session-Logger, Muskel-Volumen-Analytik und FastMCP-KI-Agent-Tools für Alfheim."
---

> **Kurzfassung:** Fitness-Management, Übungs-Katalog, Multi-Day-Split-Trainings-Planer, Live-Session-Logger, Muskel-Volumen-Analytik und FastMCP-KI-Agent-Tools für Alfheim.

Quelle: [`apps/workout/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/workout)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Übungs-Katalog & Anpassung | Taxonomierte Übungs-Datenbank mit pro-Benutzer-Gewichts-Defaults & Ausrüstungs-Filter |
| Trainings-Planung | Multi-Day-Split-Trainings-Pläne mit relativen Gewichts-Offset-Berechnung-Engines |
| Aktive Trainings-Ausführung | Live-Trainings-Logging mit Set-für-Set-Aufzeichnung und Offline-Sync-Unterstützung |
| Fitness-Analytik | Wöchentliche Muskel-Volumen-Aggregation, Streak-Zähler und Haushalt-Leaderboards |

---

## 🏗️ Architektur & Tech Stack

- **Backend:** Python 3.12 / FastAPI-Microservice mit SQLModel (async SQLAlchemy), FastMCP-KI-Tools und OpenTelemetry.
- **Frontend:** Next.js 16 (App Router) Microfrontend, TanStack Query, Tailwind CSS v4 und `@alfheim/shared`.
- **Datenbank:** Gehostet auf `postgres-core` (`alfheim_workout`-Datenbank, Besitzer `workout_user`).

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway & Netzwerk-Matrix
| Service | Interner Port | Host-Mapping / Gateway-Route | Protokoll & Beschreibung |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Gemeinsame Multi-Zone-Netzwerke | PostgreSQL 16 Kern-Datenbankserver |
| `workout-backend` | 8000 | `/workout/api/v1` | FastAPI REST API & FastMCP-Tools |
| `workout-frontend` | 3000 | `alfheim.loegien.localhost/workout` | Next.js Microfrontend |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://workout_user:postgres@postgres-core:5432/alfheim_workout` | Async PostgreSQL-Verbindungszeichenkette |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | Öffentlicher OIDC-Aussteller; die JWKS-URI wird aus seinem Discovery-Dokument aufgelöst |
| `NEXT_PUBLIC_WORKOUT_API_URL` | `http://api.alfheim.loegien.localhost/workout/api/v1` | Browser-API-Gateway-Endpunkt |

---

## 📁 Domain-Features (`src/features/`)

- `equipment`: Ausrüstungs-Verwaltung mit System-, Haushalt- oder Benutzer-Scope.
- `exercises`: Übungs-Katalog, Muskel-Taxonomie, pro-Benutzer-Standard-Gewichte und Favoriten.
- `plans`: Multi-Day-Split-Routinen mit relativem Gewichts-Engine (`absolute`, `default`, `offset`).
- `session`: Live-Trainings-Ausführungs-Logs, geklont von Plan-Zustand für historische Unveränderlichkeit, plus Offline-Sync-Endpunkte.
- `analytics`: Muskel-Volumen, Streak und Haushalt-Leaderboard nur-Lesbare Aggregationen.

---
