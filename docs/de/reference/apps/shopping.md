---
title: "Einkaufslisten"
description: "Collaborative Haushalt-Einkaufslisten, persönliche private Listen, Drag-and-Drop-Artikel-Neuanordnung und Digital Pantry Stock-Export-Synchronisation."
---

> **Kurzfassung:** Collaborative Haushalt-Einkaufslisten, persönliche private Listen, Drag-and-Drop-Artikel-Neuanordnung und Digital Pantry Stock-Export-Synchronisation.

Quelle: [`apps/shopping/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/shopping)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Vergessene Einkaufsartikel | Gemeinsame Echtzeit-Haushalt-Einkaufsliste |
| Persönliche private Käufe | Geschützte persönliche Einkaufsliste (`is_personal=true`) pro Benutzer |
| Speisekammer-Bestände laufen aus | Automatische Low-Stock-Export-Sync von Digital Pantry |
| Listen-Artikel-Chaos | Drag-and-Drop-Artikel-Neuanordnung mit Backend-Positions-Persistierung |

---

## 🏗️ Architektur & Tech Stack

- **Backend:** Python 3.12 / FastAPI-Microservice mit SQLModel (async SQLAlchemy) und Pantry REST-Client.
- **Frontend:** Next.js 16 (App Router) Microfrontend, TanStack Query, Tailwind CSS v4 und `@alfheim/shared`.
- **Datenbank:** Gehostet auf `postgres-core` (`alfheim_shopping`-Datenbank, Besitzer `shopping_user`).

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway & Netzwerk-Matrix
| Service | Interner Port | Host-Mapping / Gateway-Route | Protokoll & Beschreibung |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Gemeinsame Multi-Zone-Netzwerke | PostgreSQL 16 Kern-Datenbankserver |
| `shopping-backend` | 8000 | `/shopping/api/v1` | FastAPI REST API & Pantry-Sync |
| `shopping-frontend` | 3010 | `alfheim.loegien.localhost/shopping` | Next.js Microfrontend |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://shopping_user:postgres@postgres-core:5432/alfheim_shopping` | Async PostgreSQL-Verbindungszeichenkette |
| `PANTRY_API_URL` | `http://pantry-backend:8000/api/v1` | Interner Speisekammer-Service-Endpunkt |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Basis-URL der Mitgliedschafts-API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generiertes Secret)* | Gemeinsames Secret, gesendet als `Authorization: Bearer …` bei Mitgliedschaftsprüfungen. Pflicht; ohne es startet das Backend nicht |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/shopping/api/v1` | Browser-API-Basis-URL. Compose leitet sie aus `ALFHEIM_BASE_URL` ab (Build-Argument und Laufzeit-Umgebung) |

---

## 🔑 Domain-Features & Auto-Provisionierung-Regeln

- **Persönliche Liste (`is_personal=true`)**: Automatisch pro Benutzer bei Ingress provisioniert. Privat für den Benutzer über Haushalte hinweg. Nicht löschbar.
- **Haushalt-Liste (`is_default=true`)**: Automatisch pro Haushalt provisioniert. Gemeinsam unter allen Mitgliedern. Nicht löschbar.
- **Backend-gesteuerte Sortierung**: Artikel-Positionierung wird via `position`-Spalte verfolgt. Drag-and-Drop-Neuanordnung sendet Bulk-`PATCH /api/v1/shopping-lists/reorder`-Aktualisierungen.

---
