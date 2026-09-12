---
title: "Secrets Hardening"
description: "Generate, store and rotate the secrets an Alfheim instance depends on, and verify that no development fallback reaches production."
sidebar:
  label: "Secrets Hardening"
---

Use this guide before exposing an Alfheim instance beyond your own machine. It
covers where secrets come from, where they are allowed to live, and how to
confirm that no development fallback value reached production.

> Ongoing hardening work is tracked in
> [issue #359](https://github.com/KroegerLeif/Alfheim/issues/359), not in this
> document.

---

## Where secrets come from

Never write a secret by hand. Both supported installation paths generate every
credential from a cryptographic random source:

```bash
# Interactive installer (recommended)
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash

# Or, for a manual installation, from the repository root
./scripts/init-env.sh
```

Either writes a `.env` with mode `0600` containing:

| Variable | Purpose |
| :--- | :--- |
| `POSTGRES_PASSWORD`, `<app>_DB_PASSWORD` | Per-service database owners on `postgres-core` |
| `ZITADEL_MASTERKEY` | Encrypts Zitadel's data at rest. Exactly 32 characters. |
| `ZITADEL_ADMIN_PASSWORD` | Initial IAM administrator |
| `CHAT_ENCRYPTION_KEY` | 32-byte base64 key securing LLM API keys at rest with AES-256-GCM |
| `S3_SECRET_KEY` | RustFS object storage |
| `GRAFANA_ADMIN_PASSWORD` | Observability UI |
| `HETZNER_API_TOKEN` / `CLOUDFLARE_API_TOKEN` | ACME DNS-01, only when that TLS strategy is chosen |

---

## Where secrets are allowed to live

**In `.env`, and nowhere else.**

Two rules follow from that:

**Development Compose files carry fallback values.** `core/dashboard/compose.yml`
and `apps/*/compose.yml` provide defaults so a fresh checkout runs without
setup. These are convenience values, not secrets. A production deployment must
source `.env` explicitly so every one of them is overridden.

**Rendered configuration must not embed secrets.** The Caddyfile references
ACME tokens as `{env.HETZNER_API_TOKEN}` rather than inlining them, which keeps
it safe to attach to a support request or a configuration backup. Preserve that
property in anything you add.

---

## Verify before exposing the instance

### 1. No development fallback survived

```bash
grep -E '(password|secret|key|token)' .env | grep -iE 'changeme|postgres$|admin$|Password1!|super_secret'
```

Any match is a value the generator did not replace. Regenerate rather than
editing by hand:

```bash
./scripts/init-env.sh --force
```

### 2. File permissions

```bash
stat -c '%a %n' .env
```

Expect `600`. The installer sets this; a restore from backup often does not.

### 3. Containers run unprivileged

```bash
docker compose -f compose.prod.yaml config | grep -c 'user:'
```

All Go and Python backends declare `USER appuser` in their Dockerfiles.

### 4. Full verification suite

```bash
./scripts/verify.sh --security
```

---

## Rotating a secret

1. Stop the stack: `docker compose -f compose.prod.yaml stop`
2. Replace the value in `.env`.
3. Restart: `docker compose -f compose.prod.yaml up -d`

Two exceptions:

* **`ZITADEL_MASTERKEY` cannot be rotated in place.** It encrypts existing
  Zitadel data; changing it makes that data unreadable. Rotating it means
  re-bootstrapping the identity provider.
* **`CHAT_ENCRYPTION_KEY` cannot be rotated in place** without first
  re-encrypting stored LLM API keys. Clear them in the chat settings, rotate,
  then re-enter them.

Database passwords must be changed in PostgreSQL as well as in `.env`:

```bash
docker exec -it alfheim_postgres_core \
  psql -U postgres -c "ALTER USER pantry_user WITH PASSWORD 'new-password';"
```

---

## Telemetry endpoints

Grafana and the VictoriaStack components are reachable through the gateway. If
the instance is exposed beyond a trusted network, confirm before going live that:

* `GRAFANA_ADMIN_PASSWORD` is set from `.env` and is not the template default.
* Grafana OIDC SSO is configured against Zitadel, so the local admin account is
  a break-glass path rather than the normal one.

---

## See also

* [Use Your Own TLS Certificates](./custom-certificates.md)
* [Wildcard TLS with Hetzner DNS-01](./hetzner-dns-tls.md)
* [Backup, Restore & Data Migration](./backup-restore.md)
* [Authentication & Multi-Tenancy Model](../explanation/authentication-security.md)
