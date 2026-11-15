---
title: "Application Catalog"
description: "Central directory of all Tier-1 Core microservices and Tier-2 external stack applications integrated into the Alfheim platform."
---

> **TL;DR:** Central directory of all Tier-1 Core microservices and Tier-2 external stack applications integrated into the Alfheim platform.

---

## 📋 Table of Contents
- [Tier 1 Core Microservice Applications](#tier-1-core-microservice-applications)
- [Tier 2 Stack Applications & External Integrations](#-tier-2-stack-applications--external-integrations)
- [Application Classification Guidelines](#-application-classification-guidelines)

---

## Tier 1 Core Microservice Applications

Tier-1 applications are native monorepo microservices registered in Go (`core/dashboard/backend/internal/features/apps/tier1_core_registry.go`) featuring isolated database containers, Next.js microfrontends, and FastMCP AI agent surfaces.

The `Tier` column follows [ADR 0007](../explanation/decisions/0007-lean-core-app-set.md): `core` apps always run and cannot be disabled, `optional` apps are switched on and off with `alfheim-setup apps enable|disable` ([Manage apps](../how-to/manage-apps.md)). `Memory` is the sum of the app's memory reservations in `compose.prod.yaml` (limits are about twice that), the value the installer wizard shows. `Requires` lists the apps that must be enabled while this one is. The installer catalog that enforces both is `tools/installer/internal/features/apps/catalog.go`.

| App ID | Title | Tier | Memory | Requires | Tech Stack | Ingress Route (Frontend) | Internal Port | Status | Documentation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard` | Launcher & App Catalog | `core` | 144 MB | — | Go / Next.js | `alfheim.loegien.localhost/` | `3000` / `8080` | Active | [dashboard](./apps/dashboard.md) |
| `household` | Household & Roles | `core` | 144 MB | — | Go / Next.js | `/household` | `3000` / `8080` | Active | [household](./apps/household.md) |
| `pantry` | Digital Pantry | `optional` | 288 MB | — | FastAPI / Next.js | `/pantry` | `3000` / `8000` | Active | [pantry](./apps/pantry.md) |
| `shopping` | Shopping Lists | `optional` | 240 MB | `pantry` | FastAPI / Next.js | `/shopping` | `3010` / `8000` | Active | [shopping](./apps/shopping.md) |
| `budget` | Treasury & Budget | `optional` | 240 MB | — | FastAPI / Next.js | `/budget` | `3000` / `8000` | Active | [budget](./apps/budget.md) |
| `chores` | Household Chores | `optional` | 240 MB | — | FastAPI / Next.js | `/chores` | `3000` / `8000` | Active | [chores](./apps/chores.md) |
| `library` | Media & Library Hub | `optional` | 288 MB | — | FastAPI / Next.js | `/library` | `3000` / `8000` | Active | [library](./apps/library.md) |
| `workout` | Workout Tracker | `optional` | 240 MB | — | FastAPI / Next.js | `/workout` | `3000` / `8000` | Active | [workout](./apps/workout.md) |
| `maintenance`| Home Maintenance Tracker| `optional` | 288 MB | — | FastAPI / Next.js | `/maintenance` | `3000` / `8000` | Active | [maintenance](./apps/maintenance.md) |
| `chat` | ALFI Assistant & Chat | `optional` | 176 MB | — | Go / Next.js | `/chat` | `3000` / `8080` | Active | [chat](./apps/chat.md) |

The infrastructure (Caddy, PostgreSQL, Zitadel, RustFS) reserves another 464 MB and is part of the Lean Core. The optional `telemetry` module (VictoriaMetrics, node-exporter, VictoriaLogs, OpenTelemetry Collector, docker-socket-proxy, Vector, Grafana) reserves 448 MB and is toggled like an app; it has no dashboard tile and serves `/grafana`. Totals per tier: [hardware specifications](../how-to/homelab-deployment.md#hardware-specifications).

> **Note:** `core/household` owns households, members and roles, invites, contacts and the user profile, and answers the membership checks of every other backend ([ADR 0006](../explanation/decisions/0006-household-authorization-via-membership-api.md)). The dashboard is only the launcher: app catalog, user links and preferences (plus telemetry). It shows the household app's launcher tile (icon `home`, visible to every authenticated user) and links to `/household` and `/household/profile`.

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
