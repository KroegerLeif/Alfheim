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

### FDD Domain-Features (`src/features/chore_management/`)

Das Backend hat ein einziges Feature-Verzeichnis, `chore_management`, das die gesamte Domäne besitzt:

- `models.py`, `schemas.py`, `router.py`, `mcp_tools.py` und `exceptions.py`: Tabellen, DTOs, die REST-Routen unter `/api/v1/chores`, die MCP-Tools und die Domänenfehler.
- `service.py`: eine dünne `ChoreService`-Fassade, die an die Sub-Services in `services/` delegiert.
- `services/template_service.py`: CRUD für Aufgaben-Vorlagen mit pro Haushalt eindeutigem Namen.
- `services/instance_service.py`: tägliche Instanz-Erzeugung und Reset, Zuweisen, Übernehmen, Abschließen, Aufgaben-Zeitleiste und die Integrations-Zusammenfassung.
- `services/streak_service.py`: Get-or-Create der Streak-Zeile des Haushalts.

Es gibt keine Wiederholungs- oder Zeitplan-Konfiguration. Jede Vorlage erzeugt genau eine Instanz
pro Tag (siehe [Tägliche Planung & Reset](#-tägliche-planung--reset)).

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

- **Aufgaben-Vorlage** (`chore_templates`): Der Blueprint einer Aufgabe: `name` (pro Haushalt eindeutig), optionale `description`, `points` (Standard 10) und `is_non_cumulative` (Standard `true`). Sie hat kein Wiederholungsfeld.
- **Aufgaben-Instanz** (`chore_instances`): Eine Vorlage an einem `due_date`, mit einem `status` von `pending`, `completed` oder `missed`, einem optionalen `assigned_to` und den Abschluss-Feldern. Pro Vorlage und Tag existiert höchstens eine Instanz.
- **Completion-Historie** (`chore_completion_history`): Unveränderliche Audit-Zeitleiste, die jeden Abschluss aufzeichnet (Benutzer, Anzeigename, vergebene Punkte).
- **Haushalt-Streak** (`household_streaks`): Eine Zeile pro Haushalt mit `current_streak`, `longest_streak` und `last_completed_date`.

---

## 🔁 Tägliche Planung & Reset

Aufgaben wiederholen sich immer täglich; der einzige Schalter pro Vorlage ist `is_non_cumulative`.

- **Erzeugung:** `ensure_household_reset` legt für jede Vorlage ohne Instanz für den Tag eine `pending`-Instanz an. Es läuft beim ersten Lesen der Aufgaben eines Haushalts an diesem Tag (`GET /api/v1/chores/today`, `GET /api/v1/chores/integrations/summary`, die MCP-Tools) und erneut durch den nächtlichen Scheduler in `src/main.py`, der um 00:00:05 Serverzeit für jeden Haushalt mit Vorlagen oder Streak feuert. Es ist idempotent, sodass auch eine später am Tag angelegte Vorlage ihre Instanz erhält.
- **Nicht-kumulative Vorlagen (Standard):** Eine unerledigte Instanz des Vortags wird als `missed` markiert, eine frische `pending`-Instanz erzeugt und der Haushalt-Streak auf 0 zurückgesetzt.
- **Kumulative Vorlagen:** Eine unerledigte Instanz wird nicht als verpasst markiert. Sie rollt weiter (ihr `due_date` wird heute) und stapelt sich, bis sie jemand abschließt. Für sich allein setzt sie den Streak nicht zurück.
- **Streak:** Der Streak wächst um eins, wenn alle Instanzen eines Tages abgeschlossen sind, entweder beim Abschluss der letzten oder beim Reset des Folgetags. Eine Lücke von mehr als einem Tag ohne Instanzen setzt ihn auf 0 zurück. Übersprungene Tage werden nicht nachgefüllt.
- **Zuweisen und Übernehmen:** Jedes Mitglied kann eine nicht zugewiesene Aufgabe für sich übernehmen oder die eigene Übernahme aufheben. Das Zuweisen an ein anderes Mitglied erfordert die Haushaltsrolle `OWNER` oder `ADMIN` und ein Mitglied als Ziel. Eine abgeschlossene oder verpasste Instanz kann nicht neu zugewiesen werden.
- **Abschließen:** Als Benutzer wird immer der authentifizierte Aufrufer gespeichert; nur der Anzeigename darf vom Client mitgegeben werden.

---

## 🔌 MCP-Tools

Bereitgestellt unter `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`), authentifiziert genauso wie die REST-API. Tools nehmen keine `household_id`/`user_id`-Parameter entgegen – sie lesen `get_mcp_household_context()`.

| Feature | Tools |
| :--- | :--- |
| `chore_management` | `get_daily_chores_overview`, `complete_chore_by_name`, `assign_chore` |

Das clientseitig übergebene Feld `completed_by` wurde beim Abschließen von Aufgaben entfernt; erfasst wird immer der authentifizierte Aufrufer.

---

## 🔗 Dashboard-Integrationen

Das Dashboard zeigt zwei Karten, die andere Apps aus dem Browser lesen, mit Bearer-Token des Aufrufers und `X-Household-ID`: offene Einkaufsartikel (`GET /shopping/api/v1/shopping-lists`) und fällige Wartungsschritte (`GET /maintenance/api/v1/maintenance/summary`). Beide laufen über den eigenen Ingress-Präfix der jeweiligen App: Die einfachen `/api/v1/<app>*`-Regeln in Caddy entfernen den Präfix und lassen einen Rest übrig, den kein Backend bedient (`/api/v1/shopping-lists` wird zu `/api/v1-lists`). Schlägt die Anfrage einer Karte fehl, zeigt sie „NICHT VERFÜGBAR“ statt „VERBUNDEN“. Schlägt das Abschließen, Übernehmen oder Löschen einer Aufgabe fehl, wird die Meldung des Servers angezeigt.

---

## 🏠 Haushalts-Scoping

Jede Route hängt von `backend_shared.household.require_household` ab (jede Mitgliedsrolle darf lesen und schreiben). Der tägliche Reset (Streak-Erhöhung oder Rücksetzung auf 0) läuft rückwirkend und heilt sich beim ersten Zugriff auf die Aufgabenliste eines Haushalts an dem Tag selbst, falls das System offline war. Siehe [ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Bekannte Probleme & offene Folgearbeiten

Keine bekannten offenen Probleme über die allgemeinen Punkte zur Haushalts-Autorisierung in [Bekannte Probleme](../../explanation/known-issues.md) hinaus.

- **Zuweisungen werden nach Mitgliedschaftsänderungen nicht abgeglichen (#581).** Eine Aufgabe behält ihre zugewiesene Person, auch wenn diese den Haushalt verlässt. Rollenwechsel spielen keine Rolle: Übernehmen und Abschließen stehen jeder Mitgliedsrolle offen. Für den Abgleich muss die gespeicherte (abgeleitete) Benutzer-ID gegen die Mitgliederliste des Haushalts aufgelöst werden; `GET /internal/v1/households/{householdId}/members` existiert, `backend_shared` hat dafür aber noch keinen Client (#583).

---
