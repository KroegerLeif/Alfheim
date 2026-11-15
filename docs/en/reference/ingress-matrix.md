---
title: "Caddy Gateway Ingress & Routing Matrix"
description: "Master routing specification for the central Caddy reverse-proxy gateway (infrastructure/caddy), defining public domains, subpath mappings, and backend path."
sidebar:
  label: "Ingress Matrix"
---

> **TL;DR:** Master routing specification for the central Caddy reverse-proxy gateway (`infrastructure/caddy`), defining public domains, subpath mappings, and backend path stripping rules.

---

## 📋 Table of Contents
- [Gateway Overview & Domains](#gateway-overview--domains)
- [Frontend Domain Routing (`alfheim.loegien.localhost`)](#frontend-domain-routing-alfheimloegienlocalhost)
- [FastAPI OpenAPI documents](#fastapi-openapi-documents)
- [Auth Domain Routing (`auth.alfheim.loegien.localhost`)](#auth-domain-routing-authalfheimloegienlocalhost)
- [API Gateway Domain Routing (`api.alfheim.loegien.localhost`)](#api-gateway-domain-routing-apialfheimloegienlocalhost)
- [Installer-Generated App Host: Household & Internal Routes](#installer-generated-app-host-household--internal-routes)
- [Response Security Headers](#response-security-headers)
- [Routes of Disabled Apps](#routes-of-disabled-apps)
- [Stopped Apps and Upstream Health Checks](#stopped-apps-and-upstream-health-checks)
- [Installer-Generated Route Table](#installer-generated-route-table)

---

## Gateway Overview & Domains

Traffic entering Alfheim passes through a central Caddy ingress proxy (`infrastructure/caddy`).

* **Frontend Domain**: `alfheim.loegien.de` / `alfheim.loegien.localhost`
* **API Gateway Domain**: `api.alfheim.loegien.de` / `api.alfheim.loegien.localhost`

The tables below list the development stack (`scripts/up.sh`), which serves the `*.localhost` hosts over plain HTTP. Chromium and Firefox treat `localhost` names as a secure context, so sign-in works there. Installer-generated deployments serve every host over HTTPS with the certificate strategy chosen at install time:

| TLS strategy | Certificates | Browser trust |
| :--- | :--- | :--- |
| `hetzner`, `cloudflare`, `desec` | Let's Encrypt wildcard via DNS-01 | Trusted |
| `custom` | Your own PEM files | Depends on the issuing CA |
| `internal` (also the LAN `.localhost` preset) | Signed by the installer's root CA (Caddy CA id `alfheim`, root mounted read-only from `infrastructure/caddy/pki/`) | Warns until [the local root CA is trusted](../how-to/trust-local-root-ca.md) |

---

## Frontend Domain Routing (`alfheim.loegien.localhost`)

Rows follow the frontend site block of `infrastructure/caddy/Caddyfile`. "Prefix handling" says what path the container receives: **strip** (`handle_path` removes the matched prefix, then `rewrite` puts the backend prefix back), **pass-through** (`handle`, path unchanged) or **rewrite** (prefix replaced by the app's own API prefix).

| Public path | Target container | Port | Prefix handling |
| :--- | :--- | :--- | :--- |
| `/livez` | — | — | Caddy answers `200 OK` itself (gateway health check) |
| `/api/v1/pantry*` | `pantry-backend` | `8000` | Strip: `/api/v1/pantry/items` → `/api/v1/items` |
| `/pantry/api/v1*` | `pantry-backend` | `8000` | Strip: `/pantry/api/v1/items` → `/api/v1/items` |
| `/api/v1/maintenance*` | `maintenance-backend` | `8000` | Strip to `/api/v1/...` |
| `/maintenance/api/v1*` | `maintenance-backend` | `8000` | Strip to `/api/v1/...` |
| `/api/v1/budget*` | `budget-backend` | `8000` | Strip to `/api/v1/...` |
| `/budget/api/v1*` | `budget-backend` | `8000` | Strip to `/api/v1/...` |
| `/api/v1/workout*` | `workout-backend` | `8000` | Strip to `/api/v1/...` |
| `/workout/api/v1*` | `workout-backend` | `8000` | Strip to `/api/v1/...` |
| `/api/v1/shopping*` | `shopping-backend` | `8000` | Pass-through: the backend serves `/api/v1/shopping-lists`, `/api/v1/shopping/items` and `/api/v1/shopping-history` itself; stripping would turn them into `/api/v1-lists` and `/api/v1/items` |
| `/shopping/api/v1*` | `shopping-backend` | `8000` | Strip to `/api/v1/...` |
| `/api/v1/chores*` | `chores-backend` | `8000` | Pass-through |
| `/chores/api/v1*` | `chores-backend` | `8000` | Rewrite to `/api/v1/chores/...` |
| `/api/v1/library*` | `library-backend` | `8000` | Pass-through |
| `/library/api/v1*` | `library-backend` | `8000` | Rewrite to `/api/v1/library/...` |
| `/api/v1/chat*` | `chat-backend` | `8080` | Pass-through |
| `/chat/api/v1*` | `chat-backend` | `8080` | Rewrite to `/api/v1/chat/...` |
| `/api/v1/households*`, `/api/v1/profile*` | `household-backend` | `8080` | Pass-through; longer than the dashboard catch-all, so it wins |
| `/api/v1/*` (everything else) | `dashboard-backend` | `8080` | Pass-through (`/api/v1/apps`, `/api/v1/telemetry`, ...) |
| `/internal`, `/internal/*` | — | — | `404`: service-to-service endpoints are never routed |
| `/storage*` | `rustfs` | `9000` | Strip `/storage`; the signed bucket/key path reaches RustFS unchanged |
| `/household*` | `household-frontend` | `3000` | Pass-through (Next.js basePath `/household`, no locale prefix) |
| `/pantry*`, `/maintenance*`, `/chores*`, `/library*`, `/budget*`, `/workout*`, `/chat*` | `<app>-frontend` | `3000` | Pass-through (Next.js basePath `/<app>`) |
| `/shopping*` | `shopping-frontend` | `3010` | Pass-through (Next.js basePath `/shopping`) |
| `/grafana*` | `grafana` | `3000` | Pass-through (Grafana serves from the `/grafana` sub-path) |
| everything else | `dashboard-frontend` | `3000` | Pass-through (root catch-all) |

Caddy sorts the `handle` and `handle_path` blocks of a site by path length and runs only the first match, so `/pantry/api/v1*` wins over `/pantry*`, and `/api/v1/households*` over `/api/v1/*`.

The gateway only routes: it adds no locale redirects. Each Next.js app runs the next-intl middleware, which sends a bare `/<app>` to the locale from the `NEXT_LOCALE` cookie, then `Accept-Language`, then the app default (`de` for chores and workout, `en` for the rest).

### FastAPI OpenAPI documents

The FastAPI backends (pantry, maintenance, budget, workout, shopping, chores, library) serve `/openapi.json` and `/docs` at their container root. No gateway rule forwards a path outside `/api/v1` to them: `/openapi.json` on the app host reaches the dashboard frontend, and `/pantry/api/v1/openapi.json` becomes `/api/v1/openapi.json`, which the backend answers with `404`. The OpenAPI documents are therefore reachable only from inside the app's network (for example `docker compose exec`) or a local `uvicorn` run.

---

## Auth Domain Routing (`auth.alfheim.loegien.localhost`)

| Public path | Target container | Port | Prefix handling |
| :--- | :--- | :--- | :--- |
| everything | `zitadel` | `8080` | Pass-through over h2c and HTTP/1.1. Zitadel does not support sub-path hosting, so it owns the whole host. |

---

## API Gateway Domain Routing (`api.alfheim.loegien.localhost`)

The dev stack keeps a separate API host. Installer-generated deployments have none: they serve every API on the app host (see below). The `api.*` host has no `/livez` and answers a failed upstream with JSON only (`api_unavailable`).

| Public path | Target container | Port | Prefix handling |
| :--- | :--- | :--- | :--- |
| `/api/v1/<slug>*`, `/<slug>/api/v1*` | `<slug>-backend` | `8000` (`8080` for chat) | Same rules as on the frontend host |
| `/pantry*`, `/maintenance*`, `/budget*`, `/workout*`, `/shopping*` | `<slug>-backend` | `8000` | Short form: strip `/<slug>`, prefix `/api/v1` (`/pantry/items` → `/api/v1/items`) |
| `/chores*`, `/library*`, `/chat*` | `<slug>-backend` | `8000` (`8080` for chat) | Short form: rewrite to `/api/v1/<slug>/...` |
| `/api/v1/households*`, `/api/v1/profile*` | `household-backend` | `8080` | Pass-through |
| `/api/v1/*` (everything else) | `dashboard-backend` | `8080` | Pass-through |
| `/internal`, `/internal/*` | — | — | `404` |
| `/storage*` | `rustfs` | `9000` | Strip `/storage` |
| `/grafana*` | `grafana` | `3000` | Pass-through |

## Installer-Generated App Host: Household & Internal Routes

The Caddyfile `alfheim-setup` renders (`tools/installer/internal/features/templating/embedded/Caddyfile.tmpl`) serves every API on the app host itself, so browsers call relative `/api/v1/...` paths. The Tier-1 household & roles service adds these rules:

| Public URL Path | Target Container | Container Port | Rule |
| :--- | :--- | :--- | :--- |
| `https://alfheim.loegien.de/api/v1/households*` | `household-backend` | `8080` | `handle`, path preserved (no rewrite) |
| `https://alfheim.loegien.de/api/v1/profile*` | `household-backend` | `8080` | `handle`, path preserved (no rewrite) |
| `https://alfheim.loegien.de/household*` | `household-frontend` | `3000` | Next.js basePath `/household` |
| `https://alfheim.loegien.de/internal/*` | _(none)_ | — | `respond 404`: the service-to-service API is never routed |
| `https://auth.loegien.de/internal/*` | _(none)_ | — | `respond 404`, defense in depth on the IAM host |

Caddy puts all `handle` and `handle_path` blocks of a site into one mutually exclusive group and sorts them by path length, longest first. `/api/v1/households*` and `/api/v1/profile*` are longer than the catch-all `/api/v1*` dashboard route, so they always win. No app slug is a prefix of `households` or `profile`, so no `/api/v1/<slug>*` rule can match them either. The dashboard frontend still serves every path no other rule matches.

---

## Response Security Headers

Every site block (the app host, the `auth.*` host and, in the dev stack, the `api.*` host) imports one `security_headers` snippet. Each field uses Caddy's `?` prefix, so a header the upstream already sends (Zitadel, Grafana) is kept and only missing ones are filled in.

| Header | Value | Why |
| :--- | :--- | :--- |
| `X-Content-Type-Options` | `nosniff` | Disables MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | No path or query leaks to other origins |
| `X-Frame-Options`, `Content-Security-Policy` | `SAMEORIGIN`, `frame-ancestors 'self'` | Clickjacking protection; the library PDF viewer frames a same-origin `/storage` URL |
| `Permissions-Policy` | camera, microphone, geolocation, payment, usb disabled | No Alfheim app needs them |
| `Content-Security-Policy-Report-Only` | same-origin baseline plus the `auth.*` host in `connect-src` | Report-only: Next.js emits inline bootstrap scripts, so enforcing `script-src` needs nonces first. Violations appear in the browser console. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Installer-generated HTTPS deployments only; the dev stack serves plain HTTP |
| `Server` | removed | Hides the proxy banner |

The dev `api.*` host adds no CORS headers. Every frontend calls the API through its own origin (`NEXT_PUBLIC_API_URL` is derived from `ALFHEIM_BASE_URL`), so browsers never make cross-origin requests there. `./scripts/verify-stack.sh` checks these headers on a running stack.

## Routes of Disabled Apps

The installer renders routes only for the apps in `ALFHEIM_ENABLED_APPS` ([ADR 0007](../explanation/decisions/0007-lean-core-app-set.md)). For an optional app that is switched off, the Caddyfile answers itself instead of proxying to a container that does not run:

| Public URL Path | Response | Why |
| :--- | :--- | :--- |
| `/api/v1/<slug>*` | `404` | Without this rule the path would fall through to the dashboard backend's `/api/v1*` catch-all. |
| `/<slug>/api/v1*` | `404` | Same, for the slug-prefixed API path. |
| `/<slug>*` | `302` to `/` | The page sends the browser back to the dashboard. |
| `/grafana*` (telemetry off) | `302` to `/` | Grafana is part of the telemetry module. |

`alfheim-setup apps enable|disable` re-renders the Caddyfile and restarts Caddy when it changed; `update` re-renders it from `.env` as well. The core routes (dashboard, household, storage, `/internal/*`) never change.

## Stopped Apps and Upstream Health Checks

An enabled app can still be stopped, restarting or crashed. Both Caddyfiles (dev and installer) handle that the same way, through two snippets.

Every app backend `reverse_proxy` (the optional apps plus `dashboard-backend` and `household-backend`) goes through `app_backend <upstream> <health path>`:

| Setting | Value | Effect |
| :--- | :--- | :--- |
| `lb_try_duration` / `lb_try_interval` | `3s` / `250ms` | A request waits briefly for a backend that is restarting instead of failing at once. |
| `fail_duration` | `10s` | A failed request marks the upstream down for 10 s (passive check). |
| `health_uri` | the backend's health path | Active check every `15s` with a `3s` timeout, on the same path as its compose healthcheck (for example `/api/v1/health` for pantry, `/healthz` for budget, the dashboard and the household app). |

The `app_unavailable` snippet adds `handle_errors 502 503 504` to the app host (the dev `api.*` host imports `api_unavailable`, which always answers JSON). It only replaces a response Caddy itself failed to get; an app's own `503` (for example `household_service_unavailable`) passes through unchanged.

| Request | Response |
| :--- | :--- |
| Any path containing `/api/v1` | `503` with `{"error":"service_unavailable","message":"..."}`, `Retry-After: 30` |
| Any other path | `503` with a static HTML page (`infrastructure/caddy/errors/app-unavailable.html`, no external assets) that links back to the dashboard, `Retry-After: 30` |

The page ships in the Caddy image at `/srv/alfheim-errors`; the dev compose file mounts it from `infrastructure/caddy/errors`. Error responses carry the same security headers as every other response. Other apps are unaffected: the error routes only apply to the failed request.

---

## Installer-Generated Route Table

The installer renders the app-host rules from one list, `apiRoutes` in `tools/installer/internal/features/templating/renderer.go`, so they match the frontend-host table above row for row: pantry, maintenance, budget and workout strip `/api/v1/<slug>`; shopping, chores, library and chat pass it through (`Direct`); `/<slug>/api/v1*` is rewritten to the route's `BackendPrefix` (`/api/v1`, or `/api/v1/<slug>` for chores, library and chat). The installer adds no `api.*` host and no short `/<slug>*` API form, and routes only the enabled apps (see [Routes of Disabled Apps](#routes-of-disabled-apps)).
