---
title: "Application Catalog"
description: "Central directory of all Tier-1 Core microservices and Tier-2 external stack applications integrated into the Alfheim platform."
---

> **TL;DR:** Central directory of all Tier-1 Core microservices and Tier-2 external stack applications integrated into the Alfheim platform.

---

## 📋 Table of Contents
- [Tier 1 Core Microservice Applications](#-tier-1-core-microservice-applications)
- [Tier 2 Stack Applications & External Integrations](#-tier-2-stack-applications--external-integrations)
- [Application Classification Guidelines](#-application-classification-guidelines)

---

## 🏛️ Tier 1 Core Microservice Applications

Tier-1 applications are native monorepo microservices registered in Go (`core/dashboard/backend/internal/features/apps/tier1_core_registry.go`) featuring isolated database containers, Next.js microfrontends, and FastMCP AI agent surfaces.

| App ID | Title | Tech Stack | Ingress Route (Frontend) | Internal Port | Status | Documentation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard` | Central Control Plane | Go / Next.js | `alfheim.loegien.localhost/` | `3000` / `8080` | Active | [`core/dashboard/README.md`](../../../core/dashboard/README.md) |
| `pantry` | Digital Pantry | FastAPI / Next.js | `/pantry` | `3000` / `8000` | Active | [`apps/pantry/README.md`](../../../apps/pantry/README.md) |
| `budget` | Treasury & Budget | FastAPI / Next.js | `/budget` | `3000` / `8000` | Active | [`apps/budget/README.md`](../../../apps/budget/README.md) |
| `chores` | Household Chores | FastAPI / Next.js | `/chores` | `3000` / `8000` | Active | [`apps/chores/README.md`](../../../apps/chores/README.md) |
| `chat` | ALFI Assistant & Chat | Go / Next.js | `/chat` | `3000` / `8080` | Active | [`apps/chat/README.md`](../../../apps/chat/README.md) |
| `workout` | Workout Tracker | FastAPI / Next.js | `/workout` | `3000` / `8000` | Active | [`apps/workout/README.md`](../../../apps/workout/README.md) |
| `library` | Media & Library Hub | FastAPI / Next.js | `/library` | `3000` / `8000` | Active | [`apps/library/README.md`](../../../apps/library/README.md) |
| `maintenance`| Home Maintenance Tracker| FastAPI / Next.js | `/maintenance` | `3000` / `8000` | Active | [`apps/maintenance/README.md`](../../../apps/maintenance/README.md) |
| `shopping` | Shopping Lists | FastAPI / Next.js | `/shopping` | `3010` / `8000` | Active | [`apps/shopping/README.md`](../../../apps/shopping/README.md) |

---

## 🔌 Tier 2 Stack Applications & External Integrations

Tier-2 applications are external homelab stack services defined declaratively in [`deploy/stack-apps.yaml`](../../../deploy/stack-apps.yaml) and surfaced dynamically on the dashboard.

| App ID | Title | Slug | Target URL | Icon | Required Roles | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `home-assistant` | Home Assistant | `home-assistant` | `http://homeassistant.local` | `home` | `[]` | Active |
| `plex` | Media Server | `plex` | `http://plex.local:32400` | `film` | `["media_user"]` | Active |
| `nextcloud` | File Cloud | `nextcloud` | `http://nextcloud.local` | `cloud` | `[]` | Active |

---

## 📐 Application Classification Guidelines

1. **Tier 1 (Core)**: Built directly within the monorepo workspace under `apps/` or `core/`. Consumes `@alfheim/shared` and `backend_shared`. Uses Zitadel OIDC authentication natively.
2. **Tier 2 (Stack)**: External server deployments registered via `deploy/stack-apps.yaml`. Integrated into the Dashboard launcher grid via role-based access control.
