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

## 🔁 Session-Lebenszyklus & Offline-Sync

Eine Session ist `active`, bis sie abgeschlossen (`POST /sessions/{id}/complete`) oder abgebrochen
(`POST /sessions/{id}/abandon`) wird; beide Übergänge sind endgültig. Eine Session aus einem Plan
klont einen Tag (`plan_id` + `plan_day_id`); die Plankarten bieten pro Tag einen Start-Button.

`POST /sessions/{id}/sets/sync` schreibt einen Stapel von Sätzen anhand von `client_idempotency_key`:

- Ein Satz für einen aus dem Plantag geklonten Platz (gleiche `session_exercise_id` und
  `set_order`, noch nicht ausgeführt) füllt diese Zeile; sonst wird eine neue Zeile eingefügt.
  Wird ein Schlüssel erneut gesendet, kommt die gespeicherte Zeile ohne Duplikat zurück.
- Einträge, deren `session_exercise_id` nicht zur Session gehört, werden übersprungen (nicht bestätigt).
- Ein Stapel, der einen Satz zu einer abgeschlossenen oder abgebrochenen Session hinzufügen würde,
  wird mit `409` und `{"detail": {"code": "session_not_active", "message": "..."}}` abgelehnt.
  Bereits gespeicherte Schlüssel werden weiterhin bestätigt. Das MCP-Tool `log_completed_set` gibt
  dieselbe Meldung als `Error:`-Zeichenkette zurück.

Die Browser-Warteschlange (`features/offline_sync`) speichert jeden Satz zuerst in IndexedDB und
synchronisiert im Hintergrund, ein Request pro Session, wobei die Abgleiche seriell laufen. Einträge werden nach fünf
fehlgeschlagenen Versuchen oder sofort bei `session_not_active` verworfen; verworfene Sätze lösen
eine schließbare Warnung am Sync-Badge aus und erscheinen im HUD wieder als offen. Das Abschließen
einer Session wird abgelehnt, solange Sätze in der Warteschlange liegen; beim Abbrechen wird die
Warteschlange zuerst geleert und nicht zustellbare Sätze werden verworfen.

---

## 🔌 MCP-Tools

Bereitgestellt unter `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`), gleich authentifiziert
wie die REST-API. Die Tools nehmen keine `household_id`-/`user_id`-Parameter entgegen — sie lesen
`get_mcp_household_context()`.

| Feature | Tools |
| :--- | :--- |
| `agent_tools` (zusammengesetzt) | `get_todays_plan`, `start_workout_session`, `log_completed_set`, `finish_workout_session` |
| `analytics` | `get_muscle_volume`, `get_streaks`, `get_leaderboard` |
| `equipment` | `list_equipment`, `create_equipment`, `update_equipment`, `delete_equipment` |
| `exercises` | `list_exercises`, `create_exercise`, `update_exercise`, `delete_exercise`, `set_exercise_preference`, `favorite_exercise`, `unfavorite_exercise` |
| `plans` | `list_plans`, `get_plan`, `create_plan`, `delete_plan` |
| `session` | `start_session`, `finish_session`, `log_completed_set` |

`agent_tools` stellt für den Chat-Assistenten eine sitzungsorientierte Teilmenge zusammen (Session aus
dem heutigen Plan starten, einen Satz loggen, die Session beenden), zusätzlich zu den Tools der
einzelnen Features.

---

## 🏠 Haushalts-Scoping

Lokal existiert keine `households`-Tabelle. `home_id` ist die UUID aus `X-Household-ID`, die bei
jeder Route und jedem MCP-Tool von `backend_shared.household.require_household` gegen
`core/household` bestätigt wird. Eine `X-Household-ID`, deren Mitglied der Aufrufer nicht ist, wird
mit `403 household_forbidden` abgelehnt; eine Ressource, die existiert, aber für den Haushalt bzw.
Benutzer des Aufrufers nicht sichtbar ist, liefert `404`.

---

## ⚠️ Bekannte Probleme & offene Folgearbeiten

- **Offline-Sync spielt gegen den beim Abgleich aktiven Haushalt ab, nicht gegen den beim Loggen.**
  Die Warteschlange für das Satz-Logging (`apps/workout/frontend/src/features/offline_sync`)
  speichert die Nutzdaten eines Satzes vor dem Sync in IndexedDB, hält aber nicht fest, welcher
  Haushalt beim Loggen aktiv war. Wechselt der aktive Haushalt, bevor die Warteschlange geleert wird,
  werden die Sätze gegen den *neuen* Haushalt synchronisiert. Haushalte nicht wechseln, solange
  Sätze ausstehen (siehe Sync-Status-Badge). Als Folgearbeit für den Workout-App-Sprint erfasst.
  Siehe [Bekannte Probleme](../../explanation/known-issues.md).
- **`preferred_unit` hat keine Wirkung.** Der Wert wird gespeichert und von der API und den
  MCP-Tools zurückgegeben, die UI loggt und zeigt aber immer Kilogramm (#568).
- **Die Bestenliste zeigt gekürzte Benutzer-IDs**, weil das Backend keine Anzeigenamen liefert (#612).
- **Übungen und Ausrüstung lassen sich in der UI nicht bearbeiten**, obwohl `PATCH` existiert (#613).

---
