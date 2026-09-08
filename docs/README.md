# Alfheim Central Documentation Portal

> **TL;DR:** Central knowledge base for Alfheim Sovereign OS, structured according to the [Diátaxis framework](https://diataxis.fr/) into four clear documentation quadrants.

---

## 📋 Table of Contents
- [Diátaxis Architecture Overview](#-di%C3%A1taxis-architecture-overview)
- [Quick Links & Navigation](#-quick-links--navigation)
- [Architectural Decisions (ADR)](#-architectural-decisions-adr)
- [System Trade-Offs & Known Issues](#-system-trade-offs--known-issues)

---

## 📐 Diátaxis Architecture Overview

Alfheim documentation separates content strictly into four distinct modes to serve different user needs:

```
                  PRACTICAL STEPS
                     │
    🎓 Tutorials     │    🛠️ How-To Guides
    (Learning-       │    (Task-oriented
     oriented)       │     procedures)
                     │
─────────────────────┼─────────────────────  MOST USEFUL
                     │                       FOR WORK
    💡 Explanation   │    📖 Reference
    (Understanding-  │    (Information-
     oriented)       │     oriented specs)
                     │
                     │
                 THEORETICAL
```

---

## 🧭 Quick Links & Navigation

### 🎓 1. Tutorials (Learning-Oriented)
Practical walkthroughs for onboarding and building with Alfheim:
* [Local Getting Started Guide](./tutorials/local-getting-started.md) — Step-by-step setup for running Alfheim locally.
* [Create a New FDD Microservice](./tutorials/create-new-fdd-service.md) — Scaffold and register a new Feature-Driven Design application.

### 🛠️ 2. How-To Guides (Task-Oriented)
Goal-driven procedures for administrators and developers:
* [Homelab Server Deployment](./how-to/homelab-deployment.md) — Deploying Alfheim on Linux bare-metal or Proxmox VE.
* [Secrets Hardening & Production Safety](./how-to/secrets-hardening.md) — Sourcing secrets, AES encryption keys, and environment overrides.
* [Backup & Disaster Recovery](./how-to/backup-restore.md) — Backing up PostgreSQL databases, RustFS S3 object storage, and volumes.
* [System Troubleshooting Guide](./how-to/troubleshooting.md) — Diagnosing container boot race conditions, migration locks, and gateway errors.

### 📖 3. Reference (Information-Oriented)
Deterministic technical specifications and catalogs:
* [Application Catalog](./reference/apps-catalog.md) — Central matrix of Tier-1 Core apps and Tier-2 Stack integrations.
* [Caddy Ingress Gateway Routing Matrix](./reference/ingress-matrix.md) — Public URLs, internal ports, and path stripping rules.
* [Environment Variables Reference](./reference/environment-variables.md) — Master listing of all `.env` configuration flags.
* [CLI Scripts Reference](./reference/cli-scripts.md) — Command-line flags and options for `up.sh`, `down.sh`, `seed.sh`, and `verify.sh`.

### 💡 4. Explanation (Understanding-Oriented)
High-level architecture and design philosophy:
* [Platform Architecture Overview](./explanation/architecture-overview.md) — Multi-zone networks, control plane, and container topology.
* [Feature-Driven Design (FDD) Paradigm](./explanation/feature-driven-design.md) — Bounded contexts, 6-file feature structure, and 200 LOC Limits.
* [Authentication & Multi-Tenancy](./explanation/authentication-security.md) — Keycloak OIDC, JWT claim validation, and `X-Household-ID` isolation.
* [VictoriaStack Telemetry Pipeline](./explanation/telemetry-pipeline.md) — Vector log aggregation, OTel Collector, and W3C traceparent headers.

---

## 🏛️ Architectural Decisions (ADR)

All architectural decisions are formally recorded in [MADR format](https://adr.github.io/madr/) under [`docs/decisions/`](./decisions/README.md):
* [ADR 0001: Adoption of Diátaxis Documentation Framework & App Consolidation](./decisions/0001-diataxis-documentation.md)
* [ADR 0002: Feature-Driven Design (FDD) & Bounded Context Monorepo Architecture](./decisions/0002-feature-driven-design.md)

---

## ⚠️ System Trade-Offs & Known Issues

Accepted costs and environmental limitations are centrally documented in the [Known Issues Register](./known-issues.md). Software bugs belong in the repository Issue Tracker.
