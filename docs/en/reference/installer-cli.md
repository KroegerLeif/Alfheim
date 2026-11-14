---
title: "alfheim-setup CLI Reference"
description: "Complete parameter reference for the Alfheim installer."
sidebar:
  label: "Installer CLI"
---

Complete parameter reference for the Alfheim installer.

* **Binary:** `alfheim-setup`
* **Source:** [`tools/installer`](../../../tools/installer)
* **Bootstrap:** [`install.sh`](../../../install.sh)
* **Design:** [ADR 0004](../explanation/decisions/0004-standalone-go-tui-installer.md)

---

## Synopsis

```
alfheim-setup [flags]
alfheim-setup update|backup|restore|apps ...
```

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

Arguments after `--` are forwarded to the binary:

```bash
curl -fsSL .../install.sh | bash -s -- --non-interactive --domain example.com --tls internal
```

---

## Mode flags

| Flag | Description |
| :--- | :--- |
| `--dry-run` | Run every validation, generate secrets and render `.env` and the `Caddyfile` into a temporary directory. Starts no container and modifies no existing installation. A host that is missing Docker produces warnings rather than a failure. |
| `--non-interactive` | Take every answer from flags and environment variables instead of the wizard. Zitadel is provisioned automatically; the login name and password are printed. |
| `--reconfigure` | Re-run the wizard over an existing installation. **Existing secrets are preserved, never rotated.** |
| `--install-dir DIR` | Installation root. Default: the current working directory. |
| `--version` | Print build metadata and exit, before any host inspection. |

## Configuration flags

Each flag has an environment-variable equivalent. The flag wins when both are set.

