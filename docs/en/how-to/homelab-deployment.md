---
title: "Self-Hosting & Installation Guide"
description: "Deploy, configure and maintain Alfheim in production on a home server or homelab, via the automated installer or a manual walkthrough."
sidebar:
  label: "Homelab Deployment"
---

Welcome to the **Alfheim Home Server OS** installation guide. This document provides everything you need to deploy, configure, and maintain Alfheim in production on your home server or homelab.

---

## 📋 System Requirements & Prerequisites

### Hardware Specifications

| Component | Minimum | Recommended (All Services Active) |
| :--- | :--- | :--- |
| **CPU** | 2 Cores (x86_64 or arm64) | 4+ Cores (x86_64 or arm64) |
| **RAM** | 4 GB (with 2 GB swap) | 8 GB+ |
| **Storage** | 10 GB SSD / NVMe | 20 GB+ SSD |
| **Network** | 100 Mbps Ethernet | 1 Gbps Gigabit Ethernet |

**Storage Breakdown:** Fresh Alfheim install requires ~5.5–6.5 GB: container images (≈3.6 GB extracted), base OS + Docker Engine (≈1.5–2.5 GB), fresh volumes (≈0.2 GB). Headroom is for RustFS uploads (budget receipts, library PDFs), unrotated container logs, and backups. Metrics retention is bounded to 14 days, logs to 7 days (configured in `compose.prod.yaml`).

### Supported Operating Systems
* **Linux (Recommended)**: Debian 12 (Bookworm), Ubuntu 22.04 / 24.04 LTS, Fedora Server, Rocky Linux / AlmaLinux 9.
* **Virtualization**: Proxmox VE (Debian VM or LXC container with `nesting=1` and `keyctl=1`).
* **SBCs**: Raspberry Pi 4 / 5 (Debian 64-bit / Raspberry Pi OS 64-bit).
* **Development / macOS**: macOS 14+ with Docker Desktop or OrbStack.

