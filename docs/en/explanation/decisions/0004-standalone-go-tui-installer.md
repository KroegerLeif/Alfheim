---
title: "ADR 0004: Standalone Interactive Installer as a Typed Go TUI"
description: "Technical Story: #353 Interactive Standalone Setup Installer (Go + Charm Huh?)"
sidebar:
  label: "0004 Go TUI Installer"
---

* Status: accepted
* Deciders: Alfheim Core Maintainers
* Date: 2026-09-12

Technical Story: [#353 Interactive Standalone Setup Installer (Go + Charm Huh?)](https://github.com/KroegerLeif/Alfheim/issues/353)

---

## Context and Problem Statement

Setting up a new Alfheim instance on a fresh Debian or Proxmox host required an
operator to hand-write `.env` files, generate secrets manually, and edit the
Caddy reverse-proxy configuration by hand. The existing `scripts/install.sh`
automated part of this, but it had grown to roughly 500 lines of Bash, still
orchestrated Keycloak after [ADR 0003](./0003-migrate-from-keycloak-to-zitadel.md)
replaced it with Zitadel, and was effectively untestable.

Three problems compounded this:

1. **No type safety or tests.** Secret generation, TLS strategy selection and
   the multi-phase container boot were all untested string manipulation.
2. **A bootstrapping cycle around Zitadel.** Application services cannot verify
   an OIDC token until an administrator exists in Zitadel, but that
   administrator can only be created through a browser once Zitadel is up and
   holds a valid certificate. A single `docker compose up -d` cannot express
   this ordering.
3. **No zero-clone path.** Installing required cloning the whole monorepo onto
   the server, even though only a handful of files are needed at runtime.

---

## Decision Drivers

* Deterministic, testable installation logic behind a ≥ 80 % coverage gate.
* A single-command bootstrap that works over `curl … | bash` on a bare host.
* Explicit, auditable handling of secrets and TLS private keys.
* Alignment with the repository's Feature-Driven Design conventions.
* Idempotence: re-running the installer must never destroy a working instance.

---

## Considered Options

* **Option 1: Extend the existing Bash installer.**
* **Option 2: Ansible playbook or cloud-init.**
* **Option 3: A standalone Go CLI with a Charm `huh` TUI.**

---

## Decision Outcome

Chosen option: **Option 3**, because it is the only option that makes the
installation logic unit-testable while still producing a single static binary
that runs on a bare host with no runtime dependencies.

The installer lives at `tools/installer` as its own Go module, registered in
the root `go.work` workspace.

### Structure

Feature slices under `internal/features/` own one concern each — `onboarding`,
`security`, `tls`, `templating`, `bootstrap` — and shared abstractions live
under `internal/shared/`, matching the layout already used by
`core/dashboard/backend`.

> **Deviation from the issue.** Issue #353 proposed `internal/core/`. We use
> `internal/shared/` instead, because that is the established convention in
> every existing Alfheim Go service, and a second name for the same concept
> would be a needless inconsistency.

### Decoupled Zitadel bootstrapping

The container boot is split into two explicit phases:

1. **Edge & Identity** — `postgres-core`, `caddy`, `zitadel`. Caddy obtains the
   certificate for `auth.<domain>`, and the wizard then pauses and asks the
   operator to create the initial administrator.
2. **Core & Application Stack** — everything else, started only after the
   operator confirms.

The pause is modelled as an injected `ConfirmFunc`, so a headless run can skip
it and tests can assert that phase 2 never begins before confirmation.

### Mockable process execution

Every external command goes through a `runner.Runner` interface. `ExecRunner`
is production, `RecordingRunner` asserts exact Docker Compose sequences without
a daemon, and `DryRunRunner` implements `--dry-run` as a decorator so no
conditional branches leak into the orchestrator.

### Custom Caddy image

The upstream `caddy:2-alpine` image ships **no ACME DNS provider modules**, so
the Hetzner and Cloudflare DNS-01 strategies cannot work with it. Caddy is
therefore built from `infrastructure/caddy/Dockerfile` with `xcaddy`, including
`caddy-dns/hetzner` and `caddy-dns/cloudflare`. The build asserts both modules
are present, so a broken image fails at build time rather than at certificate
renewal time.

DNS API tokens are written to `.env` and referenced from the Caddyfile as
`{env.HETZNER_API_TOKEN}`. The rendered Caddyfile therefore never contains a
credential, which a test enforces.

### Positive Consequences

* Secret generation, TLS path validation, templating and the boot sequence are
  covered by unit tests at over 90 % statement coverage.
* Golden-file tests pin the rendered `.env` and `Caddyfile` for all four TLS
  strategies, and the rendered Caddyfiles are validated against a real Caddy
  binary.
* `--dry-run` renders a complete configuration into a temporary directory
  without touching an existing installation or starting a container.
* A single static binary per architecture, fetched and checksum-verified by the
  root `install.sh`.
* Re-running defaults to a Day-2 update; secrets are only ever regenerated for
  a genuinely new installation.

### Negative Consequences & Accepted Costs

* **The ingress gateway is now a custom image we must build and publish.** This
  adds a job to the release pipeline and makes us responsible for tracking
  upstream Caddy releases.
* **Go is now required to modify the installer**, raising the barrier for a
  quick fix compared to editing Bash.
* **The TUI needs a real terminal.** `install.sh` reattaches stdin to
  `/dev/tty` so that `curl … | bash` still works; without that the wizard would
  exit immediately.
* A second installer path existed until `scripts/install.sh` was removed; the
  root `install.sh` is now the only supported entry point.

---

## Pros and Cons of the Options

### Option 1: Extend the existing Bash installer

* Good, because it needs no new toolchain and every maintainer can read it.
* Good, because it is already wired into the release artefacts.
* Bad, because secret generation and TLS branching remain untestable, so the
  80 % coverage gate cannot be met.
* Bad, because it had already drifted out of sync with ADR 0003 while still
  being the documented installation path.

### Option 2: Ansible playbook or cloud-init

* Good, because it is declarative and idempotent by construction.
* Good, because it scales to more than one host.
* Bad, because it requires Python and Ansible on the control machine, which
  defeats the single-command bootstrap on a bare server.
* Bad, because an interactive wizard is awkward to express, and the Zitadel
  pause step is genuinely interactive.

### Option 3: Standalone Go CLI with Charm `huh`

* Good, because the logic is typed, unit-testable and lint-checked in CI.
* Good, because `CGO_ENABLED=0` produces a dependency-free static binary for
  `linux/amd64` and `linux/arm64`.
* Good, because `go:embed` makes the binary self-contained, so no repository
  clone is needed on the target host.
* Bad, because it introduces a compiled artefact that must be built, checksummed
  and published on every release.
* Bad, because the TUI needs terminal handling that plain scripts avoid.
