---
title: "Run Alfheim on low-spec hardware"
description: "Install the Lean Core on a small host (2 to 4 GB RAM), keep telemetry off and add apps one at a time."
sidebar:
  label: "Low-spec setup"
---

This guide gets Alfheim running on a small host, such as a 2 GB VM, a Raspberry Pi 4 or an
old mini PC. You install the Lean Core first and add apps only as the memory allows.

The memory each tier needs is listed once, in the
[hardware specifications](./homelab-deployment.md#hardware-specifications). Pick your tier
there before you start.

## Before you start

- A Linux host (x86_64 or arm64) with Docker Engine 25 or newer and the Compose v2 plugin.
- At least 2 GB of RAM for the Lean Core. Add swap if the host has 4 GB or less:

  ```bash
  sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

- An SSD. PostgreSQL and the container images are slow on an SD card.

## 1. Install the Lean Core

A fresh install runs the Lean Core by default: Caddy, PostgreSQL, Zitadel, RustFS, the
dashboard and household management. Nothing else starts until you enable it.

Interactively, run the installer as in the [first-run tutorial](../tutorials/first-run.md) and,
in the wizard:

1. Leave every box in **Optional apps** unticked. Each line shows the memory the app adds.
2. Answer **No** to **Enable telemetry?** (the default). Telemetry adds 448 MB.

Non-interactively, pass `--apps none`:

```bash
alfheim-setup --non-interactive --domain example.com --tls internal \
  --admin-email you@example.com --apps none
```

Telemetry stays off unless you list it, so `--apps none` also leaves out Grafana and the
metrics and log stores. `OTEL_ENABLED=false` in `.env` keeps the backends from exporting
traces.

## 2. Check the memory use

```bash
alfheim-setup apps list
docker stats --no-stream
```

`apps list` shows every app as `enabled` or `disabled`. `docker stats` shows what each
container uses now. On an idle Lean Core the sum stays near the 752 MB reserved in
`compose.prod.yaml`; each container's limit is about twice its reservation.

## 3. Add apps one at a time

Enable the app you need most, then check `docker stats` again before adding the next one:

```bash
alfheim-setup apps enable pantry
```

Useful orders:

- **Kitchen first:** `pantry`, then `shopping`. Shopping requires pantry, so it cannot be
  enabled before it.
- **Chores or budget only:** each runs on its own and adds 240 MB.
- **Chat last:** the ALFI assistant only offers tools of the apps that are enabled, so it is
  most useful once the apps it talks to (pantry, chores, maintenance) run.

Leave telemetry for last, or skip it on a host below 6 GB. When you want it, follow
[Turn telemetry on](./grafana-access.md#turn-telemetry-on).

After a change, run `alfheim-setup update` once so the dashboard picks up the new set; see
[Manage apps](./manage-apps.md#what-changes-when-you-switch-an-app).

## 4. Tune PostgreSQL for small hosts (optional)

`postgres-core` reads three memory settings from `.env`: `POSTGRES_SHARED_BUFFERS`,
`POSTGRES_MAX_CONNECTIONS` and `POSTGRES_WORK_MEM`. Their defaults suit the Lean Core. Lower
them only if PostgreSQL is the container closest to its limit, then recreate it:

```bash
docker compose -f compose.prod.yaml up -d postgres-core
```

The values and defaults are in the
[environment variable reference](../reference/environment-variables.md#postgresql-database-credentials).

## If memory runs out

- `docker stats` shows a container at its limit, or `docker ps` shows it restarting: disable
  the app you added last with `alfheim-setup apps disable <name>`. Its data is kept.
- The host swaps constantly: move to the next tier in the
  [hardware table](./homelab-deployment.md#hardware-specifications) or disable apps.

## Related

- [Manage apps](./manage-apps.md)
- [ADR 0007: Lean Core app set](../explanation/decisions/0007-lean-core-app-set.md)
- [Installer CLI reference](../reference/installer-cli.md)
