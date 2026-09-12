# Platform Architecture Overview (`docs/explanation/architecture-overview.md`)

> **TL;DR:** Architectural explanation of the Alfheim Sovereign OS monorepo, its control plane, container topology, and multi-zone network isolation strategy.

---

## 📋 Table of Contents
- [Architectural Philosophy](#architectural-philosophy)
- [Monorepo Layout & Workspace Boundaries](#monorepo-layout--workspace-boundaries)
- [Control Plane vs. Microservice Applications](#control-plane-vs-microservice-applications)
- [Network Topology & Multi-Zone Segmentation](#network-topology--multi-zone-segmentation)
- [Database-per-Service Isolation Pattern](#database-per-service-isolation-pattern)

---

## Architectural Philosophy

Alfheim is designed as a **self-hosted sovereign home operating system**. It combines the modularity of isolated microservices with the developer ergonomics of a unified monorepo.

Key architectural pillars:
1. **Zero External Cloud Dependencies:** All identity, database, object storage, proxy, and telemetry infrastructure runs locally in containers.
2. **Strict Multi-Zone Network Isolation:** Services communicate across segmented Docker bridge networks to minimize blast radius.
3. **Database per Service:** Every microservice backend owns a dedicated database container. Cross-service database joins are strictly forbidden.
4. **Feature-Driven Design (FDD):** Domain logic is structured in modular feature directories (`src/features/<domain>`).

---

## Monorepo Layout & Workspace Boundaries

The codebase is organized into high-level layer directories:

```
alfheim/
├── core/                   # Platform control plane (Dashboard backend/frontend)
├── apps/                   # Domain microservices (Pantry, Budget, Chores, Chat, Workout, etc.)
├── infrastructure/         # Core infrastructure (Caddy Gateway, RustFS, VictoriaStack)
├── packages/               # Shared monorepo packages (@alfheim/shared, backend_shared)
├── deploy/                 # Server manifests (stack-apps.yaml)
├── scripts/                # Orchestration scripts (up.sh, verify.sh)
└── docs/                   # Central Diátaxis documentation portal
```

---

## Control Plane vs. Microservice Applications

* **Core Control Plane (`core/dashboard`)**: Written in Go (backend) and Next.js (frontend). Acts as the central platform launcher, rendering registered micro-applications, system status, and household switcher.
* **Domain Microservices (`apps/*`)**: Independent functional modules providing domain services (e.g. pantry stock tracking, envelope budgeting, workout execution).

---

## Network Topology & Multi-Zone Segmentation

The platform enforces multi-zone network isolation across dedicated Docker bridge networks:

* **`gateway-net`**: Connects Caddy ingress gateway to frontends, Zitadel, RustFS S3, and backend API endpoints.
* **`infra-net`**: Isolated infrastructure bridge connecting Zitadel, `postgres-core`, and RustFS S3 backend ports.
* **`core-net`**: Dedicated control plane network for `dashboard-backend` and `dashboard-db`.
* **`app-<name>-net`**: App-isolated networks connecting microservice backends to their dedicated database containers (e.g. `app-pantry-net`, `app-shopping-net`, `app-chat-net`).
* **`observability-internal`**: Dedicated telemetry bridge connecting app backends and Vector to OpenTelemetry Collector and VictoriaStack.

---

## Database-per-Service Isolation Pattern

To guarantee loose coupling and prevent data contamination, every backend microservice owns its PostgreSQL instance. Shared database state between applications is explicitly disallowed. Inter-service data sharing occurs via REST API integration (e.g. Pantry exporting low-stock items to Shopping).
