---
title: "ADR 0006: Household Authorization via the Membership API"
description: "Backends authorize X-Household-ID by asking the core/household membership API instead of reading household claims from the Zitadel token."
sidebar:
  label: "0006 Household Authorization"
---

* Status: accepted
* Deciders: Alfheim Core Architecture Team
* Date: 2026-09-19

Technical Story: Sprints 1–2 of the household extraction (#479–#490)

---

## Context and Problem Statement

[ADR 0003](./0003-migrate-from-keycloak-to-zitadel.md) limits Zitadel to authentication (AuthN). Household membership and roles stay inside Alfheim. They now live in the Tier-1 app `core/household`, which took them over from the dashboard.

The backends did not follow that split. Each one compared the `X-Household-ID` request header against `household_id` / `active_household_id` claims in the access token, and read roles from `realm_access.roles`. Zitadel issues neither. As a result, every household-scoped request that sent the header was rejected with `403`, and every role check saw an empty list. The claim parsing was also duplicated across the Python apps, a forked module in budget, and the Go chat backend, and it did not always agree with itself.

How should a backend decide whether the caller may act in the household named by `X-Household-ID`, and with which role?

---

## Decision Drivers

* **Single source of truth:** membership and roles are owned by `core/household` and must not be copied into another system.
* **Immediate effect:** removing a member or changing a role must take effect without waiting for the user to sign in again.
* **Fail closed:** if membership cannot be determined, the request must be rejected.
* **Small surface for new apps:** one dependency in Python and one middleware in Go, with one error contract.
* **Replaceable:** it must be possible to move or rewrite the household service later without changing every app.

---

## Considered Options

* **Option 1: Membership claims in the Zitadel token** — use Zitadel Actions to add household ids and roles to the access token.
* **Option 2: Signed household token** — `core/household` issues a short-lived signed token for the active household, and frontends send it with each request.
* **Option 3: Gateway `forward_auth`** — Caddy asks `core/household` before forwarding a request, and passes the result to the backend in trusted headers.
* **Option 4: Membership API lookup in each backend** — each backend validates the JWT itself, then asks `core/household` over an internal API and caches the answer briefly.

---

## Decision Outcome

Chosen option: **Option 4 (membership API lookup in each backend)**, because it keeps membership in one place, reflects changes within seconds, and needs no Zitadel customization or extra client flow.

The contract:

* `core/household` serves `GET /internal/v1/memberships/{householdId}/{userSub}`, protected by `Authorization: Bearer $ALFHEIM_INTERNAL_TOKEN`. It answers `200 {household_id, user_id, role}` or `404` for non-members. Caddy never routes `/internal/*`.
* Python backends use `backend_shared.household.require_household` (and `require_role`). The Go chat backend uses `middleware.RequireHousehold` with `internal/shared/householdclient`. Both cache members for 30 s and non-members for 5 s, and never cache errors.
* Roles (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`) come from the membership response, never from token claims.
* Errors use one body shape, `{"detail": {"code", "message"}}`: `401 unauthenticated`, `400 household_required`, `400 household_invalid`, `403 household_forbidden`, `403 household_role_forbidden`, and `503 household_service_unavailable`.
* MCP tools take the household only from the request context. The chat backend forwards the caller's bearer token and `X-Household-ID` to the MCP servers. Tools never accept a household argument from the LLM.
* Frontends send only `X-Household-ID`. They take it from `HouseholdProvider` / `useActiveHousehold` in `@alfheim/shared` and render behind `HouseholdGate`.

### Positive Consequences

* Household-scoped requests work: the `403` on every request is gone.
* Membership and role changes take effect within the cache window (at most 30 s), without a new sign-in.
* One implementation per language replaces the duplicated claim parsing, including budget's forked auth module.
* The household service is reached through one URL (`HOUSEHOLD_INTERNAL_URL`). Moving, extracting or replacing it only changes that URL, as long as the internal API contract stays the same.

### Negative Consequences & Accepted Costs

* **Latency:** a cache miss adds one internal HTTP round trip (timeout 2 s in Python, 3 s in Go). The cache is per process, so each backend replica warms up on its own.
* **Stale access:** a removed member can keep access for up to 30 s. A user who has just joined can be refused for up to 5 s.
* **Runtime dependency:** every household-scoped request depends on `household-backend`. If it is down, requests fail with `503 household_service_unavailable`. Compose starts each consumer only after `household-backend` is healthy.
* **Shared secret:** `ALFHEIM_INTERNAL_TOKEN` must be distributed to every backend and kept out of the browser.

---

## Pros and Cons of the Options

### Option 1: Membership claims in the Zitadel token

* Good, because backends could authorize offline, with no extra call.
* Bad, because it copies membership into Zitadel, against ADR 0003.
* Bad, because a claim stays valid until the token expires, so removals are delayed by the token lifetime.
* Bad, because it needs Zitadel Actions code that is hard to test and must be provisioned by the installer.

### Option 2: Signed household token

* Good, because backends can verify it offline with a public key.
* Bad, because frontends need a second token flow with refresh and switching logic.
* Bad, because removals are delayed until the household token expires, and revocation would bring back an online check.
* Bad, because it adds key management to `core/household`.

### Option 3: Gateway `forward_auth`

* Good, because backends stay unaware of households.
* Bad, because backends would trust headers set by the gateway, which breaks for internal service-to-service calls and MCP calls that do not pass through Caddy.
* Bad, because every routed request, including static assets, would pay for the check unless the rules are carefully scoped.
* Bad, because authorization would move into the Caddyfile that the installer renders, where it is hard to test.

### Option 4: Membership API lookup in each backend

* Good, because `core/household` stays the only source of truth.
* Good, because it works the same for REST, MCP and service-to-service calls.
* Good, because the error contract and caching are defined once per language.
* Bad, because it adds latency on a cache miss and a runtime dependency on `household-backend`.
