---
title: "Medien & Bibliotheks-Hub"
description: "Digitaler Medien-Katalog, Buch- und Film-Tracking, Leih-Management, Lese-Fortschritts-Log und Wunschlisten-Service für Alfheim."
---

> **Kurzfassung:** Digitaler Medien-Katalog, Buch- und Film-Tracking, Leih-Management, Lese-Fortschritts-Log und Wunschlisten-Service für Alfheim.

Quelle: [`apps/library/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/library)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Buch & Medien-Tracking | Einheitlicher Medien-Artikel-Katalog (Bücher, Filme, Audiobooks) |
| Lese-Fortschritt | Lese-Sessions-Logs, Seiten-Tracking und Fertigstellungs-Status |
| Ausleihe & Verleih | Leih-Tracker für an Freunde verliehene oder aus Bibliotheken ausgeliehene Artikel |
| Wunschliste & Empfehlungen | Gemeinsame Haushalt-Wunschliste mit ISBN/OpenLibrary-Metadaten-Sync |

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
| `NEXT_PUBLIC_LIBRARY_API_URL` | `http://api.alfheim.loegien.localhost/library/api/v1` | Browser-API-Gateway-Endpunkt |

---

## 📁 Domain-Features (`src/features/`)

- `media`: Physischer und digitaler Medien-Artikel-Katalog mit OpenLibrary-ISBN-Lookup.
- `loans`: Leih-Tracking für Artikel, ausgeliehen von externen Bibliotheken oder an Freunde verliehen.
- `progress`: Lese- und Anschau-Fortschritts-Logs, Seiten-/Minuten-Tracking.
- `wishlist`: Gemeinsame Haushalt-Wunschliste für bevorstehende Medien-Käufe.

---