| Flag | Environment variable | Description |
| :--- | :--- | :--- |
| `--domain HOST` | `ALFHEIM_DOMAIN` | Base domain, e.g. `example.com`. **Required** in non-interactive mode. |
| `--app-host HOST` | `ALFHEIM_APP_HOST` | Host serving the dashboard. Defaults to the base domain. |
| `--admin-email MAIL` | `ALFHEIM_ADMIN_EMAIL` | Zitadel administrator login name (verified, no mail needed) and ACME contact. **Required** in non-interactive mode. |
| `--tls STRATEGY` | `ALFHEIM_TLS_STRATEGY` | `hetzner`, `cloudflare`, `desec`, `custom` or `internal`. **Required** in non-interactive mode. |
| `--api-token TOKEN` | `ALFHEIM_DNS_API_TOKEN`, `HETZNER_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `DESEC_TOKEN` | DNS provider token. Required for `hetzner`, `cloudflare` and `desec`. |
| `--cert-path DIR` | `ALFHEIM_CERT_PATH` | Absolute directory holding `fullchain.pem` and `privkey.pem`. Only for `--tls custom`; omit to use `./data/caddy/certs/`. |
| `--image-tag TAG` | `ALFHEIM_IMAGE_TAG` | Container image tag. Default `latest`. |
| `--apps LIST` | `ALFHEIM_APPS` | Optional apps to enable: `all`, `none` or a comma-separated list such as `pantry,shopping,telemetry`. Default on a fresh install: `none` (the [Lean Core](../explanation/decisions/0007-lean-core-app-set.md)); a re-run keeps the stored `ALFHEIM_ENABLED_APPS`. Unknown names and broken requirements are usage errors. Without the flag the interactive wizard asks, with telemetry as a separate question that defaults to off. `--apps=all` installs everything, as before. |
| `--db-data-path DIR` | `ALFHEIM_DB_DATA_PATH` | Absolute host directory for the PostgreSQL data. Default: the `postgres_core_data` named volume. |
| `--object-data-path DIR` | `ALFHEIM_OBJECT_DATA_PATH` | Absolute host directory for the RustFS object storage. Default: the `rustfs_data` named volume. |
| `--metrics-data-path DIR` | `ALFHEIM_METRICS_DATA_PATH` | Absolute host directory for VictoriaMetrics. Default: the `victoriametrics_data` named volume. |
| `--logs-data-path DIR` | `ALFHEIM_LOGS_DATA_PATH` | Absolute host directory for VictoriaLogs. Default: the `victorialogs_data` named volume. |
| `--google-client-id ID` | `ALFHEIM_GOOGLE_CLIENT_ID` | Turn on "Sign in with Google" with this OAuth client ID. Needs `ALFHEIM_GOOGLE_CLIENT_SECRET`. A re-run keeps the values in `.env`; without the flag the wizard offers an "external sign-in" step that is skipped by default. See [Set up social login](../how-to/social-login.md). |
| — | `ALFHEIM_GOOGLE_CLIENT_SECRET` | Google OAuth client secret. Environment only: a flag would expose it in the process list. |
| `--apple-client-id ID` | `ALFHEIM_APPLE_CLIENT_ID` | Turn on "Sign in with Apple" with this Services ID. Needs all four Apple values. |
| `--apple-team-id ID` | `ALFHEIM_APPLE_TEAM_ID` | Apple developer Team ID (10 characters). |
| `--apple-key-id ID` | `ALFHEIM_APPLE_KEY_ID` | Key ID of the Sign in with Apple key (10 characters). |
| `--apple-private-key-file PATH` | `ALFHEIM_APPLE_PRIVATE_KEY_FILE` | Absolute path of the `.p8` key. The file must have mode `0600` or stricter, or the installer stops before starting any container. Only the path is stored in `.env`. |
| — | `ALFHEIM_INSTALL_DIR` | Equivalent to `--install-dir`. |

### Release selection

`install.sh` reads three further variables:

| Variable | Description |
| :--- | :--- |
| `ALFHEIM_VERSION` | Pins an exact release tag. Default `latest`, which resolves against the channel below. |
| `ALFHEIM_CHANNEL` | `stable` (default) or `prerelease`. |
| `ALFHEIM_REPO` | Overrides the source repository. |

On the `stable` channel the installer resolves the newest release that is *not*
marked as a pre-release. Tags containing `-rc`, `-beta` or `-alpha` are published
as pre-releases, so a testing build never reaches a host that did not ask for
one. If no stable release exists yet, the installer stops and names the newest
pre-release along with the two commands that would install it.

Use `ALFHEIM_CHANNEL=prerelease` to take the newest release of any kind, or
`ALFHEIM_VERSION` to pin one exactly.

---

## TLS strategies

| Strategy | Certificates | Inbound port 80 | Notes |
| :--- | :--- | :--- | :--- |
| `hetzner` | Let's Encrypt wildcard via DNS-01 | Not required | Needs a Hetzner DNS API token. |
| `cloudflare` | Let's Encrypt wildcard via DNS-01 | Not required | Needs a Cloudflare token with `Zone:DNS:Edit`. |
| `desec` | Let's Encrypt wildcard via DNS-01 | Not required | Needs a deSEC API token. See [deSEC DNS-01](../how-to/desec-dns-tls.md). |
| `custom` | Supplied by you | Not required | Needs `fullchain.pem` and `privkey.pem`. |
| `internal` | Root CA generated by the installer (HTTPS) | Not required | Browsers warn until you import `infrastructure/ca/alfheim-root-ca.crt` (fingerprint printed at the end) or accept the warning. The root is created once and never rotated silently. Installs from before HTTPS was used here migrate with `--reconfigure`. |

See [Hetzner DNS-01](../how-to/hetzner-dns-tls.md) and
[Custom certificates](../how-to/custom-certificates.md).

### Trusting the `internal` root CA

Browsers keep certificate exceptions per host. If you accept the warning only
for the app host, the login's background request to the auth host is rejected
without a prompt, and sign-in fails with "Failed to fetch".

**Recommended:** import `infrastructure/ca/alfheim-root-ca.crt` into the OS or
browser trust store once. That covers every Alfheim host. Compare its SHA-256
fingerprint with the one the installer prints first.

* **macOS:** Keychain Access → *System* keychain → import the file, then set
  *Trust* to *Always Trust*.
* **Windows:** `certmgr.msc` → *Trusted Root Certification Authorities* →
  *Certificates* → *All Tasks* → *Import*.
* **Linux / Firefox:** the browser's certificate settings → *Authorities* →
  *Import*. Firefox uses its own store on every OS.

**Fallback without importing:** before signing in, open **both**
`https://<app host>` and `https://<auth host>` (the installer prints both URLs)
and accept the certificate warning on each.

