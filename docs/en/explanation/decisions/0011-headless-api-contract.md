---
title: "ADR 0011: Headless API Contract for Native Clients"
description: "Committed OpenAPI 3.1 specs with a drift gate, one error envelope and pagination scheme, canonical /api/v1/<app> paths, additive versioning with a deprecation window, native PKCE through the system browser, clients under clients/ and LAN TLS through DNS-01."
sidebar:
  label: "0011 Headless API Contract"
---

* Status: accepted
* Deciders: Alfheim maintainers
* Date: 2026-11-23

Technical Story: [#891](https://github.com/KroegerLeif/Alfheim/issues/891)

---

## Context and Problem Statement

Native clients are planned: a SwiftUI client for iPadOS and iOS in v0.7.0 ([#966](https://github.com/KroegerLeif/Alfheim/issues/966), [#967](https://github.com/KroegerLeif/Alfheim/issues/967)), an iOS shopping client ([#899](https://github.com/KroegerLeif/Alfheim/issues/899)) and an Android pantry tablet client ([#898](https://github.com/KroegerLeif/Alfheim/issues/898)) in v1.x. Unlike the web frontends, a native client is not deployed together with the server: an installed app talks to whatever server version the household runs. The backends are close to usable from such a client, but there is no published contract.

What the code shows today:

* **Authentication:** the APIs accept bearer tokens only. The web frontends run authorization code with PKCE in `packages/shared/src/features/auth/oidcFlow.ts` and keep the tokens in `sessionStorage`. Backends check the issuer and `OIDC_AUDIENCE` (the Zitadel project id). The installer provisions one user-agent application (`OIDC_APP_TYPE_USER_AGENT`) with web redirect URIs; there is no native application.
* **Contract:** no OpenAPI document is committed. The FastAPI backends generate one at `/openapi.json`, but the gateway does not route it ([ingress matrix](../../reference/ingress-matrix.md#fastapi-openapi-documents)). The Go backends (dashboard, household, chat) have none.
* **Errors:** three shapes are in use. The household checks in `backend_shared` and chat's Go household middleware, and most FastAPI app errors (pantry, chores, workout, library), answer `{"detail": {"code", "message"}}`. Shopping answers `{"detail": {"error_code", "message"}}`. The Go helpers in `packages/go-shared` and the dashboard, household and chat handlers answer `{"error", "message"}`. FastAPI's own validation errors answer `422` with `{"detail": [...]}`.
* **Pagination:** pantry, budget and chores take `limit`/`offset` and return a bare array; library takes `skip`/`limit` and returns `{items, total, skip, limit}`; shopping does not paginate.
* **Routing:** maintenance, pantry, workout and budget are prefix-stripped: `/api/v1/pantry/products` reaches the backend as `/api/v1/products`. Chores, chat and library are passed through and serve `/api/v1/<app>/...` themselves. Shopping is passed through but serves `/api/v1/shopping-lists`, `/api/v1/shopping/items` and `/api/v1/shopping-history`, and its `/api/v1/households` router is shadowed at the gateway by `core/household`. Every app is also reachable under a second prefix, `/<app>/api/v1/...`.
* **TLS:** the installer already offers DNS-01 certificates (Hetzner, deSEC, Cloudflare) and an internal CA whose root is exported for clients.

This ADR decides the seven points the client issues depend on.

---

## Decision Drivers

* **Independent release cycles:** a client in the field must keep working while the server updates, and the other way round.
* **One parser per client:** a client that talks to household, pantry and shopping must not need three error formats.
* **Zero trust unchanged:** native clients follow [ADR 0006](./0006-household-authorization-via-membership-api.md); tokens carry no household.
* **No hand-maintained contracts:** a spec that is not generated from code and checked in CI goes stale.
* **Self-hosted reality:** every instance has its own domain and certificate; app-store builds cannot be configured per instance at build time.

---

## Considered Options

The options were weighed per point; the main alternatives were:

* **Contract:** committed OpenAPI generated from code, against a hand-written spec, against serving the spec at runtime only.
* **Errors:** RFC 9457 Problem Details, against unifying on the most common existing shape.
* **Clients:** `clients/` in this monorepo, against one repository per client.
* **Native auth:** system-browser PKCE, against an embedded WebView or a password grant.

---

## Decision Outcome

### 1. Contract source

Each backend commits its OpenAPI 3.1 document at `api/openapi.yaml` in its backend directory (for example `apps/pantry/backend/api/openapi.yaml`). The document is generated from code: FastAPI's `app.openapi()` for Python, and for Go one code-first generator, chosen in [#895](https://github.com/KroegerLeif/Alfheim/issues/895) and used by all three Go services. A `make openapi` target regenerates it. CI regenerates every spec and fails on `git diff --exit-code`, so a handler change without a regenerated spec does not merge. Paths in the spec are the public paths a client calls (point 3), and every spec declares `bearerAuth`, the `X-Household-ID` header and the error envelope as shared components.

The gateway does not serve the specs at runtime; the committed file is the contract. Each app's reference page under `docs/en/reference/apps/` links its spec.

### 2. Error envelope and pagination

**Errors:** every backend answers errors as

```json
{"detail": {"code": "household_forbidden", "message": "Human-readable text", "...": "optional extra fields"}}
```

`code` is a stable, machine-readable snake_case string; clients branch and translate on `code`, never on `message`. Extra fields (such as pantry's `item_count`) are allowed beside `code` and `message`. Messages never carry tracebacks or SQL. Validation errors answer `422` with `code: "validation_error"` and the field errors in `detail.errors`. This shape is chosen because most Python backends and the shared household checks in both languages already use it, and FastAPI produces it from `HTTPException(detail={...})`. RFC 9457 Problem Details was rejected: it would change every backend, including the ones already consistent.

**Pagination:** list endpoints take `limit` and `offset` and return

```json
{"items": [...], "total": 123, "limit": 100, "offset": 0}
```

The default `limit` is 100; each endpoint states its maximum in the spec. Offset pagination fits household-sized collections; a cursor can be added to an endpoint later as an additive change.

**Migration:** the web frontends ship with the server, so each backend switches in one pull request together with its frontend and every cross-app caller, without compatibility aliases. During the migration the shared frontend API client (`packages/shared/src/features/api/`) reads both the old and the new error shape; the old parsing is removed once the last backend has moved. The envelope lands in [#893](https://github.com/KroegerLeif/Alfheim/issues/893), shopping pagination in [#892](https://github.com/KroegerLeif/Alfheim/issues/892); the other bare-array list endpoints and library's `skip` move to the page object before their spec is published to a native client.

### 3. Canonical routing

Every app API is public under `/api/v1/<app>/...`, and the backend serves exactly that path: the gateway passes it through without stripping or rewriting, as it does for chores, chat and library today. The path in the spec, the path at the gateway and the path in the backend's router are then the same string.

* Shopping moves all routers under `/api/v1/shopping` (`/api/v1/shopping/lists`, `/api/v1/shopping/items`, `/api/v1/shopping/history`, `/api/v1/shopping/households`) and the gateway gets a single `/api/v1/shopping` route ([#892](https://github.com/KroegerLeif/Alfheim/issues/892)). This replaces that issue's instruction to strip the prefix the way pantry does.
* The prefix-stripped backends (maintenance, pantry, workout, budget) move to the full path before their spec is published to a native client; pantry does so with [#894](https://github.com/KroegerLeif/Alfheim/issues/894).
* The Tier-1 core services keep their resource paths (`/api/v1/households`, `/api/v1/profile`, and the dashboard's `/api/v1/apps`, `/api/v1/launchers`, `/api/v1/integrations` and so on), routed explicitly by the gateway. A new dashboard route must not collide with an app slug.
* The second prefix `/<app>/api/v1/...` is not part of the contract; native clients never use it.

### 4. Versioning and deprecation

The URL carries the major version. Within `/api/v1`, only additive changes are allowed: new endpoints, new optional request fields, new response fields and new enum values. Clients ignore unknown response fields and treat unknown enum values as "other". A breaking change to an app's API is served under `/api/v2/<app>/...` beside the old version, which stays for at least two minor releases and at least six months after the release that deprecates it. A deprecated operation is marked `deprecated: true` in the spec, answers with `Deprecation` and `Sunset` headers, and is listed under "Deprecated" in the changelog.

These rules bind from the first native client release (v0.7.0) onwards. Until then, and always for the web frontends, a breaking change ships together with its frontend, as described in point 2.

### 5. Native authentication

* **Flow:** authorization code with PKCE through the system browser (`ASWebAuthenticationSession` on iOS and iPadOS, Custom Tabs on Android). No embedded WebView and no password grant; the Zitadel login page, including social login and MFA, stays the only place that sees a password.
* **Application:** the installer provisions a separate Zitadel application of type native in the existing project, without a client secret ([#896](https://github.com/KroegerLeif/Alfheim/issues/896)). Its tokens carry the project id as audience, so the backends' existing issuer and audience checks accept them unchanged; #896 adds the tests that prove it. The redirect URI is the custom scheme `alfheim://oauth/callback`. Claimed HTTPS links (universal or app links) are not used, because they need an association file served from a domain the app is built for, and every instance has its own domain.
* **Tokens:** the client requests `offline_access` and stores the refresh token in the platform keystore (Keychain, Android Keystore); the access token stays in memory. Refresh token rotation is on and lifetimes are set explicitly by the installer.
* **Instance and household:** the user enters the instance URL; the client discovers the issuer and the native client id from the instance, then signs in. Households work as in the web frontends: the client lists the caller's households from `GET /api/v1/households/me`, preselects the default one (or asks when there are several and none is default), stores the choice per account and sends it as `X-Household-ID` on every household-scoped request. Switching household needs no new token; the backend confirms each request through the membership API.

### 6. Client code and generated API clients

Native clients live in this monorepo under `clients/`, outside the pnpm and uv workspaces, so a spec change and the client change that follows it can land in one pull request and the drift gate covers both:

* `clients/apple`: the SwiftUI client for iPadOS and iOS, scaffolded in [#967](https://github.com/KroegerLeif/Alfheim/issues/967). The iOS shopping client ([#899](https://github.com/KroegerLeif/Alfheim/issues/899)) is a feature of this scaffold, not a second Apple project. [#966](https://github.com/KroegerLeif/Alfheim/issues/966) decides which screens are native and which stay on the web dashboard.
* `clients/android`: the Android pantry tablet client ([#898](https://github.com/KroegerLeif/Alfheim/issues/898)).

API clients are generated from the committed specs during the client build (Swift: Apple's `swift-openapi-generator`; Android: the generator chosen in #898) and are never written by hand. Client CI runs in its own path-filtered workflows, since it needs macOS and Android toolchains.

### 7. Network and TLS

The supported path for native clients is HTTPS through Caddy with a publicly trusted certificate obtained through ACME DNS-01 (the installer's Hetzner, deSEC or Cloudflare strategies), on a real domain that local DNS resolves to the server's LAN address. This works on a LAN without opening a port, and iOS App Transport Security and Android accept it without configuration. The installer's internal CA is best effort: it works once the user installs and trusts the exported root on each device, which Android apps do not honour by default. Plain HTTP is not supported for native clients. The setup is documented in [#897](https://github.com/KroegerLeif/Alfheim/issues/897).

### From v0.6.0 to v0.7.0

The v0.7.0 clients ([#966](https://github.com/KroegerLeif/Alfheim/issues/966), [#967](https://github.com/KroegerLeif/Alfheim/issues/967)) need points 1, 5 and 6 in place. v0.6.0 therefore commits the Go specs ([#963](https://github.com/KroegerLeif/Alfheim/issues/963) for dashboard and chat, [#895](https://github.com/KroegerLeif/Alfheim/issues/895) for household), provisions the native application ([#896](https://github.com/KroegerLeif/Alfheim/issues/896)) and builds the kiosk summary endpoint ([#964](https://github.com/KroegerLeif/Alfheim/issues/964)) to this contract. The Go specs document today's `{"error", "message"}` shape until [#893](https://github.com/KroegerLeif/Alfheim/issues/893) lands, and the versioning rules of point 4 start with the first v0.7.0 client build.

### Unblocked issues

* v0.6.0: [#895](https://github.com/KroegerLeif/Alfheim/issues/895), [#896](https://github.com/KroegerLeif/Alfheim/issues/896), [#963](https://github.com/KroegerLeif/Alfheim/issues/963), [#964](https://github.com/KroegerLeif/Alfheim/issues/964)
* v0.7.0: [#897](https://github.com/KroegerLeif/Alfheim/issues/897), [#966](https://github.com/KroegerLeif/Alfheim/issues/966), [#967](https://github.com/KroegerLeif/Alfheim/issues/967)
* v1.x: [#892](https://github.com/KroegerLeif/Alfheim/issues/892), [#893](https://github.com/KroegerLeif/Alfheim/issues/893), [#894](https://github.com/KroegerLeif/Alfheim/issues/894), [#898](https://github.com/KroegerLeif/Alfheim/issues/898), [#899](https://github.com/KroegerLeif/Alfheim/issues/899)

### Consequences

* Good, because a client parses one error shape and one page shape, generated from specs that cannot drift from the code.
* Good, because native sign-in uses the same identity provider, project and membership checks as the web; no backend learns a new token type.
* Good, because a spec path, a gateway path and a router path are the same string, which makes routing bugs visible in review.
* Bad, because prefix-stripped backends and shopping need breaking path changes, and every bare-array list endpoint changes its response shape.
* Bad, because once a client ships, breaking changes cost a parallel `/api/v2` for months.
* Bad, because the internal-CA install path remains awkward for native clients; operators who want them should use a domain with DNS-01.

---

## Pros and Cons of the Options

### Committed OpenAPI generated from code

* Good, because reviews show contract changes as diffs and clients build without a running server.
* Bad, because every backend needs a generator target and a CI step.

A hand-written spec drifts from the code; a spec served only at runtime cannot be reviewed or used to build a client offline.

### Unify on `{"detail": {"code", "message"}}`

* Good, because most backends and both shared household checks already answer this way.
* Bad, because it is Alfheim-specific; generic HTTP tooling understands RFC 9457 Problem Details better, at the cost of changing every backend.

### `clients/` in the monorepo

* Good, because specs and generated clients change atomically and share CI gates.
* Bad, because the repository grows Swift and Kotlin toolchains; separate repositories would isolate them but split every contract change across two pull requests.

### System-browser PKCE

* Good, because the app never sees a password and Zitadel features (social login, MFA, passkeys) work unchanged.
* Bad, because the sign-in leaves the app briefly. An embedded WebView or a password grant would avoid that but exposes credentials to the app and is rejected by current OAuth guidance for native apps (RFC 8252).

---

## Links

* [ADR 0006: Household Authorization via the Membership API](./0006-household-authorization-via-membership-api.md)
* [ADR 0010: Integration Architecture](./0010-integration-architecture.md)
* [Authentication & security](../authentication-security.md)
* [Ingress matrix](../../reference/ingress-matrix.md)
* [App reference pages](../../reference/apps/dashboard.md)
