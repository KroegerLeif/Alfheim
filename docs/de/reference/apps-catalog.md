---
title: "Anwendungskatalog"
description: "Zentrales Verzeichnis aller Tier-1-Kern-Microservices und Tier-2-Anwendungen der externen Stack, die in die Alfheim-Plattform integriert sind."
---

> **Kurzfassung:** Zentrales Verzeichnis aller Tier-1-Kern-Microservices und Tier-2-Anwendungen der externen Stack, die in die Alfheim-Plattform integriert sind.

---

## 📋 Inhaltsverzeichnis
- [Tier 1 Kern-Microservice-Anwendungen](#-tier-1-kern-microservice-anwendungen)
- [Tier 2 Stack-Anwendungen & externe Integrationen](#-tier-2-stack-anwendungen--externe-integrationen)
- [Klassifizierungsrichtlinien für Anwendungen](#-klassifizierungsrichtlinien-für-anwendungen)

---

## 🏛️ Tier 1 Kern-Microservice-Anwendungen

Tier-1-Anwendungen sind native Monorepo-Microservices, registriert in Go (`core/dashboard/backend/internal/features/apps/tier1_core_registry.go`), mit isolierten Datenbankcontainern, Next.js-Microfrontends und FastMCP-KI-Agent-Oberflächen.

| App ID | Titel | Tech Stack | Ingress-Route (Frontend) | Interner Port | Status | Dokumentation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard` | Zentrales Kontrollzentrum | Go / Next.js | `alfheim.loegien.localhost/` | `3000` / `8080` | Aktiv | [dashboard](./apps/dashboard.md) |
| `pantry` | Digitale Speisekammer | FastAPI / Next.js | `/pantry` | `3000` / `8000` | Aktiv | [pantry](./apps/pantry.md) |
| `budget` | Haushaltskasse & Budget | FastAPI / Next.js | `/budget` | `3000` / `8000` | Aktiv | [budget](./apps/budget.md) |
| `chores` | Haushaltsaufgaben | FastAPI / Next.js | `/chores` | `3000` / `8000` | Aktiv | [chores](./apps/chores.md) |
| `chat` | ALFI-Assistent & Chat | Go / Next.js | `/chat` | `3000` / `8080` | Aktiv | [chat](./apps/chat.md) |
| `workout` | Trainings-Tracker | FastAPI / Next.js | `/workout` | `3000` / `8000` | Aktiv | [workout](./apps/workout.md) |
| `library` | Medien & Bibliotheks-Hub | FastAPI / Next.js | `/library` | `3000` / `8000` | Aktiv | [library](./apps/library.md) |
| `maintenance`| Wartungs-Tracker| FastAPI / Next.js | `/maintenance` | `3000` / `8000` | Aktiv | [maintenance](./apps/maintenance.md) |
| `shopping` | Einkaufslisten | FastAPI / Next.js | `/shopping` | `3010` / `8000` | Aktiv | [shopping](./apps/shopping.md) |

---

## 🔌 Tier 2 Stack-Anwendungen & externe Integrationen

Tier-2-Anwendungen sind externe Homelab-Stack-Dienste, deklarativ definiert in [`deploy/stack-apps.yaml`](../../../deploy/stack-apps.yaml) und dynamisch auf dem Dashboard angezeigt.

| App ID | Titel | Slug | Ziel-URL | Symbol | Erforderliche Rollen | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `home-assistant` | Home Assistant | `home-assistant` | `http://homeassistant.local` | `home` | `[]` | Aktiv |
| `plex` | Medienserver | `plex` | `http://plex.local:32400` | `film` | `["media_user"]` | Aktiv |
| `nextcloud` | Datei-Cloud | `nextcloud` | `http://nextcloud.local` | `cloud` | `[]` | Aktiv |

---

## 📐 Klassifizierungsrichtlinien für Anwendungen

1. **Tier 1 (Kern)**: Direkt im Monorepo-Workspace unter `apps/` oder `core/` erstellt. Verbraucht `@alfheim/shared` und `backend_shared`. Nutzt nativ Zitadel-OIDC-Authentifizierung.
2. **Tier 2 (Stack)**: Externe Server-Bereitstellungen, registriert via `deploy/stack-apps.yaml`. Integriert in das Dashboard-Launcher-Gitter über rollenbasierte Zugriffskontrolle.
