---
title: "Wildcard TLS with Hetzner DNS-01"
description: "Issue wildcard certificates via the ACME DNS-01 challenge for an Alfheim instance whose domain is hosted on Hetzner DNS — no inbound port 80 required."
---

Use this guide to issue wildcard certificates for an Alfheim instance whose
domain is hosted on Hetzner DNS.

The ACME **DNS-01** challenge proves domain ownership by writing a temporary
TXT record rather than by serving a file over HTTP. That means:

* You get a wildcard certificate (`*.example.com`), covering `auth.example.com`
  and every future subdomain with one certificate.
* **Inbound port 80 is not required**, so this works behind a restrictive
  firewall or a carrier-grade NAT.

> Hosting DNS on Cloudflare instead? The procedure is identical — choose
> *Cloudflare DNS-01* and create a token with `Zone:DNS:Edit` permission.

---

## Prerequisites

* A domain whose nameservers point at Hetzner DNS.
* Access to the [Hetzner DNS Console](https://dns.hetzner.com/).

## Step 1: Create an API token

1. Sign in to the Hetzner DNS Console.
2. Open the profile menu and choose **API tokens**.
3. Select **Create access token** and give it a recognisable name, for example
   `alfheim-acme`.
4. Copy the token immediately — Hetzner shows it only once.

The Hetzner DNS API issues account-wide tokens; they cannot be scoped to a
single zone. Treat the token as a credential that can edit every DNS record in
your account, and store it only in the generated `.env`.

## Step 2: Point your domain at the host

Create two A records (or AAAA for IPv6) in the Hetzner DNS Console:

| Type | Name   | Value            |
| :--- | :----- | :--------------- |
| A    | `@`    | your server's IP |
| A    | `auth` | your server's IP |

DNS-01 does not need these records to issue a certificate, but visitors do need
them to reach the instance.

## Step 3: Run the installer with the token

Interactively, choose **Hetzner DNS-01 (wildcard)** and paste the token when
prompted. Headless:

```bash
alfheim-setup --non-interactive \
  --domain example.com \
  --tls hetzner \
  --api-token "$HETZNER_API_TOKEN" \
  --admin-email ops@example.com
```

The token is written to `.env` as `HETZNER_API_TOKEN` and referenced from the
Caddyfile as `{env.HETZNER_API_TOKEN}`:

```caddyfile
{
	admin off
	email ops@example.com
	acme_dns hetzner {env.HETZNER_API_TOKEN}
}
```

The rendered Caddyfile therefore never contains the token itself, and stays
safe to copy into a support request or a configuration backup.

## Step 4: Watch the first issuance

The first certificate takes a minute or two, because Caddy must wait for the
TXT record to propagate:

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

**`could not determine zone for domain`**
The token cannot see the zone. Confirm the domain is actually hosted in the
Hetzner DNS Console, and that you created the token under the same account.

**Certificate issuance times out**
TXT propagation is slow. Confirm the challenge record appears:

```bash
dig +short TXT _acme-challenge.example.com
```

If nothing appears, the token lacks write access or the zone is served by
different nameservers.

**`unrecognized directive: acme_dns`**
The gateway is running the stock Caddy image, which has no DNS provider
modules. Alfheim builds its own from `infrastructure/caddy/Dockerfile`; rebuild
it with `docker compose -f compose.prod.yaml build caddy`. See
[ADR 0004](../explanation/decisions/0004-standalone-go-tui-installer.md).

## Rotating the token

1. Create a replacement token in the Hetzner DNS Console.
2. Update `HETZNER_API_TOKEN` in `.env`.
3. Restart the gateway: `docker compose -f compose.prod.yaml up -d caddy`.
4. Delete the old token.

No certificate is reissued — Caddy reuses the existing one until renewal.

## See also

* [Custom certificates](./custom-certificates.md)
* [Installer CLI reference](../reference/installer-cli.md)
* [Secrets hardening](./secrets-hardening.md)
