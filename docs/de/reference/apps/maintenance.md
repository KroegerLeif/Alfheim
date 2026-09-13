---
title: "Wartungs-Tracker"
description: "Ausrüstungs-Inventar, wiederkehrende Wartungs-Planung, interaktive Service-Checklisten und historische Reparatur-Logs für Alfheim."
---

> **Kurzfassung:** Ausrüstungs-Inventar, wiederkehrende Wartungs-Planung, interaktive Service-Checklisten und historische Reparatur-Logs für Alfheim.

Quelle: [`apps/maintenance/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/maintenance)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Ausrüstungs-Tracking | Haushalt-Geräte-Inventar (HVAC, Geräte, Fahrzeuge, Filter) |
| Vorbeugende Wartung | Zeit-basierte und Nutzungs-basierte wiederkehrende Wartungs-Zeitpläne |
| Komplexe Reparatur-Schritte | Geführte interaktive Wartungs-Checklisten mit Schritt-Bestätigung |
| Reparatur-Historia & Kosten | Historische Service-Logs, Auftragnehmer-Notizen und Teile-Kosten-Tracking |

---

## 🏗️ Architektur & Tech Stack

- **Backend:** Python 3.12 / FastAPI-Microservice mit SQLModel (async SQLAlchemy) und FastMCP-KI-Tools.
- **Frontend:** Next.js 16 (App Router) Microfrontend, Tailwind CSS v4, Lucide React und `@alfheim/shared`.
- **Datenbank:** Gehostet auf `postgres-core` (`alfheim_maintenance`-Datenbank, Besitzer `maintenance_user`).

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway & Netzwerk-Matrix
| Service | Interner Port | Host-Mapping / Gateway-Route | Protokoll & Beschreibung |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Gemeinsame Multi-Zone-Netzwerke | PostgreSQL 16 Kern-Datenbankserver |
| `maintenance-backend` | 8000 | `/maintenance/api/v1` | FastAPI REST API & FastMCP-Tools |
| `maintenance-frontend` | 3000 | `alfheim.loegien.localhost/maintenance` | Next.js Microfrontend |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://maintenance_user:postgres@postgres-core:5432/alfheim_maintenance` | Async PostgreSQL-Verbindungszeichenkette |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | Generischer OIDC-Backend-Auth-Aussteller-URL |
| `OIDC_AUDIENCE` | `alfheim` | Erwarteter OIDC-JWT-Audience-Claim |
| `NEXT_PUBLIC_MAINTENANCE_API_URL` | `http://api.alfheim.loegien.localhost/maintenance/api/v1` | Browser-API-Gateway-Endpunkt |

---

## 📁 Domain-Features (`src/features/`)

- `equipment`: Gerät-, Geräte- und Fahrzeug-Registrierung.
- `schedules`: Wartungs-Intervalle (z.B. 6-Monats-Filteraustausch).
- `tasks`: Interaktive Wartungs-Aufgaben-Ausführung und Schritt-Checklisten.
- `history`: Permanente Service-Logs, Auftragnehmer-Notizen und Teile-Kosten-Ledger.

---
