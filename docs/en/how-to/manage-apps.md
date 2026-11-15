---
title: "Manage apps"
description: "List, enable and disable the optional Alfheim apps and the telemetry module on an existing installation."
sidebar:
  label: "Manage apps"
---

Alfheim always runs the Lean Core (infrastructure, dashboard, household management). Every
app under `apps/` and the telemetry stack are optional and can be switched on and off at any
time with `alfheim-setup apps`. Run every command from the installation directory, or add
`--install-dir DIR`.

## See what is enabled

```bash
alfheim-setup apps list
```

The output lists every app with its tier, its state and its requirements:

```text
APP          TIER      STATE     NOTES
dashboard    core      enabled
household    core      enabled
pantry       optional  enabled
shopping     optional  disabled  requires pantry
...
```

The enabled set is stored as `ALFHEIM_ENABLED_APPS` in `.env`. An `.env` without that key, for
example one from before the Lean Core, counts as "every app enabled".

## Enable an app

```bash
alfheim-setup apps enable budget
```

The command records the app in `.env`, creates its database if it is missing, pulls and starts
its containers, waits until they are healthy, then adds its routes to the Caddyfile and restarts
Caddy. Enabling an app that is already enabled does nothing.

Check the memory headroom first: each app adds 176 to 288 MB of reserved memory, listed in the
[apps catalog](../reference/apps-catalog.md) and summed per tier in the
[hardware specifications](./homelab-deployment.md#hardware-specifications).

## Disable an app

```bash
alfheim-setup apps disable budget
```

The command records the change, then stops and removes the app's containers. **Its volumes and
its database are kept**, so `alfheim-setup apps enable budget` later brings back the same data.
To delete an app's data for good, take a backup and drop its database by hand; the installer
never does it.

Core apps (`dashboard`, `household`) cannot be disabled.

## Dependencies

An app can require another one. Today the only rule is that **shopping requires pantry**:

- `apps enable shopping` fails while pantry is disabled. Enable pantry first.
- `apps disable pantry` fails while shopping is enabled. Disable shopping first.

A rejected change exits with code `1`, names the conflict and changes nothing. The chat
assistant has no hard requirement; it offers tools only from the enabled apps that have an MCP
server (pantry, chores, maintenance).

## Turn telemetry on or off

Telemetry (metrics, logs and Grafana) is toggled like an app:

```bash
alfheim-setup apps enable telemetry
alfheim-setup apps disable telemetry
```

This also sets `OTEL_ENABLED` in `.env`. Turning it on needs one more step to create the
Grafana sign-in client; follow [Turn telemetry on](./grafana-access.md#turn-telemetry-on).

## What changes when you switch an app

| Area | Enabled app | Disabled app |
| :--- | :--- | :--- |
| Containers | Running, started with the app's compose profile | Removed; volumes and database kept |
| Ingress | `/<app>` and its API routes proxy to the app | API paths answer `404`, `/<app>` redirects to the dashboard ([details](../reference/ingress-matrix.md#routes-of-disabled-apps)) |
| Dashboard tile | Shown | Hidden |
| Later updates | `alfheim-setup update`, a re-run and `restore` start it | None of them starts it |

`apps enable|disable` applies the containers and the Caddyfile at once. The dashboard backend
(`ALFHEIM_ENABLED_APPS`) and the chat backend (`CHAT_MCP_SERVERS`) read the enabled set only
when their containers are created, so the dashboard tile and ALFI's tool list follow the change
after their next recreation. Trigger it once after you are done switching apps:

```bash
alfheim-setup update
```

Use the `alfheim-setup` binary of your installed release: without `--version`, `update`
targets the binary's own version, so it stays on that release, backs up the databases,
recreates the containers whose configuration changed and verifies the stack.

## Related

- [Run Alfheim on low-spec hardware](./low-spec-setup.md)
- [Installer CLI reference: the `apps` subcommand](../reference/installer-cli.md#the-apps-subcommand)
- [ADR 0007: Lean Core app set](../explanation/decisions/0007-lean-core-app-set.md)
