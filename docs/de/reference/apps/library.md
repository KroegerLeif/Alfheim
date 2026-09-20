---
title: "Medien & Bibliotheks-Hub"
description: "Digitaler Medien-Katalog, Leih-Management, externe Metadaten-Suche, Spielanleitungs-Speicher und Streaming-Abo-Tracking für Alfheim."
---

> **Kurzfassung:** Digitaler Medien-Katalog, Leih-Management, externe Metadaten-Suche, Spielanleitungs-Speicher und Streaming-Abo-Tracking für Alfheim.

Quelle: [`apps/library/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/library)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Medien-Tracking | Einheitlicher Artikel-Katalog (Bücher, Filme, Brettspiele, …) mit haushaltsbezogenen Standorten |
| Ausleihe & Verleih | Leih-Tracker für an Freunde verliehene oder aus Bibliotheken ausgeliehene Artikel |
| Metadaten-Suche | Externe Abfragen per ISBN, BoardGameGeek und TMDB zum Vorausfüllen von Katalogeinträgen |
| Spielanleitungen | PDF-Anleitungs-Upload, presigned Download-URLs und Löschung, auf RustFS S3 gestützt |
| Streaming-Abos | Nachverfolgung, welche Streaming-Anbieter der Haushalt abonniert hat |

> **Hinweis:** Frühere Fassungen dieser Seite beschrieben ein Lese-Fortschritts-Log und eine Haushalts-Wunschliste. Keins von beiden existiert im Code (keine `progress`- oder `wishlist`-Route, kein Service, kein Frontend-Feature) – sie waren angedacht, aber nicht umgesetzt. Diesen Hinweis entfernen, sobald eines davon erscheint, oder stattdessen als Folgearbeit für den Library-App-Sprint einplanen.

---

## 🏗️ Architektur & Tech Stack

- **Backend:** Python 3.12 / FastAPI-Microservice mit SQLModel (async SQLAlchemy) und OpenLibrary-API-Client.
- **Frontend:** Next.js 16 (App Router) Microfrontend, Tailwind CSS v4, Lucide React und `@alfheim/shared`.
- **Datenbank:** Gehostet auf `postgres-core` (`alfheim_library`-Datenbank, Besitzer `library_user`).

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway & Netzwerk-Matrix
| Service | Interner Port | Host-Mapping / Gateway-Route | Protokoll & Beschreibung |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Gemeinsame Multi-Zone-Netzwerke | PostgreSQL 16 Kern-Datenbankserver |
| `library-backend` | 8000 | `/library/api/v1` | FastAPI REST API |
| `library-frontend` | 3000 | `alfheim.loegien.localhost/library` | Next.js Microfrontend |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://library_user:postgres@postgres-core:5432/alfheim_library` | Async PostgreSQL-Verbindungszeichenkette |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | Generischer OIDC-Backend-Auth-Aussteller-URL |
| `OIDC_AUDIENCE` | `alfheim` | Erwarteter OIDC-JWT-Audience-Claim |
| `NEXT_PUBLIC_OIDC_ISSUER` | `http://auth.alfheim.loegien.localhost` | Browser-OIDC-Auth-Aussteller-URL |
| `NEXT_PUBLIC_OIDC_CLIENT_ID` | `library-frontend` | Browser-OIDC-Client-Kennung |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Basis-URL der Mitgliedschafts-API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generiertes Secret)* | Gemeinsames Secret, gesendet als `Authorization: Bearer …` bei Mitgliedschaftsprüfungen. Pflicht; ohne es startet das Backend nicht |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1/library` | Browser-API-Basis-URL. Compose leitet sie aus `ALFHEIM_BASE_URL` ab (Build-Argument und Laufzeit-Umgebung) |

---

## 📁 API-Module (`src/api/v1/`)

Library folgt nicht dem `src/features/<domain>/`-FDD-Layout anderer Apps; seine Routen sind stattdessen nach API-Modul organisiert:

- `items`: CRUD für den Medien-Artikel-Katalog.
- `lending`: Leih-Tracking für Artikel, ausgeliehen von externen Bibliotheken oder an Freunde verliehen.
- `locations`: Haushaltsbezogene Lagerorte für physische Medien.
- `lookup`: Externe Metadaten-Suche per ISBN, BoardGameGeek (`bgg`) und TMDB, zum Vorausfüllen eines neuen Katalogeintrags.
- `manuals`: PDF-Spielanleitungs-Upload, Abruf presigned Download-URLs und Löschung (RustFS S3, `ManualStorageService`).
- `providers`: Streaming-Abo-Tracking.
- `search`: Katalogübergreifende Suche.

---

## 🔌 MCP-Tools

Bereitgestellt unter `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`). Aktuell ein einzelnes Platzhalter-Tool, keine Katalog-Integration:

| Feature | Tools |
| :--- | :--- |
| `mcp/server` | `get_library_status` (liefert den statischen String "Library backend is running.") |

Der Chat-Assistent kann den Medien-Katalog noch nicht per MCP lesen oder ändern – echte Katalog-/Leih-Tools zu verdrahten ist eine offene Folgearbeit für den Library-App-Sprint.

---

## 🏠 Haushalts-Scoping

Jede Route hängt von `backend_shared.household.require_household` ab (jede Mitgliedsrolle darf lesen und schreiben). Siehe [ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Bekannte Probleme & offene Folgearbeiten

- **Kein Lese-Fortschritt- oder Wunschlisten-Feature**: Frühere Dokumentation beschrieb beide; keins ist umgesetzt (siehe Hinweis unter Zweck & Kernwert oben). Kandidaten für den Library-App-Sprint, falls weiterhin gewünscht.
- **MCP-Tools sind ein Platzhalter**: `get_library_status` ist das einzige Tool; Katalog-, Leih- und Lookup-Features haben noch keine MCP-Integration.
- Keine weiteren bekannten offenen Probleme über die allgemeinen Punkte zur Haushalts-Autorisierung in [Bekannte Probleme](../../explanation/known-issues.md) hinaus.

---