Per-device steps (including Android and iOS) and fingerprint verification:
[Trust the local root CA](../how-to/trust-local-root-ca.md).

---

## Operating modes

The mode is detected from the installation directory, not chosen by a flag.

| Detected state | Mode | Behaviour |
| :--- | :--- | :--- |
| No `.alfheim.installed` | **install** | Full wizard, two-phase boot. A `.env` left by an unfinished run is reused, so its secrets are kept. With a DNS-01 strategy the token is checked first, and Zitadel is configured only once Caddy serves valid certificates. |
| `.alfheim.installed` present | **update** | Pull images and restart. No wizard. Existing secrets are never changed; a secret a newer release requires and `.env` lacks is generated and appended. Missing service databases are created by re-running `init-multiple-dbs.sh`. |
| `.alfheim.installed` present, plus `--reconfigure` | **reconfigure** | Wizard re-runs; existing secrets are preserved. Also the way to change the domain: [Change the domain](../how-to/change-domain.md). |

> **Why secrets are never rotated.** Regenerating `ZITADEL_MASTERKEY` on a
> configured instance makes its database permanently unreadable. Every value
> already present in `.env` is carried forward; only genuinely missing ones are
> generated.

---

## The `update` subcommand

```
alfheim-setup update [--version vX.Y.Z] [--install-dir DIR] [--yes]
```

The Day-2 command for every release after the first install: it fetches a
target release's `compose.prod.yaml` and the other standalone stack files,
backs up the previous ones, sets `IMAGE_TAG` in `.env`, then runs the same
secret-backfill, Zitadel-reconciliation and restart steps as a plain re-run.
It requires an existing installation (an `.env` present) and never runs the
wizard, rotates a secret, or touches the root CA, the Zitadel machinekey/PAT,
or a Docker volume. Full walkthrough, one-liner and rollback:
[Update an installation](../how-to/update-installation.md).

`update` first takes a database and secrets backup (see below) and aborts if
it fails. Pass `--skip-backup` to update without one.

---

## The `apps` subcommand

```
alfheim-setup apps list              [--install-dir DIR]
alfheim-setup apps enable  <name>    [--install-dir DIR]
alfheim-setup apps disable <name>    [--install-dir DIR]
```

Lists the apps of the [Lean Core app set](../explanation/decisions/0007-lean-core-app-set.md)
and switches optional apps (and `telemetry`) on and off on an existing
installation. The choice is stored as `ALFHEIM_ENABLED_APPS` in `.env`; an
`.env` without it counts as "every app enabled".

| Action | Behaviour |
| :--- | :--- |
| `list` | Prints every app with its tier (`core` or `optional`), its state and its requirements. |
| `enable <name>` | Records the app in `ALFHEIM_ENABLED_APPS` and `COMPOSE_PROFILES` (and rewrites `CHAT_MCP_SERVERS` and `PANTRY_BACKEND_URL` to match the new set), creates any missing database (re-runs the idempotent Postgres init script), pulls and starts its containers and waits until they are healthy. Then it routes the app in the Caddyfile and restarts Caddy. Enabling an enabled app does nothing. |
| `disable <name>` | Records the change, then stops and removes the app's containers (`docker compose rm -s -f`). **Volumes and databases are never removed**, so enabling the app again brings its data back. Its routes then answer 404 or redirect to the dashboard ([ingress matrix](./ingress-matrix.md#routes-of-disabled-apps)). Disabling a disabled app does nothing. |

