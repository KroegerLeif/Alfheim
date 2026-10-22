---
title: "Verify a Release End to End"
description: "Checklist for testing a release candidate on a disposable, production-like stack before promoting dev to main: fresh install, operator access, uploads, backup, update, restore and the upgrade from the previous release."
---

> **TL;DR:** Unit tests fake Docker and Zitadel. Before promoting `dev` to `main`, install the candidate with `alfheim-setup` on a throwaway host, click through the checks below, then back up, update, wipe, restore and upgrade from the previous tag. Every step has an expected result. Any deviation blocks the release.

---

## 📋 Table of Contents
- [Prepare a disposable host](#prepare-a-disposable-host)
- [1. Fresh install](#1-fresh-install)
- [2. Sample data and backup](#2-sample-data-and-backup)
- [3. Update](#3-update)
- [4. Wipe and restore](#4-wipe-and-restore)
- [5. Upgrade from the previous release](#5-upgrade-from-the-previous-release)

---

## Prepare a disposable host

- A Linux VM or spare machine with Docker. Use an amd64 host until the images
  are published for arm64 as well.
- Tag a pre-release from `dev`, for example `v0.3.0-rc.1`. The release workflow
  builds the images and the installer assets for it, and `install.sh` never
  picks a pre-release automatically, so no operator receives it by accident.
- Use `--tls internal` with any test domain. On the machine you test from,
  [trust the local root CA](trust-local-root-ca.md), or use `*.localhost` names
  when testing on the host itself.

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh \
  | ALFHEIM_VERSION=v0.3.0-rc.1 bash -s -- --non-interactive \
    --domain alfheim.localhost --admin-email admin@example.com --tls internal
```

---

## 1. Fresh install

| Check | Expected |
| --- | --- |
| Installer exit code and `scripts/verify-stack.sh` | 0, every service healthy |
| Zitadel `GET /admin/v1/policies/login` | `allowRegister` absent or `false`; `/ui/login/register` answers "Registration is not allowed" |
| Project `alfheim_operator` role | exists, granted to the admin, `projectRoleAssertion: true` |
| Admin access token | carries `alfheim_operator` under `urn:zitadel:iam:org:project:roles` |
| Grafana sign-in | admin gets org role Admin; a user without the role is rejected |
| `GET /api/v1/telemetry/logs` | real container logs for the admin, `403 operator_required` for others |
| `GET /api/v1/chat/mcp-servers/diagnostics`, `PATCH /api/v1/chat/mcp-servers/{id}` | 200 for the admin, 403 for others (the list itself is redacted for them) |
| Budget receipt: upload URL, then `PUT` from the browser | URL under `https://<app-host>/storage/`, `PUT` answers 200 |
| Chat attachment upload | 201, the object exists in RustFS |

Test the "others" rows with a second user who owns a household of their own:
household roles must not unlock installation-wide resources.

---

## 2. Sample data and backup

Create at least one record per app (budget account and transaction, pantry
product with a barcode, shopping list, chore template, maintenance device,
library item, workout equipment) and note them. Then:

```bash
alfheim-setup backup
```

The archive must contain `database.sql`, `rustfs-data.tar`, `.env`, the Zitadel
machinekey, the CA and Caddy PKI, the stack files and `manifest.json`.

---

## 3. Update

Tag a second pre-release (or re-use the same one) and run:

```bash
alfheim-setup update --version v0.3.0-rc.2
```

Expected: a pre-update backup is written before anything changes, the
Caddyfile is re-rendered, Zitadel provisioning runs, every service restarts
healthy and the final verification passes. All sample data is unchanged.

---

## 4. Wipe and restore

```bash
docker compose -f compose.prod.yaml down -v
```

Delete the install directory, copy only `alfheim-setup` and the archive into an
empty one, and run `alfheim-setup restore <archive> --yes`. Expected: the
verification passes, every sample record and object is back, and both users
sign in with their current passwords. Grafana still admits the admin.

---

## 5. Upgrade from the previous release

Install the previous stable tag (`ALFHEIM_VERSION=<previous>`), create sample
data with it, then run `alfheim-setup update --version <candidate>`. Expected:

- every Python service database is stamped and upgraded to its Alembic head
  (see [schema migrations](../explanation/schema-migrations.md)); pantry's
  global unique `ix_products_barcode` is replaced by
  `uq_products_home_barcode` and `uq_products_global_barcode`;
- a maintenance database that still has the pre-UUID tables keeps them, with
  their rows, in the `legacy_maintenance` schema;
- `.env` repairs are reported (`minio` → `rustfs`, `DOCKER_SOCKET_GID`);
- registration is switched off and `alfheim_operator` is created and granted on
  the existing installation;
- all data created with the previous release is still there and writable.
