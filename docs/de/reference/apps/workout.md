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
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Basis-URL der Mitgliedschafts-API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generiertes Secret)* | Gemeinsames Secret, gesendet als `Authorization: Bearer …` bei Mitgliedschaftsprüfungen. Pflicht; ohne es startet das Backend nicht |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/workout` | Browser-API-Basis-URL. Compose leitet sie aus `ALFHEIM_BASE_URL` ab (Build-Argument und Laufzeit-Umgebung) |

---

## 📁 Domain-Features (`src/features/`)

- `equipment`: Ausrüstungs-Verwaltung mit System-, Haushalt- oder Benutzer-Scope.
- `exercises`: Übungs-Katalog, Muskel-Taxonomie, pro-Benutzer-Standard-Gewichte und Favoriten.
- `plans`: Multi-Day-Split-Routinen mit relativem Gewichts-Engine (`absolute`, `default`, `offset`).
- `session`: Live-Trainings-Ausführungs-Logs, geklont von Plan-Zustand für historische Unveränderlichkeit, plus Offline-Sync-Endpunkte.
- `analytics`: Muskel-Volumen, Streak und Haushalt-Leaderboard nur-Lesbare Aggregationen.

---

---

## 🔁 Session-Lebenszyklus & Offline-Sync

Eine Session ist `active`, bis sie abgeschlossen (`POST /sessions/{id}/complete`) oder abgebrochen
(`POST /sessions/{id}/abandon`) wird; beide Übergänge sind endgültig. Eine Session aus einem Plan
klont einen Tag (`plan_id` + `plan_day_id`); die Plankarten bieten pro Tag einen Start-Button.

`POST /sessions/{id}/sets/sync` schreibt einen Stapel von Sätzen anhand von `client_idempotency_key`:

- Ein Satz für einen aus dem Plantag geklonten Platz (gleiche `session_exercise_id` und
  `set_order`, noch nicht ausgeführt) füllt diese Zeile; sonst wird eine neue Zeile eingefügt.
  Wird ein Schlüssel erneut gesendet, kommt die gespeicherte Zeile ohne Duplikat zurück.
- Einträge, deren `session_exercise_id` nicht zur Session gehört, werden übersprungen.
- Ein Stapel, der einen Satz zu einer abgeschlossenen oder abgebrochenen Session hinzufügen würde,
  wird mit `409` und `{"detail": {"code": "session_not_active", "message": "..."}}` abgelehnt.
  Bereits gespeicherte Schlüssel werden weiterhin bestätigt.

Die Browser-Warteschlange (`features/offline_sync`) speichert jeden Satz zuerst in IndexedDB und
synchronisiert im Hintergrund, serialisiert und pro Session ein Request. Einträge werden nach fünf
fehlgeschlagenen Versuchen oder sofort bei `session_not_active` verworfen; verworfene Sätze lösen
eine schließbare Warnung am Sync-Badge aus und erscheinen im HUD wieder als offen. Das Abschließen
einer Session wird abgelehnt, solange Sätze in der Warteschlange liegen; beim Abbrechen wird die
Warteschlange zuerst geleert und nicht zustellbare Sätze werden verworfen.
