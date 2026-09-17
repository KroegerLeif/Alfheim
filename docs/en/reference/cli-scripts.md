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
- [`alfheim-setup provision` — OIDC Client Provisioning](#alfheim-setup-provision--oidc-client-provisioning)
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
curl -fsSL .../install.sh | bash -s -- --non-interactive --domain example.com --tls internal --admin-email you@example.com
```

### Environment Variables
| Variable | Description |
| :--- | :--- |
| `ALFHEIM_VERSION` | Release tag to install (default: `latest`) |
| `ALFHEIM_CHANNEL` | `stable` (default) or `prerelease`. Pre-releases are never installed automatically. |
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

Stage 1 boots `postgres-core → zitadel → rustfs → caddy` and then provisions
the Zitadel project and every OIDC client (dashboard, every app frontend,
Grafana) via `go run ./tools/installer/cmd/alfheim-setup provision`, which
shares its reconciliation logic with the production installer
(`tools/installer/internal/features/provisioning`). It requires a `.env`;
generate one with `./scripts/init-env.sh --auto`.

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

## `alfheim-setup provision` — OIDC Client Provisioning

Reconciles the `Alfheim` project and every OIDC application the stack needs
(one public PKCE client shared by the dashboard and every app frontend, one
confidential client for Grafana) in Zitadel, then writes the generated ids
and secrets (`ZITADEL_PROJECT_ID`, `OIDC_AUDIENCE`, `ALFHEIM_WEB_CLIENT_ID`,
`GRAFANA_OIDC_CLIENT_ID`, `GRAFANA_OIDC_CLIENT_SECRET`) into the root `.env`.
`scripts/up.sh` calls it; running it directly is only needed to repair or
rotate credentials. It is a hidden subcommand of the production installer
binary (`tools/installer/internal/app/provision_cmd.go`), sharing its
reconciliation logic with a production install
(`tools/installer/internal/features/provisioning`) instead of a separate
shell script.

Zitadel has no admin CLI, so this drives the Management API through Caddy. It
authenticates with the personal access token that Zitadel writes to
`infrastructure/zitadel/machinekey/pat.txt` while creating its first instance
(`ZITADEL_FIRSTINSTANCE_PATPATH`); that PAT is also copied into `.env`
(`ZITADEL_BOOTSTRAP_PAT`), so a later run against an already-initialised
Zitadel still has it even if the machinekey file is gone. A Zitadel client id
is generated rather than chosen, and a client secret is returned exactly
once, so `.env` — not Zitadel — is the source of truth for the secret; a
missing or mismatched one is repaired by regenerating it.

### Usage Syntax
```bash
go run ./tools/installer/cmd/alfheim-setup provision \
  --env-file .env \
  --pat-file infrastructure/zitadel/machinekey/pat.txt \
  --zitadel-url http://127.0.0.1:80
```

### Options & Flags
| Flag | Description |
| :--- | :--- |
| `--env-file` | The `.env` to read and update in place |
| `--pat-file` | The Zitadel bootstrap machine user's personal access token file |
| `--zitadel-url` | Caddy's plain-HTTP listener, used only when `ZITADEL_EXTERNALSECURE` is not `true` (default `http://127.0.0.1:80`) |
| `--zitadel-tls-addr` | Caddy's HTTPS listener for a secure install; requests name `https://<ZITADEL_EXTERNALDOMAIN>` but are always dialled here (default `127.0.0.1:443`) |
| `--ca-file` | Root CA trusted in addition to the system roots (default `infrastructure/ca/alfheim-root-ca.crt` next to the `.env`, when present) |

> The PAT file is only written while the *first* instance is created. If the
> Zitadel database survives but the file is gone, `ZITADEL_BOOTSTRAP_PAT` in
> `.env` is used instead; if neither is available, reset the local IAM state
> with `./scripts/down.sh --volumes` and boot again.

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
