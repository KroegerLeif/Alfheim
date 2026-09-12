# CLI Orchestration Scripts Reference (`docs/reference/cli-scripts.md`)

> **TL;DR:** Technical reference for repository shell scripts used for multi-stage cluster booting, environment provisioning, database seeding, and workspace verification.

---

## 📋 Table of Contents
- [`install.sh` — Standalone Installer Bootstrap](#installsh--standalone-installer-bootstrap)
- [`scripts/up.sh` — Staged Cluster Boot Orchestrator](#scriptsupsh--staged-cluster-boot-orchestrator)
- [`scripts/down.sh` — Cluster Teardown Utility](#scriptsdownsh--cluster-teardown-utility)
- [`scripts/init-env.sh` — Cryptographic Environment Generator](#scriptsinit-envsh--cryptographic-environment-generator)
- [`scripts/verify.sh` — Monorepo Quality Gate Suite](#scriptsverifysh--monorepo-quality-gate-suite)
- [`scripts/seed.sh` — Database Seed Utility](#scriptsseedsh--database-seed-utility)

---

## `install.sh` — Standalone Installer Bootstrap

Root-level bootstrap for a new installation. Detects the host architecture,
downloads the matching `alfheim-setup` release binary, verifies its SHA-256
checksum, and hands over to the interactive wizard.

### Usage Syntax
```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

Arguments are forwarded to the binary:

```bash
curl -fsSL .../install.sh | bash -s -- --non-interactive --domain example.com --tls internal
```

### Environment Variables
| Variable | Description |
| :--- | :--- |
| `ALFHEIM_VERSION` | Release tag to install (default: `latest`) |
| `ALFHEIM_REPO` | Source repository (default: `KroegerLeif/Alfheim`) |

> **Full flag reference:** [`docs/reference/installer-cli.md`](./installer-cli.md).
> **Design rationale:** [ADR 0004](../decisions/0004-standalone-go-tui-installer.md).

> ⚠️ **`scripts/install.sh` is deprecated.** It still orchestrates Keycloak,
> which [ADR 0003](../decisions/0003-migrate-from-keycloak-to-zitadel.md)
> replaced with Zitadel. Use the root `install.sh` above.

---

## `scripts/up.sh` — Staged Cluster Boot Orchestrator

Orchestrates platform startup in ordered dependency stages to prevent race conditions. Uses deterministic health check waiting (`wait_healthy`).

### Usage Syntax
```bash
./scripts/up.sh [OPTIONS]
```

### Options & Flags
| Flag | Description |
| :--- | :--- |
| `-b`, `--build` | Force Docker image rebuild before starting containers |
| `-d`, `--detach` | Run containers in background detached mode |
| `--stage0` | Boot Stage 0 infrastructure only (Networks, Caddy, Keycloak, RustFS, VictoriaStack) |
| `--stage1` | Boot Stage 1 core services (`core/dashboard`) |
| `--stage2` | Boot Stage 2 microservice applications (`apps/*`) |

---

## `scripts/down.sh` — Cluster Teardown Utility

Gracefully stops and removes Docker containers across all workspace compose files.

### Usage Syntax
```bash
./scripts/down.sh [OPTIONS]
```

### Options & Flags
| Flag | Description |
| :--- | :--- |
| `-v`, `--volumes` | Delete persistent Docker volumes (resets database states) |

---

## `scripts/init-env.sh` — Cryptographic Environment Generator

Generates cryptographically secure secrets (AES-256 chat encryption keys, Keycloak passwords, database credentials) and populates `.env`.

### Usage Syntax
```bash
./scripts/init-env.sh [OPTIONS]
```

### Options & Flags
| Flag | Description |
| :--- | :--- |
| `--auto` | Non-interactive auto-generation with default domain |
| `--base-url <url>` | Set custom base domain URL (e.g. `https://alfheim.loegien.de`) |

---

## `scripts/verify.sh` — Monorepo Quality Gate Suite

Executes automated linting, formatting, typechecking, and unit test suites across Python, Go, and TypeScript workspace packages.

### Usage Syntax
```bash
./scripts/verify.sh [FLAGS]
```

### Options & Flags
| Flag | Description |
| :--- | :--- |
| `--python` | Runs Ruff check/format, `uv run ty check`, and `pytest` across Python backends |
| `--go` | Runs `go vet`, `gofmt`, and `go test -race -cover ./...` across Go backends |
| `--frontend` | Runs `pnpm check-types` (`tsc --noEmit`) and Vitest across frontends |
| `--security` | Executes security scanners (Bandit, Trivy) |

---

## `scripts/seed.sh` — Database Seed Utility

Populates relational databases with initial test households, users, pantry items, shopping lists, chores, and workout templates.

### Usage Syntax
```bash
./scripts/seed.sh
```
