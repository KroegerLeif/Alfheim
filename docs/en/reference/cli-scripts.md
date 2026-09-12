---
title: "CLI Orchestration Scripts Reference"
description: "Technical reference for repository shell scripts used for multi-stage cluster booting, environment provisioning, database seeding, and workspace verification."
sidebar:
  label: "CLI Scripts"
---

> **TL;DR:** Technical reference for repository shell scripts used for multi-stage cluster booting, environment provisioning, database seeding, and workspace verification.

---

## 📋 Table of Contents
- [`install.sh` — Standalone Installer Bootstrap](#installsh--standalone-installer-bootstrap)
- [`scripts/up.sh` — Staged Cluster Boot Orchestrator](#scriptsupsh--staged-cluster-boot-orchestrator)
- [`scripts/down.sh` — Cluster Teardown Utility](#scriptsdownsh--cluster-teardown-utility)
- [`scripts/zitadel-bootstrap.sh` — OIDC Client Provisioning](#scriptszitadel-bootstrapsh--oidc-client-provisioning)
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
> **Design rationale:** [ADR 0004](../explanation/decisions/0004-standalone-go-tui-installer.md).

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
| `--skip-obs` | Skip the VictoriaStack observability stage |
| `-h`, `--help` | Print the usage summary |

Stage 1 boots `postgres-core → zitadel → rustfs → caddy` and then runs
[`scripts/zitadel-bootstrap.sh`](#scriptszitadel-bootstrapsh--oidc-client-provisioning)
so Grafana has an OIDC client by the time the observability stage starts.
It requires a `.env`; generate one with `./scripts/init-env.sh --auto`.

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

## `scripts/zitadel-bootstrap.sh` — OIDC Client Provisioning

Reconciles the `Alfheim` project and the `Grafana` OIDC application in Zitadel,
then writes `GRAFANA_OIDC_CLIENT_ID` and `GRAFANA_OIDC_CLIENT_SECRET` into the
root `.env`, which is where `infrastructure/telemetry/compose.yml` reads them.
`scripts/up.sh` calls it; running it directly is only needed to repair or rotate
credentials.

Zitadel has no admin CLI, so the script drives the Management API. It
authenticates with the personal access token that Zitadel writes to
`infrastructure/zitadel/machinekey/pat.txt` while creating its first instance
(`ZITADEL_FIRSTINSTANCE_PATPATH`). A Zitadel client id is generated rather than
chosen, and a client secret is returned exactly once, so `.env` — not Zitadel —
is the source of truth for the secret; a missing or mismatched one is repaired
by regenerating it.

### Usage Syntax
```bash
./scripts/zitadel-bootstrap.sh [--force]
```

### Options & Flags
| Flag | Description |
| :--- | :--- |
| `--force` | Regenerate the Grafana client secret even when `.env` already holds a valid one |

> The PAT is only written while the *first* instance is created. If the Zitadel
> database survives but the file is gone, reset the local IAM state with
> `./scripts/down.sh --volumes` and boot again.

---

## `scripts/init-env.sh` — Cryptographic Environment Generator

Generates cryptographically secure secrets (AES-256 chat encryption keys, Zitadel masterkey and admin password, database credentials) and populates `.env`.

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
