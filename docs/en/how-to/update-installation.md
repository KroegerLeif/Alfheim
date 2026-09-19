---
title: "Update an Installation"
description: "Update a production Alfheim installation to a new release with one command, without re-running the wizard, regenerating secrets, or logging in again."
---

> **TL;DR:** `curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | ALFHEIM_VERSION=vX.Y.Z bash -s -- update` fetches that release's stack files, backs up the previous ones, and restarts — no wizard, no new secrets, no root CA, no re-login.

---

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [The one-liner](#the-one-liner)
- [Running the binary directly](#running-the-binary-directly)
- [What is preserved](#what-is-preserved)
- [What actually happens](#what-actually-happens)
- [Verifying the result](#verifying-the-result)
- [Rolling back](#rolling-back)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A completed Alfheim installation (an `.env` and `.alfheim.installed` at the
  install directory — see [Tutorial: your first installation](../tutorials/first-run.md)).
- SSH access to the host, at the install directory (for example `/srv/alfheim`).
- The target release tag, e.g. `v1.4.0`. See the
  [Releases page](https://github.com/KroegerLeif/Alfheim/releases) for what changed.

---

## The one-liner

From the installation directory:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh \
  | ALFHEIM_VERSION=v1.4.0 bash -s -- update
```

This downloads the `v1.4.0` `alfheim-setup` binary (verified against that
release's `SHA256SUMS`, exactly like a fresh install), then hands off to its
`update` subcommand, which fetches and verifies `v1.4.0`'s own
`compose.prod.yaml` and the other standalone stack files.

Omit `ALFHEIM_VERSION` to update to the newest stable release:

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash -s -- update
```

Add `-- update --yes` (or set `-e` in a script) to skip the confirmation
prompt in a non-interactive context such as cron or CI.

---

## Running the binary directly

If `alfheim-setup` is already on the host (or you would rather not re-fetch
it), run the subcommand directly from the install directory:

```bash
cd /srv/alfheim
alfheim-setup update --version v1.4.0
```

Omitting `--version` targets this binary's own build version — never
`latest` — so an update always names an exact, auditable release. Full flag
reference: [alfheim-setup CLI reference](../reference/installer-cli.md#the-update-subcommand).

---

## What is preserved

`update` never touches:

- `.env` secrets (Postgres passwords, `ZITADEL_MASTERKEY`, JWT signing keys, …)
- `infrastructure/ca/` (the `--tls internal` root CA) or `infrastructure/caddy/pki/`
- The Zitadel machinekey and bootstrap PAT (`infrastructure/zitadel/machinekey/`)
- Any Docker volume (databases, object storage, …)
- The Zitadel project and OIDC clients it already provisioned — the
  administrator account, its password and every app's login all keep working
  exactly as before.

It only replaces `compose.prod.yaml`, the OpenTelemetry Collector config, the
Postgres init script and `vector.toml` with the target release's copies, sets
`IMAGE_TAG` in `.env`, and appends a secret a newer release introduced but
`.env` still lacks (existing values are never rotated).

---

## What actually happens

1. Refuses to run unless an existing installation is found (`.env` present).
2. Resolves the target version from `--version`, or this binary's own build
   version — never `latest`.
3. Downloads and verifies the target release's stack files against its
   `SHA256SUMS`.
4. Backs up the current stack files to a timestamped directory
   (`.alfheim-backups/<UTC timestamp>/`) before replacing anything.
5. Replaces `compose.prod.yaml` and the other stack files, and sets
   `IMAGE_TAG` in `.env`.
6. Appends any secret a newer release requires and `.env` lacks.
7. Re-reconciles the Zitadel project and OIDC clients (idempotent — adds a
   missing redirect URI, changes nothing that already matches).
8. Ensures every service database exists (re-runs the idempotent Postgres
   init script).
9. `docker compose pull` followed by `docker compose up -d --remove-orphans`.
10. Runs [`scripts/verify-stack.sh`](#verifying-the-result) against the
    restarted stack and prints a summary.

If any step after the backup fails, the error names the exact rollback
commands (see [Rolling back](#rolling-back)) — nothing is undone
automatically, since containers may already be mid-restart.

---

## Verifying the result

`update` runs `scripts/verify-stack.sh` itself and prints its summary. Run it
by hand at any time, against either the production install or the local dev
stack:

```bash
./scripts/verify-stack.sh                    # auto-detects compose.prod.yaml or compose.yaml, and .env, in $PWD
./scripts/verify-stack.sh --dir /srv/alfheim # verify an install elsewhere
```

It checks that every Compose service is healthy, that Caddy's `/livez`
responds `OK`, that the OIDC discovery document names the configured issuer,
that every app route resolves through the gateway without a 5xx, that
`/internal/*` is blocked at the edge, and that the household API rejects a
request without a bearer token. It exits non-zero and prints a readable
summary if anything fails.

---

## Rolling back

If `update` fails, or you decide the new release should not have shipped:

1. Copy the files under the printed backup directory
   (`.alfheim-backups/<timestamp>/`) back over their current locations.
2. Set `IMAGE_TAG` in `.env` back to the previous value (the failure message
   names it; it is also whatever the previous `.alfheim.installed` /
   `docker compose config` reported).
3. Restart:
   ```bash
   docker compose -f compose.prod.yaml pull
   docker compose -f compose.prod.yaml up -d --remove-orphans
   ```

Because secrets, the root CA and every Docker volume were never touched, a
rollback never re-triggers a wizard, re-provisions Zitadel from scratch, or
loses data.

---

## Troubleshooting

**"no existing installation found"** — `update` requires an `.env` in
`--install-dir` (default: the current directory). Run it from the directory
the original install used, or pass `--install-dir`.

**"no target version"** — a locally built (non-release) binary has no
version to fall back to; pass `--version vX.Y.Z` explicitly.

**Checksum mismatch** — the download was corrupted or intercepted; re-run
the command. Nothing on disk is touched until every asset verifies.

**Verification fails after a successful restart** — the stack came back up
but one of the checks in
[Verifying the result](#verifying-the-result) failed. Run
`scripts/verify-stack.sh` again for the detailed per-check output, and see
[Troubleshooting](./troubleshooting.md) for the failing area (ingress,
Zitadel, a specific app).

---

## See also

* [alfheim-setup CLI reference](../reference/installer-cli.md)
* [Tutorial: your first installation](../tutorials/first-run.md)
* [Troubleshooting](./troubleshooting.md)
* [Backup, Restore & Data Migration](./backup-restore.md)