Enabling or disabling `telemetry` also sets `OTEL_ENABLED` in `.env`.
Every other compose call of the installer (install, plain re-run, `update`,
`restore`) passes the same `COMPOSE_PROFILES`, so none of them starts a
disabled app.
Unknown names, core apps (`disable dashboard`) and broken requirements
(`enable shopping` without `pantry`, `disable pantry` while `shopping` is on)
are rejected with exit code `1` and an error naming the conflict.
`apps` does not recreate the dashboard or chat backends, which read
`ALFHEIM_ENABLED_APPS` and `CHAT_MCP_SERVERS` when their containers are
created; the next `update` does. The `--apps` names and the per-app memory
are listed in the [apps catalog](./apps-catalog.md). Task guide:
[Manage apps](../how-to/manage-apps.md).

---

## The `backup` subcommand

```
alfheim-setup backup [--output DIR] [--keep N] [--skip-media] [--install-dir DIR]
```

Writes one `alfheim-backup-<UTC>.tar.gz` (mode `0600`) holding a `pg_dumpall`
of every database, the RustFS object storage, `.env`, the Zitadel machinekey,
the root CA and Caddy PKI, the stack files and a checksummed `manifest.json`.
The stack must be running. `--output` (or `ALFHEIM_BACKUP_DIR`) defaults to
`<install-dir>/backups`; `--keep` retains the N newest archives (default 7);
`--skip-media` leaves out the object storage. The archive contains all secrets
in plaintext. Details, scheduling and off-site copies:
[Backup, Restore & Data Migration](../how-to/backup-restore.md).

## The `restore` subcommand

```
alfheim-setup restore <archive> [--install-dir DIR] [--yes]
```

Verifies the archive against its manifest, then replaces `.env` and the other
secrets, drops and recreates every database and role from the dump, refills the
RustFS storage, starts the stack and runs `scripts/verify-stack.sh`. It asks
for confirmation unless `--yes` is given. The recommended target is a fresh
host. See [Backup, Restore & Data Migration](../how-to/backup-restore.md).

---

## Two-phase bootstrap

| Phase | Services | Waits for |
| :--- | :--- | :--- |
| 1 — Edge & Identity | `postgres-core`, `caddy`, `zitadel` | `alfheim_postgres_core` (120 s), `alfheim_caddy` (90 s), `alfheim_zitadel` (300 s) |
| 2 — Zitadel provisioning | — | Reconciles the `Alfheim` project, the web client and, when `OTEL_ENABLED=true`, the Grafana client via the Management API and writes their IDs to `.env`; turns self-registration off and reconciles the configured social login providers |
| 3 — Core & Application Stack | all remaining services of the Lean Core and the enabled apps (`COMPOSE_PROFILES`) | `dashboard-backend` (240 s), `dashboard-frontend` (180 s) |

During provisioning, the installer creates the Zitadel project "Alfheim" and one client shared by the dashboard and every app frontend. It creates the Grafana client only when telemetry is on (`OTEL_ENABLED=true` in `.env`; a fresh install starts with it off). It writes the client IDs to `.env`.

### Social login

