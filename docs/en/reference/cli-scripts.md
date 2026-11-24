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
| `--lean` | Start the Lean Core only: infrastructure, dashboard and household, no optional app and no telemetry |
| `--apps=LIST` | Start the Lean Core plus the comma-separated modules in `LIST`, for example `--apps=pantry,shopping,telemetry`. Telemetry starts only when listed. Unknown names and `shopping` without `pantry` are rejected |
| `-h`, `--help` | Print the usage summary |

Without `--lean` or `--apps`, every app and the observability stack start, as
before. With either flag, `up.sh` exports `COMPOSE_PROFILES` for its compose
calls and skips the stage of every app that is off. One stage per app is
derived from the `OPTIONAL_APPS` array in the script. The split between the
Lean Core and the optional modules is recorded in
[ADR 0007](../explanation/decisions/0007-lean-core-app-set.md).

`./scripts/verify-stack.sh` checks the routes of the core apps always and the
route of an optional app (or `/grafana`) only when its container runs; it
lists the routes it skipped, so it passes after `./scripts/up.sh --lean`.
In a repository checkout, where `compose.yaml` and `compose.prod.yaml` both
exist, it checks `compose.yaml` when only the dev stack is running and
`compose.prod.yaml` otherwise; `--compose-file` overrides the choice.

When `.env` sets `ALFHEIM_SMTP_HOST=mailpit` (see
[Configure e-mail](../how-to/configure-smtp.md#test-it-locally-with-mailpit)),
stage 1 also starts Mailpit, provisioning activates it as Zitadel's SMTP
server, and `verify-stack.sh` checks that a password-reset e-mail arrives.

| Variable | Effect on `verify-stack.sh` |
| :--- | :--- |
| `VERIFY_STACK_WAIT_SECONDS` | How long to wait for services still in their healthcheck start period (default `300`) |
| `VERIFY_STACK_INSECURE` | `1` skips TLS certificate verification |
| `VERIFY_STACK_MAILPIT_URL` | Mailpit's HTTP API. Set it to run the password-reset check against a Mailpit that `ALFHEIM_SMTP_HOST` does not name (default `http://127.0.0.1:8025` when the host is `mailpit`) |
| `VERIFY_STACK_ZITADEL_TOKEN` | Zitadel API token for that check. Default: `alfheim-setup zitadel-token`, or the installer source in a repository checkout |

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
| `-v`, `--volumes` | Delete the named Docker volumes, the external networks and the `postgres-core` data directory `infrastructure/postgres/data` (resets database states) |

`postgres-core` keeps its data in the bind mount `infrastructure/postgres/data`,
which `docker compose down --volumes` does not touch. With `-v`, once the
containers are down, `down.sh` deletes it from a short-lived container of the
`postgres-core` image pinned in `infrastructure/compose.yml`
(`--entrypoint rm`), because on Linux the files belong to the container's
postgres user and a host `rm` would need root. It refuses to run, and exits
non-zero, when that path resolves anywhere other than
`<repository root>/infrastructure/postgres/data` (for example through a
symlink). A data directory set with `ALFHEIM_DB_DATA_PATH` is never removed.
Without `-v` the directory stays untouched.

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
authenticates with a short-lived access token from the machine key in
`infrastructure/zitadel/provisioner/machine-key.json` next to the `.env`, and
rotates that key on every run. Only when no key works yet does it need
`--pat-file`: the personal access token Zitadel writes to
`/machinekey/pat.txt` while creating its first instance
(`ZITADEL_FIRSTINSTANCE_PATPATH`). That run stores the key and revokes every
PAT of the machine user, so the PAT works exactly once. In the development
stack the PAT lives in the `zitadel_machinekey` Docker volume;
`scripts/up.sh` copies it out with `docker compose cp` into a private temp
file, and passes `--pat-file` only when it found one. See
[Zitadel credential](installer-cli.md#zitadel-credential). A Zitadel client id
is generated rather than chosen, and a client secret is returned exactly
once, so `.env` — not Zitadel — is the source of truth for the secret; a
missing or mismatched one is repaired by regenerating it.

### Usage Syntax
```bash
# With a stored machine key (every run after the first)
go run ./tools/installer/cmd/alfheim-setup provision \
  --env-file .env \
  --zitadel-url http://127.0.0.1:80

# First run, or recovery after the key expired
docker compose cp zitadel:/machinekey/pat.txt ./pat.txt   # development stack
go run ./tools/installer/cmd/alfheim-setup provision \
  --env-file .env \
  --pat-file ./pat.txt \
  --zitadel-url http://127.0.0.1:80
rm ./pat.txt
```

### Options & Flags
| Flag | Description |
| :--- | :--- |
| `--env-file` | The `.env` to read and update in place |
| `--pat-file` | A personal access token of the provisioning machine user. Optional: needed only when no working machine key is stored yet (first run, or recovery). The run revokes it. |
| `--zitadel-url` | Caddy's plain-HTTP listener, used only when `ZITADEL_EXTERNALSECURE` is not `true` (default `http://127.0.0.1:80`) |
| `--zitadel-tls-addr` | Caddy's HTTPS listener for a secure install; requests name `https://<ZITADEL_EXTERNALDOMAIN>` but are always dialled here (default `127.0.0.1:443`) |
| `--ca-file` | Root CA trusted in addition to the system roots (default `infrastructure/ca/alfheim-root-ca.crt` next to the `.env`, when present) |

> The PAT file is only written while the *first* instance is created, and the
> first provisioning run revokes it. If the machine key is lost or expired,
> create a short-lived PAT for the machine user in the Zitadel console and pass
> it with `--pat-file`, or reset the local IAM state as described in
> [Getting started](../tutorials/local-getting-started.md) and boot again.

---

## `scripts/init-env.sh` — Cryptographic Environment Generator

Generates cryptographically secure secrets (AES-256 chat encryption keys, Zitadel masterkey and admin password, database credentials) and populates `.env`.

When `.env` already exists (and `--force` is not given), the script migrates legacy keys and replaces every secret-like key (`*PASSWORD*`, `*SECRET*`, `*TOKEN*`, `ZITADEL_MASTERKEY`) that still equals its `.env.example` placeholder. Values you changed are kept, mirrored keys (`S3_SECRET_KEY`, `ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD`) follow their source, and only key names are printed. A second run changes nothing. Keys with an empty, `${...}` or `__PROVISIONED__` example value and `CHAT_ENCRYPTION_KEY_ID` are left alone. `scripts/tests/test-init-env.sh`, run by `verify.sh --security`, checks this. When `ZITADEL_BOOTSTRAP_PAT_EXPIRATIONDATE` is missing, empty or past, the script sets it to one week from now; Zitadel refuses an expired date when it creates its first instance again after the database was wiped.

### Usage Syntax
```bash
./scripts/init-env.sh [OPTIONS]
```

### Options & Flags
| Flag | Description |
| :--- | :--- |
| `--auto` | Non-interactive auto-generation with default domain |
| `--base-url <url>` | Set custom base domain URL (e.g. `https://alfheim.loegien.de`) |
| `--force` | Regenerate `.env` from `.env.example` with fresh values for every secret |

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
| `--security` | Runs gitleaks, private key, `.env` and `TODO` checks, and the non-mutating pre-commit hooks; fails if gitleaks is not installed |
| `--allow-missing-gitleaks` | With `--security`: warn instead of failing when gitleaks is not installed |

---

## `scripts/seed.sh` — Database Seed Utility

Populates relational databases with initial test households, users, pantry items, shopping lists, chores, and workout templates.

### Usage Syntax
```bash
./scripts/seed.sh
```
