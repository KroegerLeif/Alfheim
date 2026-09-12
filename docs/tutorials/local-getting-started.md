# Tutorial: Local Getting Started Guide (`docs/tutorials/local-getting-started.md`)

> **TL;DR:** Beginner-friendly, step-by-step tutorial to set up and run the entire Alfheim monorepo locally on your development machine.

---

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Step 1: Clone Repository & Provision Environment](#step-1-clone-repository--provision-environment)
- [Step 2: Start Platform Stack (`up.sh`)](#step-2-start-platform-stack-upsh)
- [Step 3: Verify Running Services & Access Applications](#step-3-verify-running-services--access-applications)
- [Step 4: Seed Initial Test Data (`seed.sh`)](#step-4-seed-initial-test-data-seedsh)
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

2. Initialize your local `.env` environment configuration:
   ```bash
   ./scripts/setup-env.sh
   ```

3. Add local domain aliases to your hosts file (`/etc/hosts` on Linux/macOS):
   ```hosts
   127.0.0.1 alfheim.loegien.localhost
   127.0.0.1 api.alfheim.loegien.localhost
   ```

---

## Step 2: Start Platform Stack (`up.sh`)

Run the automated multi-stage boot orchestrator to launch infrastructure, core control plane, and microservice applications:

```bash
./scripts/up.sh -b -d
```

The script will boot the cluster in ordered dependency stages:
* **Stage 0**: Gateway, Zitadel IAM, RustFS, VictoriaStack
* **Stage 1**: Core Dashboard Control Plane
* **Stage 2**: Domain Application Microservices (Pantry, Budget, Chores, etc.)

---

## Step 3: Verify Running Services & Access Applications

1. Verify container health status:
   ```bash
   docker compose ps
   ```

2. Open your browser and navigate to the Central Dashboard:
   `http://alfheim.loegien.localhost/`

3. Access microservices:
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

## Next Steps

* Learn how to build a new microservice in [Create a New FDD Microservice](./create-new-fdd-service.md).
* Review technical specifications in the [Application Catalog](../reference/apps-catalog.md).
