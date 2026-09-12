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
| `--non-interactive` | Take every answer from flags and environment variables instead of the wizard. The manual Zitadel pause is skipped; the URL is printed instead. |
| `--reconfigure` | Re-run the wizard over an existing installation. **Existing secrets are preserved, never rotated.** |
| `--install-dir DIR` | Installation root. Default: the current working directory. |
| `--version` | Print build metadata and exit, before any host inspection. |

## Configuration flags

Each flag has an environment-variable equivalent. The flag wins when both are set.

| Flag | Environment variable | Description |
| :--- | :--- | :--- |
| `--domain HOST` | `ALFHEIM_DOMAIN` | Base domain, e.g. `example.com`. **Required** in non-interactive mode. |
| `--app-host HOST` | `ALFHEIM_APP_HOST` | Host serving the dashboard. Defaults to the base domain. |
| `--admin-email MAIL` | `ALFHEIM_ADMIN_EMAIL` | ACME contact and Zitadel administrator contact. |
| `--tls STRATEGY` | `ALFHEIM_TLS_STRATEGY` | `hetzner`, `cloudflare`, `custom` or `internal`. **Required** in non-interactive mode. |
| `--api-token TOKEN` | `ALFHEIM_DNS_API_TOKEN`, `HETZNER_API_TOKEN`, `CLOUDFLARE_API_TOKEN` | DNS provider token. Required for `hetzner` and `cloudflare`. |
| `--cert-path DIR` | `ALFHEIM_CERT_PATH` | Absolute directory holding `fullchain.pem` and `privkey.pem`. Only for `--tls custom`; omit to use `./data/caddy/certs/`. |
| `--image-tag TAG` | `ALFHEIM_IMAGE_TAG` | Container image tag. Default `latest`. |
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
| `custom` | Supplied by you | Not required | Needs `fullchain.pem` and `privkey.pem`. |
| `internal` | Caddy's internal CA | Not required | Self-signed; browsers warn until the root is trusted. |

See [Hetzner DNS-01](../how-to/hetzner-dns-tls.md) and
[Custom certificates](../how-to/custom-certificates.md).

---

## Operating modes

The mode is detected from the installation directory, not chosen by a flag.

| Detected state | Mode | Behaviour |
| :--- | :--- | :--- |
| No `.env`, no `.alfheim.installed` | **install** | Full wizard, secret generation, two-phase boot. |
| Either file present | **update** | Pull images and restart. No wizard, no secret changes. |
| Either file present, plus `--reconfigure` | **reconfigure** | Wizard re-runs; existing secrets are preserved. |

> **Why secrets are never rotated.** Regenerating `ZITADEL_MASTERKEY` on a
> configured instance makes its database permanently unreadable. Every value
> already present in `.env` is carried forward; only genuinely missing ones are
> generated.

---

## Two-phase bootstrap

| Phase | Services | Waits for |
| :--- | :--- | :--- |
| 1 — Edge & Identity | `postgres-core`, `caddy`, `zitadel` | `alfheim_postgres_core` (120 s), `alfheim_caddy` (90 s), `alfheim_zitadel` (300 s) |
| *pause* | — | The operator creates the Zitadel administrator |
| 2 — Core & Application Stack | all remaining | `dashboard-backend` (240 s), `dashboard-frontend` (180 s) |

The pause is skipped under `--non-interactive`.

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
* [Environment variables](./environment-variables.md)
* [CLI scripts](./cli-scripts.md)
* [ADR 0004](../explanation/decisions/0004-standalone-go-tui-installer.md)
