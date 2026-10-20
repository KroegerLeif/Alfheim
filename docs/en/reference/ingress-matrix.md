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
- [API Gateway Domain Routing (`api.alfheim.loegien.localhost`)](#api-gateway-domain-routing-apialfheimloegienlocalhost)
- [Caddy Path Stripping Rules (`handle_path`)](#caddy-path-stripping-rules-handle_path)
- [Installer-Generated App Host: Household & Internal Routes](#installer-generated-app-host-household--internal-routes)

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

| Public URL Path | Target Container | Container Port | Notes |
| :--- | :--- | :--- | :--- |
| `http://alfheim.loegien.localhost/` | `dashboard-frontend` | `3000` | Root platform dashboard landing page |
| `http://alfheim.loegien.localhost/pantry` | `pantry-frontend` | `3000` | Bare `/pantry` is redirected to the locale by the app itself (next-intl) |
| `http://alfheim.loegien.localhost/budget` | `budget-frontend` | `3000` | Bare `/budget` is redirected to the locale by the app itself (next-intl) |
| `http://alfheim.loegien.localhost/chores` | `chores-frontend` | `3000` | Bare `/chores` is redirected to the locale by the app itself (next-intl) |
| `http://alfheim.loegien.localhost/workout` | `workout-frontend` | `3000` | Bare `/workout` is redirected to the locale by the app itself (next-intl) |
| `http://alfheim.loegien.localhost/library` | `library-frontend` | `3000` | Bare `/library` is redirected to the locale by the app itself (next-intl) |
| `http://alfheim.loegien.localhost/maintenance`| `maintenance-frontend`| `3000`| Bare `/maintenance` is redirected to the locale by the app itself (next-intl) |
| `http://alfheim.loegien.localhost/shopping` | `shopping-frontend` | `3010` | Bare `/shopping` is redirected to the locale by the app itself (next-intl) |
| `http://alfheim.loegien.localhost/chat` | `chat-frontend` | `3000` | Bare `/chat` is redirected to the locale by the app itself (next-intl) |
| `http://alfheim.loegien.localhost/grafana` | `grafana` | `3000` | Zitadel SSO Observability Dashboard |
| `http://alfheim.loegien.localhost/household` | `household-frontend` | `3000` | basePath `/household`, no locale prefix |
| `http://alfheim.loegien.localhost/api/v1/households`, `/api/v1/profile` | `household-backend` | `8080` | Path preserved; wins over the dashboard `/api/v1/*` catch-all |
| `http://alfheim.loegien.localhost/internal/` | — | — | `404`: service-to-service endpoints are never routed (same on `api.*`) |

The gateway only routes: it adds no locale redirects. Each Next.js app runs the next-intl middleware, which sends a bare `/<app>` to the locale from the `NEXT_LOCALE` cookie, then `Accept-Language`, then the app default (`de` for chores and workout, `en` for the rest).

---

## API Gateway Domain Routing (`api.alfheim.loegien.localhost`)

| Public API URL Path | Target Container | Container Port | Path Stripping Rule |
| :--- | :--- | :--- | :--- |
| `http://auth.alfheim.loegien.localhost/` | `zitadel` | `8080` | Dedicated IAM host. Zitadel does not support sub-path hosting; proxied over h2c. |
| `http://api.alfheim.loegien.localhost/storage/` | `rustfs` | `9000` | Strips `/storage` prefix |
| `http://api.alfheim.loegien.localhost/pantry/api/v1/` | `pantry-backend` | `8000` | Strips `/pantry` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/budget/api/v1/` | `budget-backend` | `8000` | Strips `/budget` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/shopping/api/v1/`| `shopping-backend`| `8000` | Strips `/shopping` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/maintenance/api/v1/`| `maintenance-backend`| `8000`| Strips `/maintenance` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/workout/api/v1/`| `workout-backend` | `8000` | Strips `/workout` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/library/api/v1/`| `library-backend` | `8000` | Strips `/library` prefix via `handle_path` |
| `http://api.alfheim.loegien.localhost/api/v1/chores` | `chores-backend` | `8000` | Native route (no stripping) |
| `http://api.alfheim.loegien.localhost/api/v1/chat` | `chat-backend` | `8080` | Native Go API route (no stripping) |
| `http://api.alfheim.loegien.localhost/api/v1/households`, `/api/v1/profile` | `household-backend` | `8080` | Native Go API route (no stripping); wins over the dashboard catch-all |
| `http://api.alfheim.loegien.localhost/api/v1/apps` | `dashboard-backend` | `8080` | Native Go API route (no stripping) |

---

## Caddy Path Stripping Rules (`handle_path`)

Python FastAPI microservices mount REST routers natively at `/api/v1`. To allow routing under service subpaths (e.g. `api.alfheim.loegien.localhost/pantry/api/v1/items`), Caddy uses `handle_path` blocks:

```caddy
@pantry_api path /pantry/*
handle_path /pantry/* {
    reverse_proxy pantry-backend:8000
}
```

This strips `/pantry` before forwarding HTTP traffic to `pantry-backend:8000`, so the backend receives `/api/v1/items`.

---

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

## Installer-Generated Route Table

The installer template and the dev Caddyfile route the same way. `/api/v1/<slug>*` is stripped to `/api/v1/...` for pantry, maintenance, budget and workout, and passed through unchanged for shopping, chores, library and chat, whose backends serve that path themselves. `/<slug>/api/v1*` always works too: it is rewritten to `/api/v1`, or to `/api/v1/<slug>` for chores, library and chat. The dashboard backend receives every other `/api/v1/*` path unchanged. The shopping frontend listens on port `3010`; all other frontends on `3000`.
