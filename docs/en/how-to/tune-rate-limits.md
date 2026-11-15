---
title: "Tune the gateway rate limits"
description: "Raise or lower the per-IP request limits Caddy applies to the Zitadel login, the auth host, the APIs and the external lookups."
sidebar:
  label: "Tune rate limits"
---

Caddy limits how many requests one client IP may send per minute. The limits
stop password guessing on the Zitadel login, scripted abuse of the APIs, and
lookups that would burn the quotas of ISBN, BoardGameGeek, TMDB and Open Food
Facts. The [ingress matrix](../reference/ingress-matrix.md#rate-limits) lists
every zone and what it matches.

The defaults suit a household behind one public IP. Change them only when
someone actually hits a limit, or to tighten an instance that is exposed to
the internet.

## Recognise a throttled request

A throttled request gets `429 Too Many Requests` with a `Retry-After` header
(seconds). An app shows its usual error for a failed request; the API body is
`{"error":"rate_limited","message":"Too many requests. Try again in a minute."}`.
The counter is a sliding one-minute window, so access returns on its own
within a minute.

Caddy keeps no access log, so throttled requests do not show up in
`docker logs alfheim_caddy`. Look for status `429` in the browser's developer
tools (Network tab) instead.

## Change a limit

Each limit is a number of requests per minute and client IP, read from the
Caddy container's environment:

| Variable | Default | Applies to |
| :--- | :--- | :--- |
| `ALFHEIM_RATE_LIMIT_LOGIN` | `30` | Form posts to the Zitadel login (`/ui/login/*`): password, MFA, registration |
| `ALFHEIM_RATE_LIMIT_AUTH` | `600` | Every request to the `auth.*` host, including login assets, the console and OIDC calls |
| `ALFHEIM_RATE_LIMIT_API` | `1200` | Every `/api/v1` request on the app host |
| `ALFHEIM_RATE_LIMIT_LOOKUP` | `60` | Library ISBN/BGG/TMDB lookups and pantry barcode lookups |

1. Add the variable to `.env` in the install directory, for example to allow
   more barcode scans per minute:

   ```bash
   ALFHEIM_RATE_LIMIT_LOOKUP=120
   ```

2. Recreate the Caddy container so it picks up the new value:

   ```bash
   docker compose -f compose.prod.yaml up -d caddy
   ```

3. Confirm the value reached the container:

   ```bash
   docker exec alfheim_caddy printenv ALFHEIM_RATE_LIMIT_LOOKUP
   ```

The generated Caddyfile reads these variables, so the change survives
`alfheim-setup --reconfigure` and updates. In the development stack, export the
variable in the shell before `./scripts/up.sh` and pass it through
`infrastructure/caddy/compose.yml`, or edit the default in
`infrastructure/caddy/Caddyfile`.

## Behind another reverse proxy

The limits are keyed by the client IP Caddy sees. When Alfheim sits behind
another proxy or tunnel (a router's reverse proxy, Cloudflare Tunnel), every
visitor arrives with that proxy's IP and they all share one budget. Either
raise the limits so the whole user base fits into them, or make Caddy trust
the proxy's `X-Forwarded-For` header by adding `trusted_proxies` to the global
options of `infrastructure/caddy/Caddyfile`:

```caddyfile
{
	servers {
		trusted_proxies static 192.168.1.10/32
	}
}
```

The installer does not manage this setting, so `alfheim-setup --reconfigure`
overwrites it; add it again after a reconfigure.

## Verify the limits

`./scripts/test-gateway-hardening.sh` starts the Caddy image alone with low
limits and checks that every zone answers 429 above its limit and lets traffic
below it through. It runs in the `smoke-test.yml` workflow.

## Related

- [Ingress matrix: rate limits](../reference/ingress-matrix.md#rate-limits)
- [Environment variables](../reference/environment-variables.md)