When `ALFHEIM_GOOGLE_CLIENT_ID` and `ALFHEIM_GOOGLE_CLIENT_SECRET` are set, provisioning creates or updates the instance identity provider "Google" (and, with the four `ALFHEIM_APPLE_*` values, "Apple", uploading the key read from `ALFHEIM_APPLE_PRIVATE_KEY_FILE`) with the options from [ADR 0008](../explanation/decisions/0008-social-login-policy.md), lists it on the login policy, turns `allowExternalIdp` on and keeps `allowRegister` off. It prints the redirect URI to register at the provider (Apple's ends in `/callback/form`, because Apple answers with a form POST) and writes `ZITADEL_<PROVIDER>_IDP_FINGERPRINT` to `.env`. A run without changes makes no write to Zitadel. Emptying both values takes the provider off the login page but keeps it, so existing user links survive. The hidden `provision` subcommand takes `--google-client-id ID` and the four `--apple-*` flags too (Google secret from `ALFHEIM_GOOGLE_CLIENT_SECRET` in the environment or `.env`) and writes the values to `.env`. A loose Apple key file stops it with an error on every installation, new or existing. On an existing installation a social login failure is a warning, so the run still finishes.

### Telemetry switch

The hidden `provision` subcommand takes `--telemetry` (or `--telemetry=false`) to turn the optional observability stack on or off. Like `apps enable|disable telemetry`, it adds or removes the `telemetry` module in `ALFHEIM_ENABLED_APPS` and writes `COMPOSE_PROFILES` and `OTEL_ENABLED` to match. It creates the Grafana client when telemetry is on; turning it off keeps the existing Grafana credentials for a later re-enable. Without the flag, `OTEL_ENABLED` from `.env` decides. Apply the change with `alfheim-setup update`, which re-renders the Caddyfile (`/grafana` proxies to Grafana with telemetry on and redirects to the dashboard with it off) and recreates the services. See [Grant Grafana access](../how-to/grafana-access.md#turn-telemetry-on). The final output prints the administrator login name and the generated password; a password change is required at first login.

---

## Exit codes

| Code | Meaning |
| :--- | :--- |
| `0` | Success. |
| `1` | Runtime failure — host not ready, validation failed, a container did not become healthy. |
| `2` | Usage error — unknown flag, stray argument, or a missing required input in non-interactive mode. |
| `130` | Interrupted (SIGINT/SIGTERM). Containers already started are left running. |

On interrupt the terminal is restored and the resume command is printed.
Nothing is torn down, because a half-finished Zitadel initialisation must not
be destroyed.

---

## Generated files

| Path | Mode | Contents |
| :--- | :--- | :--- |
| `.env` | `0600` | All configuration and credentials. |
| `infrastructure/caddy/Caddyfile` | `0644` | Rendered ingress configuration. Contains no credential; DNS tokens are referenced as `{env.NAME}`. |
| `.alfheim.installed` | `0644` | Completion marker: version and timestamp. |
| `data/caddy/certs/` | `0700` | Created for `--tls custom` in the default location. |

---

## Examples

Interactive install in the current directory:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

Preview everything without touching the host:

```bash
alfheim-setup --dry-run --non-interactive --domain example.com --tls internal
```

Headless CI install with Cloudflare DNS-01:

```bash
ALFHEIM_DNS_API_TOKEN="$CF_TOKEN" alfheim-setup \
  --non-interactive \
  --domain example.com \
  --tls cloudflare \
  --admin-email ops@example.com \
  --install-dir /srv/alfheim
```

Headless Lean Core install with pantry and shopping, then add the budget app later:

```bash
alfheim-setup --non-interactive --domain example.com --tls internal \
  --admin-email ops@example.com --apps pantry,shopping
alfheim-setup apps enable budget
```

Change the domain on a running instance:

```bash
cd /srv/alfheim && alfheim-setup --reconfigure
```

Pin a specific release:

```bash
ALFHEIM_VERSION=v0.2.0 bash -c "$(curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh)"
```

Install the newest pre-release for testing:

```bash
ALFHEIM_CHANNEL=prerelease bash -c "$(curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh)"
```

---

## See also

* [Tutorial: your first installation](../tutorials/first-run.md)
* [How-to: update an installation](../how-to/update-installation.md)
* [How-to: manage apps](../how-to/manage-apps.md)
* [How-to: run Alfheim on low-spec hardware](../how-to/low-spec-setup.md)
* [Environment variables](./environment-variables.md)
* [CLI scripts](./cli-scripts.md)
* [ADR 0004](../explanation/decisions/0004-standalone-go-tui-installer.md)
