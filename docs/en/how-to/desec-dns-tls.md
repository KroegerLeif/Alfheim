---
title: "Wildcard TLS with deSEC DNS-01"
description: "Issue wildcard certificates via the ACME DNS-01 challenge for an Alfheim instance whose domain is hosted on deSEC — no inbound port 80 required."
---

Use this guide to issue wildcard certificates for an Alfheim instance whose
domain is hosted on [deSEC](https://desec.io), the free, DNSSEC-enabled DNS
hosting service.

The ACME **DNS-01** challenge proves domain ownership by writing a temporary
TXT record rather than by serving a file over HTTP, so **inbound port 80 is not
required**. The general procedure matches
[Wildcard TLS with Hetzner DNS-01](./hetzner-dns-tls.md); only the token and the
Caddyfile syntax differ.

---

## Prerequisites

* A domain whose nameservers point at deSEC (`ns1.desec.io`, `ns2.desec.org`).
* An account at [desec.io](https://desec.io/login).

## Step 1: Create an API token

1. Sign in to the deSEC web interface.
2. Open **Token Management** and select **+** to create a token.
3. Give it a recognisable name, for example `alfheim-acme`.
4. Copy the token immediately — deSEC shows it only once.

deSEC tokens can be restricted with token scoping policies. To limit the blast
radius, allow write access only to `_acme-challenge` TXT records of your domain.

## Step 2: Point your domain at the host

Create two A records (or AAAA for IPv6) for your domain in deSEC:

| Type | Name   | Value            |
| :--- | :----- | :--------------- |
| A    | `@`    | your server's IP |
| A    | `auth` | your server's IP |

## Step 3: Run the installer with the token

Interactively, choose **deSEC DNS-01 (wildcard)** and paste the token when
prompted. Headless:

```bash
alfheim-setup --non-interactive \
  --domain example.com \
  --tls desec \
  --api-token "$DESEC_TOKEN" \
  --admin-email ops@example.com
```

The token is written to `.env` as `DESEC_TOKEN` and referenced from the
Caddyfile as `{env.DESEC_TOKEN}`. The deSEC module only accepts the token as a
block subdirective:

```caddyfile
{
	admin off
	email ops@example.com
	acme_dns desec {
		token {env.DESEC_TOKEN}
	}
}
```

The rendered Caddyfile therefore never contains the token itself.

## Step 4: Watch the first issuance

```bash
docker compose -f compose.prod.yaml logs -f caddy
```

Success looks like:

```
certificate obtained successfully  {"identifier": "example.com"}
```

## Verify

```bash
echo | openssl s_client -connect auth.example.com:443 -servername auth.example.com 2>/dev/null \
  | openssl x509 -noout -issuer -dates
```

The issuer should be Let's Encrypt, with a validity window starting today.

---

## Troubleshooting

**`missing token`**
`DESEC_TOKEN` is empty inside the gateway container. Check `.env` and restart
the gateway with `docker compose -f compose.prod.yaml up -d caddy`.

**Certificate issuance times out**
deSEC rate-limits record changes and propagates them to its anycast network
within about a minute. Confirm the challenge record appears:

```bash
dig +short TXT _acme-challenge.example.com @ns1.desec.io
```

If nothing appears, the token lacks write access to the zone, or a scoping
policy blocks `_acme-challenge` TXT records.

**`module not registered: dns.providers.desec`**
The gateway runs an image built before deSEC support was added. Pull or
rebuild it: `docker compose -f compose.prod.yaml pull caddy` or
`docker compose -f compose.prod.yaml build caddy`.

## Rotating the token

1. Create a replacement token in deSEC.
2. Update `DESEC_TOKEN` in `.env`.
3. Restart the gateway: `docker compose -f compose.prod.yaml up -d caddy`.
4. Delete the old token.

## See also

* [Wildcard TLS with Hetzner DNS-01](./hetzner-dns-tls.md)
* [Installer CLI reference](../reference/installer-cli.md)
* [Secrets hardening](./secrets-hardening.md)
