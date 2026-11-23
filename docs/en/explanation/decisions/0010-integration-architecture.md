---
title: "ADR 0010: Integration Architecture (Launchers and Typed Plugins)"
description: "External app launchers stay UI-only links; typed plugins live in the dashboard backend, keep encrypted household-scoped credentials, call out only through netguard, and act on other apps through a household-bound service principal."
sidebar:
  label: "0010 Integration Architecture"
---

* Status: accepted
* Deciders: Alfheim maintainers
* Date: 2026-11-23

Technical Story: [#953](https://github.com/KroegerLeif/Alfheim/issues/953)

---

## Context and Problem Statement

v0.6.0 connects Alfheim to services it does not run: Home Assistant, Jellyfin, Navidrome, YouTube and LLM providers. Two kinds of connection are wanted:

1. **External app launchers:** household-managed tiles that open Home Assistant, Jellyfin, YouTube or any other URL.
2. **Typed plugins:** backend integrations with configuration, stored credentials, a health check and an enable toggle (Home Assistant, Jellyfin and Navidrome, the ALFI LLM provider).

Typed plugins store third-party secrets, make server-side requests to administrator-supplied LAN addresses, and receive calls from systems that cannot sign in through OIDC. Each of these touches the zero-trust rules in [ADR 0006](./0006-household-authorization-via-membership-api.md). Several plugin issues depend on the same answers, so they are fixed once here: which service owns plugins, how credentials are kept, how outbound and inbound calls are secured, how ALFI uses plugins, and what the code contract looks like.

What exists today:

* The dashboard backend (`core/dashboard/backend`) is a launcher: the app catalog, the operator's `deploy/stack-apps.yaml` integrations and personal user links. It has no household scope; its `AGENTS.md` states that it ignores `X-Household-ID`.
* The chat backend already holds third-party secrets. `apps/chat/backend/internal/shared/crypto` encrypts model block API keys with AES-256-GCM (`CHAT_ENCRYPTION_KEY`), and each row stores the key id (`CHAT_ENCRYPTION_KEY_ID`) that encrypted it. Responses expose only `has_api_key`.
* The chat backend already guards outbound requests. `apps/chat/backend/internal/shared/netguard` rejects private, loopback, link-local and metadata destinations unless the operator lists them in `CHAT_ALLOWED_LLM_HOSTS`, and checks the resolved address again at dial time against DNS rebinding.
* The Go household middleware (`RequireHousehold`) also lives in `apps/chat/backend/internal/shared/middleware`. None of these three packages is in `packages/go-shared` yet.
* Chat's MCP server registry (`mcpservers`) is installation-wide, seeded from `CHAT_MCP_SERVERS`, and forwards the user's bearer token and `X-Household-ID` to each server on every call.

---

## Decision Drivers

* **Zero trust:** the household comes from the membership API, never from a token claim or a request payload; secrets never reach a browser or another app.
* **Always available:** integrations must work on a Lean Core install ([ADR 0007](./0007-lean-core-app-set.md)), where only the dashboard and household apps run.
* **SSRF resistance:** administrator-supplied URLs pointing at LAN hosts are an attack surface and need an operator-level boundary.
* **One source of truth per datum:** no second store for data another service already owns.
* **Testable wiring:** dependencies are injected through constructors and wired in `main`, as everywhere else in the Go backends.

---

## Considered Options

* **A: Typed plugins in the dashboard backend**, household-scoped, with launchers as a separate UI-only feature.
* **B: A new `apps/integrations` service** that owns plugins and launchers.
* **C: Each consuming app integrates on its own** (chat talks to Home Assistant, the dashboard talks to Jellyfin, and so on).

---

## Decision Outcome

Chosen option: **A**.

### Launchers and typed plugins stay separate

A **launcher** is a link: title, URL, icon and description, managed per household. It is UI only. The backend never calls the target, stores no secret for it, and the frontend opens it in a new tab, never in an iframe. Household launchers sit beside the two existing scopes: the operator's `deploy/stack-apps.yaml` integrations and each user's personal links.

A **typed plugin** is a backend contract with configuration, encrypted credentials, a health check and an enable toggle. A target that needs a secret or a server-side request is always a typed plugin, never a launcher with extra fields.

### 1. Owner service

Plugins and launchers live in `core/dashboard/backend`, under `internal/features/plugins` (contract, registry, storage, handlers) and `internal/features/integrations/<type>` (one package per plugin type). The dashboard is Tier 1 and always installed, so integrations do not depend on an optional app.

Plugin and launcher rows are **household-scoped**: every query filters by the household that `RequireHousehold` confirmed, and writes require the role `OWNER` or `ADMIN` as returned by the `core/household` membership API. The dashboard therefore gains household middleware for these routes; its existing app catalog and personal links stay as they are.

### 2. Credential custody

Plugin credentials are encrypted at rest with AES-256-GCM, and each row stores the id of the key that encrypted it, so a key can be rotated by re-encrypting rows. The implementation is chat's existing one, lifted into `packages/go-shared` together with `netguard` and the household middleware ([#954](https://github.com/KroegerLeif/Alfheim/issues/954)). The dashboard uses its own key (`INTEGRATIONS_ENCRYPTION_KEY`), never chat's.

Plaintext credentials never leave the dashboard backend: not in responses, logs, health details or calls to other Alfheim apps. Credentials are write-only through the API; read DTOs expose only `has_credentials`.

### 3. Outbound calls

Every request a plugin makes to its target goes through `netguard` with an operator-level allowlist, `INTEGRATIONS_ALLOWED_HOSTS` (host names, IP addresses or CIDR ranges). Home Assistant and media servers usually sit on private LAN addresses, which netguard blocks by default, so the operator states which ones the dashboard may reach. A household administrator can enter any URL, but only the operator decides which private destinations are reachable. Requests use a short timeout, and health details never echo credentials.

### 4. ALFI and MCP

The chat backend never receives plugin secrets. For Home Assistant, the dashboard exposes an authenticated MCP proxy: chat calls it with the user's bearer token and `X-Household-ID`, as it calls every MCP server today; the dashboard confirms the membership, loads that household's Home Assistant plugin, injects the stored token and forwards the request through netguard. Chat registers the proxy like any other MCP server, but only for households that have the plugin enabled. Today's registry is installation-wide, so [#957](https://github.com/KroegerLeif/Alfheim/issues/957) adds household-scoped entries to `mcpservers`.

### 5. ALFI LLM provider

No new store. Chat's household-shared model blocks remain the source of truth for LLM providers, their base URLs and their encrypted keys. The ALFI plugin card in the dashboard is a view over them, read and written through chat's public API with the user's token. Base URLs stay subject to `CHAT_ALLOWED_LLM_HOSTS`. Today a shared model block can be edited only by the user who created it; letting `OWNER` and `ADMIN` manage the household's shared block is part of [#962](https://github.com/KroegerLeif/Alfheim/issues/962).

### 6. Inbound webhooks and service identity

Home Assistant cannot sign in through OIDC. Its webhooks are authenticated with a per-plugin HMAC-SHA256 secret: the signature covers a timestamp and the raw body, requests outside a short replay window are rejected, the comparison is constant-time, and an event id per plugin makes delivery idempotent. The household comes from the plugin row the webhook id names, never from the payload.

An action on another app (for example creating a chore) goes through that app's public API, as every cross-app call does. It runs as a **household-bound service principal**: a Zitadel machine user that the dashboard authenticates as with short-lived client-credentials tokens. The binding between the principal and a household, with the scopes it may use, is stored in `core/household`. The membership API answers for a bound principal with the role `SERVICE`, so `require_household` and `RequireHousehold` keep their call path. A service principal is never a member: it cannot read member lists, profiles or invites, and an endpoint accepts it only when it opts in to the required scope. Removing the binding stops access on the next request. Details: [#958](https://github.com/KroegerLeif/Alfheim/issues/958).

### 7. Plugin contract

A plugin is a Go interface in `internal/features/plugins`: `Type()`, `ValidateConfig(...)`, `HealthCheck(ctx, ...)`, plus optional capability interfaces a plugin implements when it supports them (for example an MCP proxy or media status). Concrete plugins are constructed in `cmd/server/main.go` with their dependencies (netguard client, clock, logger) and passed to the registry's constructor. There is no global registry, no `init()` self-registration and no reflection.

### Unblocked issues

* [#955](https://github.com/KroegerLeif/Alfheim/issues/955): household-managed external app launchers
* [#956](https://github.com/KroegerLeif/Alfheim/issues/956): typed plugin framework with encrypted credentials, health checks and the admin settings UI
* [#957](https://github.com/KroegerLeif/Alfheim/issues/957): Home Assistant plugin with outbound REST and the MCP proxy for ALFI
* [#958](https://github.com/KroegerLeif/Alfheim/issues/958): household-bound service principals
* [#960](https://github.com/KroegerLeif/Alfheim/issues/960): signed Home Assistant webhook that triggers Alfheim actions
* [#961](https://github.com/KroegerLeif/Alfheim/issues/961): Jellyfin and Navidrome media server plugins
* [#962](https://github.com/KroegerLeif/Alfheim/issues/962): ALFI LLM provider plugin card backed by chat model blocks

[#954](https://github.com/KroegerLeif/Alfheim/issues/954) (lifting encryption, netguard and the household middleware into `packages/go-shared`) is the prerequisite of #956.

### Consequences

* Good, because integrations work on every install, including the Lean Core.
* Good, because secrets stay in one backend and one table, and chat keeps the only copy of LLM provider keys.
* Good, because the operator, not a household administrator, decides which private hosts the server may reach.
* Good, because the receiving apps authorize webhook-triggered actions with the same membership check as user requests.
* Bad, because the dashboard grows from a stateless launcher into a service with household data, secrets and outbound traffic; its compromise exposes every household's integration credentials.
* Bad, because `INTEGRATIONS_ALLOWED_HOSTS` is one more setting operators must maintain when a LAN service moves.
* Bad, because one machine user serves the bindings of all households. The household comes from the plugin row and every call is limited to opted-in scopes of households with an active binding, but a leaked client secret would reach every bound household within those scopes. One Zitadel user per household would need the dashboard to hold Zitadel management rights, a larger risk.

---

## Pros and Cons of the Options

### A: Typed plugins in the dashboard backend

* Good, because the dashboard is always installed and already owns everything a user sees on the home screen.
* Good, because the plugin UI and the backend that holds the secrets ship together.
* Bad, because the dashboard's role widens, as described under consequences.

### B: A new `apps/integrations` service

* Good, because the secrets sit in a service with a narrow purpose and its own network.
* Bad, because it is one more always-on container, database and network on homelab hardware, or, as an optional app, integrations would vanish on a Lean Core install.

### C: Each consuming app integrates on its own

* Good, because no central component is needed.
* Bad, because credentials, allowlists and health checks would be duplicated per app, and the Home Assistant token would end up in chat.

---

## Links

* [ADR 0006: Household Authorization via the Membership API](./0006-household-authorization-via-membership-api.md)
* [ADR 0007: Lean Core App Set](./0007-lean-core-app-set.md)
* [Platform architecture overview](../architecture-overview.md#integrations)
* [Authentication & security](../authentication-security.md)
* [Environment variables](../../reference/environment-variables.md)