### Software Prerequisites
1. **Docker Engine**: Version `24.0.0` or newer.
   * [Official Docker Engine Installation Guide](https://docs.docker.com/engine/install/)
2. **Docker Compose**: Version `v2.20.0` or newer (Docker Compose v2 plugin).
   * Verify with: `docker compose version`
3. **cURL**: Standard POSIX `curl` binary.

---

## 🚀 Quickstart: Single-Command Automated Installer

The fastest way to install Alfheim on a home server is using our automated POSIX installer:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

### What the installer does automatically
1. **`install.sh`** checks for `curl`, confirms a Linux `amd64` or `arm64` host, resolves the release (newest *stable* by default), downloads the matching `alfheim-setup` binary plus the stack assets (`compose.prod.yaml`, telemetry and PostgreSQL init files) into the **current directory**, and verifies each against the release's `SHA256SUMS`. It stops on a missing or mismatched checksum.
2. **`alfheim-setup`** inspects the host (Docker Engine and Compose v2) and detects the mode: *install*, *update* (existing `.env` or `.alfheim.installed`) or *reconfigure* (`--reconfigure`).
3. It asks for the domain, administrator e-mail and TLS strategy in the wizard, or reads them from flags and environment variables with `--non-interactive`.
4. It generates every credential from `crypto/rand` and writes `.env` (mode `0600`) and `infrastructure/caddy/Caddyfile`. Values already in `.env` are carried forward, never regenerated.
5. For the `internal` TLS strategy it creates a local root CA once (`infrastructure/caddy/pki/root.{crt,key}`, public copy `infrastructure/ca/alfheim-root-ca.crt`) and prints its SHA-256 fingerprint.
6. **Phase 1, Edge & Identity:** starts `postgres-core`, `caddy` and `zitadel` and waits for them to become healthy.
7. **Phase 2, Zitadel provisioning:** creates the `Alfheim` project, the web client shared by the dashboard and every app, and the Grafana client through Zitadel's Management API, and writes their IDs into `.env`.
8. **Phase 3, Core & Application Stack:** pulls and starts every remaining service, waits for the dashboard, and prints the access URLs, the administrator login and, for `internal`, how to trust the root CA.

Every strategy serves HTTPS. `hetzner` and `cloudflare` obtain Let's Encrypt wildcard certificates, `custom` uses your PEM files, and `internal` signs with the local root CA ([trust it](./trust-local-root-ca.md) on each device).

To install a pre-release, pin a tag or opt into the pre-release channel:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | ALFHEIM_VERSION=v0.1.1-rc.12 bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | ALFHEIM_CHANNEL=prerelease bash
```

---

## 🛠️ Manual Installation Walkthrough

Use this when you want to inspect every file before anything runs, or cannot pipe a script into `bash`. It repeats the steps of `install.sh` by hand; `alfheim-setup` still does the configuration and boot.

### 1. Create the installation directory
```bash
mkdir -p ~/alfheim && cd ~/alfheim
mkdir -p infrastructure/ca infrastructure/caddy/pki \
         infrastructure/telemetry/collector infrastructure/telemetry/vector infrastructure/postgres
```

Creating `infrastructure/ca` and `infrastructure/caddy/pki` up front keeps Docker from creating these bind-mount sources owned by root.

### 2. Download and verify the release assets
```bash
TAG="v0.1.1-rc.12"          # the release to install
ARCH="amd64"                # or arm64
BASE="https://github.com/KroegerLeif/Alfheim/releases/download/${TAG}"

curl -fsSLO "${BASE}/SHA256SUMS"
curl -fsSLO "${BASE}/alfheim-setup_linux_${ARCH}"
curl -fsSLO "${BASE}/compose.prod.yaml"
curl -fsSLO "${BASE}/otelcol-config.yaml"
curl -fsSLO "${BASE}/init-multiple-dbs.sh"
curl -fsSLO "${BASE}/vector.toml"

sha256sum --check --ignore-missing SHA256SUMS
```

Every file must report `OK`. Then move the assets to where `compose.prod.yaml` expects them:

```bash
mv otelcol-config.yaml infrastructure/telemetry/collector/config.yaml
mv vector.toml infrastructure/telemetry/vector/vector.toml
mv init-multiple-dbs.sh infrastructure/postgres/init-multiple-dbs.sh
chmod +x infrastructure/postgres/init-multiple-dbs.sh "alfheim-setup_linux_${ARCH}"
```

### 3. Preview the configuration (optional)
```bash
./alfheim-setup_linux_${ARCH} --dry-run --non-interactive --domain example.com --tls internal
```

A dry run renders `.env` and the Caddyfile without starting a container.

### 4. Run the installer
Interactively:

```bash
./alfheim-setup_linux_${ARCH}
```

Or headless, for example with Hetzner DNS-01:

```bash
ALFHEIM_DNS_API_TOKEN="<token>" ./alfheim-setup_linux_${ARCH} \
  --non-interactive --domain example.com --tls hetzner --admin-email you@example.com
```

The installer runs the same three phases as above and starts the whole stack. Every flag and environment variable is listed in the [installer CLI reference](../reference/installer-cli.md).

### 5. Check the result
```bash
docker compose -f compose.prod.yaml ps
```

Every service reports `running`, and those with a healthcheck report `healthy`. The generated `.env` holds all configuration and credentials; change domain or TLS settings with `alfheim-setup --reconfigure` rather than by hand, so the Caddyfile and Zitadel clients stay consistent.

---

## 🌐 Post-Installation Setup & Access

Once the containers report `healthy`:

1. **Alfheim Central Dashboard**:
   * Open your browser and navigate to `https://<your-domain>` (the value of `ALFHEIM_BASE_URL`).
   * Use `https://`. Sign-in needs a secure context, so opening the dashboard over plain `http://` on anything but `localhost` shows *Secure connection (HTTPS) required* instead of the login.
   * With the installer's `internal` TLS strategy, trust the generated root CA first, or accept the certificate warning for both the app host and the auth host. See [Trust the local root CA](./trust-local-root-ca.md).
   * Catch-all root dashboard providing access to all registered household modules (Pantry, Shopping, Chores, Maintenance, Chat, Budget, Workout, Library).

2. **Zitadel IAM Administration**:
   * URL: `https://<your-auth-domain>/ui/console` (set via `ZITADEL_EXTERNALDOMAIN`)
   * Default Username: See `ZITADEL_ADMIN_USER` in your `.env` file.
   * Default Password: See `ZITADEL_ADMIN_PASSWORD` in your `.env` file.

3. **Grafana Observability Stack**:
   * URL: `https://<your-domain>/grafana/`
   * Username: `admin`
   * Password: See `GRAFANA_ADMIN_PASSWORD` in your `.env` file.

---

## 🔄 Upgrades & Maintenance

### Pulling Updated Container Images
When a new version is released:

```bash
cd ~/alfheim

# Pull latest prebuilt images
docker compose -f compose.prod.yaml pull

# Recreate containers with zero downtime migration
docker compose -f compose.prod.yaml up -d
```

### Backing Up Persistent Data
All databases, object storage blobs, and telemetry data reside in named Docker volumes:

```bash
# List all Alfheim volumes
docker volume ls | grep alfheim

# Create a full backup archive of volume data
docker run --rm \
  -v alfheim-prod_postgres_core_data:/data/postgres \
  -v alfheim-prod_rustfs_data:/data/rustfs \
  -v alfheim-prod_victoriametrics_data:/data/metrics \
  -v alfheim-prod_victorialogs_data:/data/logs \
  -v $(pwd):/backup \
  alpine tar czf /backup/alfheim-backup-$(date +%Y%m%d).tar.gz /data
```

### Stopping or Resetting the Platform
```bash
# Graceful stop
docker compose -f compose.prod.yaml stop

# Full teardown (preserves all data volumes)
docker compose -f compose.prod.yaml down

# Teardown AND wipe all persistent data (CAUTION: irreversible data loss!)
docker compose -f compose.prod.yaml down -v
```
