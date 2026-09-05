# Alfheim — Self-Hosting & Installation Guide (`INSTALL.md`)

Welcome to the **Alfheim Home Server OS** installation guide. This document provides everything you need to deploy, configure, and maintain Alfheim in production on your home server or homelab.

---

## 📋 System Requirements & Prerequisites

### Hardware Specifications

| Component | Minimum | Recommended (All Services Active) |
| :--- | :--- | :--- |
| **CPU** | 2 Cores (x86_64 or arm64) | 4+ Cores (x86_64 or arm64) |
| **RAM** | 4 GB (with 2 GB swap) | 8 GB+ |
| **Storage** | 20 GB SSD / NVMe | 50 GB+ SSD |
| **Network** | 100 Mbps Ethernet | 1 Gbps Gigabit Ethernet |

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
curl -sSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/scripts/install.sh | bash
```

### What the installer does automatically:
1. Verifies Docker engine, Docker Compose v2, and system prerequisites.
2. Creates the application directory at `~/alfheim`.
3. Downloads the official release orchestration files (`compose.prod.yaml`, `Caddyfile`, `alfheim-realm.json`, telemetry configs).
4. Generates cryptographically strong random credentials (AES-256 chat encryption key, PostgreSQL passwords, Keycloak admin token, S3 credentials) and saves them with `chmod 600` permissions in `.env`.
5. Prints straightforward instructions to start the stack.

---

## 🛠️ Manual Installation Walkthrough

If you prefer full control over your server configuration, follow the manual step-by-step instructions below:

### 1. Create the Installation Directory Structure
```bash
mkdir -p ~/alfheim/keycloak/providers
mkdir -p ~/alfheim/infrastructure/telemetry/collector
cd ~/alfheim
```

### 2. Download Release Assets
Download the release assets directly from the latest tagged release:

```bash
RELEASE_TAG="v0.1.0-beta.1"
BASE_URL="https://raw.githubusercontent.com/KroegerLeif/Alfheim/${RELEASE_TAG}"

curl -sSL "${BASE_URL}/compose.prod.yaml" -o compose.prod.yaml
curl -sSL "${BASE_URL}/.env.example" -o .env.example
curl -sSL "${BASE_URL}/scripts/init-env.sh" -o init-env.sh
curl -sSL "${BASE_URL}/infrastructure/caddy/Caddyfile" -o Caddyfile
curl -sSL "${BASE_URL}/infrastructure/keycloak/alfheim-realm.json" -o keycloak/alfheim-realm.json
curl -sSL "${BASE_URL}/infrastructure/telemetry/collector/config.yaml" -o infrastructure/telemetry/collector/config.yaml

chmod +x init-env.sh
```

### 3. Generate Environment & Secrets
Run the cryptographic secret generator:

```bash
# Non-interactive generation (defaults to localhost)
./init-env.sh --auto

# Or interactive generation with your custom domain / IP:
./init-env.sh --domain home.myhomelab.net
```

### 4. Review Configuration (`.env`)
Inspect the generated `.env` file and adjust custom parameters if necessary:
```bash
nano .env
```

Key environment options:
* `NEXT_PUBLIC_FRONTEND_URL`: Your server's external web address (e.g. `http://home.lan` or `http://192.168.1.100`).
* `KEYCLOAK_PUBLIC_URL`: URL to access the Keycloak IAM server (e.g. `http://home.lan/auth`).
* `CHAT_ENCRYPTION_KEY`: Auto-generated 32-byte base64 key for securing LLM API keys at rest with AES-256-GCM.

### 5. Start Alfheim Stack
Launch all services in detached mode:

```bash
docker compose -f compose.prod.yaml up -d
```

Monitor container boot and healthchecks:
```bash
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs -f
```

---

## 🌐 Post-Installation Setup & Access

Once the containers report `healthy`:

1. **Alfheim Central Dashboard**:
   * Open your browser and navigate to: `http://<server-ip>` or `http://localhost`
   * Catch-all root dashboard providing access to all registered household modules (Pantry, Shopping, Chores, Maintenance, Chat, Budget, Workout, Library).

2. **Keycloak IAM Administration**:
   * URL: `http://<server-ip>/auth/admin/`
   * Default Username: `admin`
   * Default Password: See `KEYCLOAK_ADMIN_PASSWORD` in your `.env` file.

3. **Grafana Observability Stack**:
   * URL: `http://<server-ip>/grafana/`
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
  -v alfheim-prod_dashboard_postgres_data:/data/dashboard \
  -v alfheim-prod_postgres_iam_data:/data/iam \
  -v alfheim-prod_rustfs_data:/data/rustfs \
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
