---
title: "Your First Alfheim Installation"
description: "Install Alfheim on a fresh Debian 12 host and end up with a running dashboard, identity provider and ingress gateway."
sidebar:
  label: "First Run"
---

This tutorial walks you through installing Alfheim on a fresh Debian 12 host —
a bare-metal server, a Proxmox VM, or an LXC container. By the end you will
have a running instance with a working dashboard, identity provider and
ingress gateway.

Allow about 30 minutes, most of which is spent waiting for container images.

> **Tutorial, not reference.** This page takes one opinionated path. For every
> flag and option, see [the installer CLI reference](../reference/installer-cli.md).

---

## Before you start

You need:

* A Debian 12 (or comparable) host with at least 4 GB RAM and 10 GB free disk.
* Root or `sudo` access.
* A domain you control, with DNS pointing at the host. This tutorial uses
  `example.com`; substitute your own throughout.

## Step 1: Install Docker

The installer needs Docker Engine and the Compose v2 plugin:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Verify both are present:

```bash
docker info && docker compose version
```

If `docker info` fails with a permission error, add yourself to the `docker`
group and open a new login shell:

```bash
sudo usermod -aG docker "$USER"
```

## Step 2: Choose an installation directory

Alfheim keeps its configuration, generated secrets and persistent data
together in one directory:

```bash
mkdir -p ~/alfheim && cd ~/alfheim
```

## Step 3: Run the installer

```bash
curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

The script detects your CPU architecture, downloads the matching
`alfheim-setup` binary, verifies its SHA-256 checksum and starts the wizard.

> **Why this works when piped into `bash`.** The script reattaches its input to
> `/dev/tty` before handing over, so the full-screen wizard still finds a
> terminal.

## Step 4: Answer the wizard

The wizard asks four things:

1. **Deployment target.** Choose *Custom domain* and enter `example.com`. The
   dashboard host defaults to your base domain; the identity provider is always
   placed at `auth.example.com`.
2. **Administrator e-mail.** Becomes the login name of the Zitadel
   administrator and the ACME contact.
3. **Certificate strategy.** Choose *Hetzner DNS-01* or *Cloudflare DNS-01* if
   your domain is hosted there — this issues wildcard certificates and needs no
   inbound port 80. Otherwise choose *Custom certificates*, or *Caddy internal
   CA* for a LAN-only install.
4. **DNS API token**, if you chose a DNS-01 strategy. See
   [Hetzner DNS-01 TLS](../how-to/hetzner-dns-tls.md) for how to create one.

The installer then generates every credential from `crypto/rand` and writes:

* `.env` — all configuration and secrets, mode `0600`
* `infrastructure/caddy/Caddyfile` — the rendered ingress configuration

## Step 5: Let the installer finish

The installer starts the database, the ingress gateway and Zitadel, waits for
all three to become healthy, and then provisions Zitadel on its own: it creates
the `Alfheim` project, one sign-in client for the dashboard and every app, and a
client for Grafana, and writes their IDs into `.env`. It then pulls and starts
the remaining services and prints your access URLs and the administrator login:

```
Alfheim is up.

  Dashboard       https://example.com
  Identity        https://auth.example.com
  Observability   https://example.com/grafana/

  Administrator login
    E-mail (login name):  you@example.com
    Password:              <generated> (also in .env, ZITADEL_ADMIN_PASSWORD)
    A password change is required on first login.
```

You do not need to register an account or open the Zitadel console. The
administrator e-mail is already verified, so no mail is sent.

## Step 6: Verify

```bash
docker compose -f compose.prod.yaml ps
```

Every service should report `running`, and those with a healthcheck should
report `healthy`. Open the dashboard URL and sign in with your Zitadel account.

---

## What you built

* A full Alfheim instance with unique, randomly generated credentials.
* A TLS-terminating ingress gateway with certificates for your domain.
* A Zitadel identity provider with an administrator account.

## Next steps

* [Hetzner DNS-01 TLS](../how-to/hetzner-dns-tls.md) — wildcard certificates
* [Custom certificates](../how-to/custom-certificates.md) — bring your own
* [Installer CLI reference](../reference/installer-cli.md) — every flag
* [Backup and restore](../how-to/backup-restore.md) — protect your data

## Updating later

Re-running the installer in the same directory detects the existing
installation and switches to an update: it pulls new images and restarts, and
never regenerates your secrets.

```bash
cd ~/alfheim && curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
```

To change the configuration itself, add `--reconfigure`.
