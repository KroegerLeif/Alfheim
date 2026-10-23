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
	cert_issuer acme {
		dns desec {
			token {env.DESEC_TOKEN}
		}
		propagation_delay 90s
		propagation_timeout 10m
		resolvers ns1.desec.io ns2.desec.org
	}
}
```

deSEC needs up to a minute to publish a record on all of its nameservers and
enforces a minimum TTL of 3600 seconds. `propagation_delay` makes Caddy wait
before it asks Let's Encrypt to validate, and `resolvers` checks propagation
against deSEC's own nameservers instead of a caching resolver.

The rendered Caddyfile therefore never contains the token itself.

Before any container starts, the installer asks the deSEC API whether the
token is accepted and whether its account holds the zone for both hosts. A
rejected token or a missing zone stops the install with a clear message.
Leftover `_acme-challenge` records from an earlier attempt are reported as a
warning.

## Step 4: Watch the first issuance

After starting Caddy, the installer waits up to ten minutes per host for a
valid certificate (*Phase: Certificates*) before it configures Zitadel. Follow
the issuance in a second shell:

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

**Issuance keeps failing, and `_acme-challenge` holds several TXT values**
An earlier attempt was validated before the record had propagated. Let's
Encrypt's resolver then caches the stale answer for the record's TTL (3600
seconds on deSEC), so every retry within that hour fails as well. Stop Caddy,
delete the leftover records, wait an hour, then start Caddy again:

```bash
docker compose -f compose.prod.yaml stop caddy
TOKEN=$(grep '^DESEC_TOKEN=' .env | cut -d= -f2-)
curl -X DELETE -H "Authorization: Token $TOKEN" \
  https://desec.io/api/v1/domains/example.com/rrsets/_acme-challenge.auth/TXT/
# one hour later
docker compose -f compose.prod.yaml start caddy
```

Repeat the `DELETE` for the app host's `_acme-challenge` name. Once both
certificates are issued, re-run `alfheim-setup`; existing secrets are kept.

**The installer stops with `no valid certificate for <host>`**
The ACME challenge did not complete within ten minutes. The error includes the
`docker logs` command to see Caddy's reason; the entry above covers the most
common one.

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
