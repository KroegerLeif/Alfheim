---
title: "ADR 0007: Lean Core App Set"
description: "Infrastructure, the dashboard and the household app always run; every app under apps/ and the telemetry stack are optional modules with one compose profile each."
sidebar:
  label: "0007 Lean Core App Set"
---

* Status: accepted
* Deciders: Alfheim maintainers
* Date: 2026-11-12

Technical Story: [#855](https://github.com/KroegerLeif/Alfheim/issues/855), implemented by #856 to #860

---

## Context and Problem Statement

Every `docker compose up` starts the whole stack: infrastructure, both core apps, all eight apps under `apps/` and the telemetry stack. On a low-spec host (a small home server or a 4 GB VM) this does not fit, and an operator who only wants household management has no way to leave the rest out.

Which parts of Alfheim must always run, and which can an operator switch on and off without losing data?

---

## Decision Drivers

* **Small default footprint:** a fresh install should fit a low-spec host.
* **No data loss:** switching an app off and on again must keep its data.
* **Simple rule:** the split must be visible in the repository, not a list to memorize.
* **Backward compatibility:** existing installs must keep running every app after an update.

---

## Considered Options

* **Option 1: Everything always on** (status quo).
* **Option 2: Lean Core plus optional modules**, split along the `core/` and `apps/` directories.
* **Option 3: Fine-grained per-service toggles** without a fixed core.

---

## Decision Outcome

Chosen option: **Option 2 (Lean Core plus optional modules)**, because it gives a small default, keeps the dependency rules few, and follows the directory layout exactly: everything in `infrastructure/` and `core/` is Lean Core, everything in `apps/` is optional.

### Lean Core (always on, no compose profile)

| Part | Service | Directory |
| --- | --- | --- |
| Core infrastructure | Zitadel (OIDC), Caddy (ingress), `postgres-core`, RustFS | `infrastructure/` |
| Dashboard, the central base | `dashboard` | `core/dashboard` |
| Household management: households, members, roles, invites, contacts | `household` | `core/household` |

### Optional modules (one compose profile each)

| Module | Directory | Compose profile |
| --- | --- | --- |
| `pantry` | `apps/pantry` | `pantry` |
| `shopping` | `apps/shopping` | `shopping` |
| `budget` | `apps/budget` | `budget` |
| `chores` | `apps/chores` | `chores` |
| `library` | `apps/library` | `library` |
| `workout` | `apps/workout` | `workout` |
| `maintenance` | `apps/maintenance` | `maintenance` |
| `chat` | `apps/chat` | `chat` |
| `telemetry` | `infrastructure/telemetry` | `telemetry` |

Telemetry is optional as well and is off by default on a fresh install.

### Rules

* `shopping` requires `pantry`. Enabling `shopping` without `pantry`, or disabling `pantry` while `shopping` is on, is rejected.
* `chat` uses whichever of `pantry`, `chores` and `maintenance` are enabled as MCP servers and must work with none of them.
* Core apps cannot be disabled.
* Disabling a module stops and removes its containers only. It never removes volumes or databases, so enabling it again brings the data back.
* The enabled set is stored as `ALFHEIM_ENABLED_APPS` in `.env`. A missing key means all apps, so installs from before this decision keep their behaviour after an update.
* A fresh install defaults to Lean Core; the operator picks optional modules in the installer.
* The memory target for Lean Core covers infrastructure, the dashboard and the household app only.

### Positive Consequences

* A Lean Core install runs only infrastructure, the dashboard and the household app.
* The split is visible in the repository layout; a new app under `apps/` is optional by default.
* Compose profiles are a native Docker Compose feature, so no generated compose files are needed.

### Negative Consequences & Accepted Costs

* The installer, the Caddyfile renderer and `scripts/up.sh` must all respect the enabled set.
* Every app's database and credentials are still created up front, so a later enable needs no new secrets; a disabled app keeps an idle database.
* Cross-app features must degrade gracefully when the other app is off.

---

## Pros and Cons of the Options

### Option 1: Everything always on

* Good, because there is nothing to configure.
* Bad, because it does not fit low-spec hosts.

### Option 2: Lean Core plus optional modules

* Good, because the rule follows the directory layout.
* Good, because data survives a disable and enable cycle.
* Bad, because several tools must read the enabled set.

### Option 3: Fine-grained per-service toggles

* Good, because it is the most flexible.
* Bad, because an operator could switch off a service the platform cannot work without, such as `household`.
* Bad, because the number of combinations to test grows with every service.
