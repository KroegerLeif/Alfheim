---
title: "Local Getting Started Guide"
description: "Beginner-friendly, step-by-step tutorial to set up and run the entire Alfheim monorepo locally on your development machine."
sidebar:
  label: "Local Getting Started"
---

> **TL;DR:** Beginner-friendly, step-by-step tutorial to set up and run the entire Alfheim monorepo locally on your development machine.

---

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Step 1: Clone Repository & Provision Environment](#step-1-clone-repository--provision-environment)
- [Step 2: Start Platform Stack (`up.sh`)](#step-2-start-platform-stack-upsh)
- [Step 3: Verify Running Services & Access Applications](#step-3-verify-running-services--access-applications)
- [Step 4: Seed Initial Test Data (`seed.sh`)](#step-4-seed-initial-test-data-seedsh)
- [Stop & Clean Up](#stop--clean-up)
- [Next Steps](#next-steps)

---

## Prerequisites

Before starting, ensure your machine meets the following requirements:
* **Docker Engine** (>= 24.0) & **Docker Compose** v2 (>= 2.20)
* **Node.js** (>= 22.0) & **pnpm** (>= 9.0)
* **Python** (>= 3.12) & **uv** package manager
* **Go** (>= 1.25)
* **cURL** & **Git**

---

## Step 1: Clone Repository & Provision Environment

1. Clone the repository and navigate into the root directory:
   ```bash
   git clone https://github.com/KroegerLeif/Alfheim.git alfheim
   cd alfheim
   ```

2. Generate your local `.env` for the plain-HTTP `*.localhost` development hosts. It creates random dev secrets (database passwords, `ALFHEIM_INTERNAL_TOKEN`, …); re-running it keeps existing values and only adds missing keys:
   ```bash
   ./scripts/init-env.sh --auto --base-url http://alfheim.loegien.localhost
   ```

3. Optional: Chromium and Firefox resolve every `*.localhost` name to `127.0.0.1` on their own. Only for other tools (for example an older `curl`) add the aliases to `/etc/hosts`:
   ```hosts
   127.0.0.1 alfheim.loegien.localhost
   127.0.0.1 api.alfheim.loegien.localhost
   127.0.0.1 auth.alfheim.loegien.localhost
   ```

---

## Step 2: Start Platform Stack (`up.sh`)

Run the automated multi-stage boot orchestrator to launch infrastructure, core control plane, and microservice applications. On macOS this is one command with Docker Desktop running — no `sudo`, and no world-writable directories:

```bash
./scripts/up.sh -b
```

Add `--skip-obs` to leave out the observability stack. The script boots the cluster in ordered dependency stages:
* **Stage 0**: Docker network pre-flight
* **Stage 1**: Postgres, Zitadel IAM, RustFS, Caddy gateway, then Zitadel OIDC client provisioning
* **Stage 2**: Core apps: dashboard, then household (`/household`, skipped with a warning until its sources exist on your checkout)
* **Stages 3–8**: Domain application microservices (Shopping, Pantry, Maintenance, Chores, Budget, Chat)
* **Stage 9**: Observability (VictoriaMetrics, VictoriaLogs, OTel Collector, Vector, Grafana)

Zitadel writes its bootstrap token (PAT) into the `zitadel_machinekey` Docker volume. A one-shot `zitadel-machinekey-init` container hands that volume to Zitadel's container user (uid 1000) before Zitadel starts, so nothing on your host needs a `chown`. `up.sh` copies the PAT out with `docker compose cp` and stores it as `ZITADEL_BOOTSTRAP_PAT` in `.env`.

---

## Step 3: Verify Running Services & Access Applications

1. Verify container health status:
   ```bash
   docker compose ps
   ```

2. Open your browser and navigate to the Central Dashboard:
   `http://alfheim.loegien.localhost/`

3. Access microservices:
   * **Household**: `http://alfheim.loegien.localhost/household/`
   * **Digital Pantry**: `http://alfheim.loegien.localhost/pantry`
   * **Budget & Treasury**: `http://alfheim.loegien.localhost/budget`
   * **ALFI AI Assistant**: `http://alfheim.loegien.localhost/chat`

---

## Step 4: Seed Initial Test Data (`seed.sh`)

Populate relational databases with test households, users, and sample pantry items:

```bash
./scripts/seed.sh
```

---

## Stop & Clean Up

Stop the stack and keep all data:

```bash
./scripts/down.sh
```

Reset to a clean slate (removes containers, Docker volumes including `zitadel_machinekey`, the external networks, and the Postgres data directory). Run it before a fresh `up.sh` when you want Zitadel to initialise again:

```bash
./scripts/down.sh --volumes
docker run --rm -v "$PWD/infrastructure/postgres:/pg" alpine:3.20 rm -rf /pg/data
```

The data directory is deleted from a throwaway container because on Linux it belongs to the Postgres container user; this needs no `sudo` on either platform. `down.sh --volumes` alone keeps `infrastructure/postgres/data`. Zitadel then stays initialised and never writes a new PAT, so `up.sh` falls back to `ZITADEL_BOOTSTRAP_PAT` in `.env`.

---

## Next Steps

* Learn how to build a new microservice in [Create a New FDD Microservice](./create-new-fdd-service.md).
* Review technical specifications in the [Application Catalog](../reference/apps-catalog.md).
