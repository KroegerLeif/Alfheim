---
title: "Authentication & Multi-Tenancy Model"
description: "Architectural explanation of generic OIDC PKCE authentication with Zitadel, JWT token verification, and tenant isolation using household contexts."
sidebar:
  label: "Authentication"
---

> **TL;DR:** Architectural explanation of generic OIDC PKCE authentication with Zitadel, JWT token verification, and tenant isolation using household contexts (`X-Household-ID`).

---

## 📋 Table of Contents
- [Identity Provider Architecture (Zitadel)](#identity-provider-architecture-zitadel)
- [Separation of Concerns: AuthN vs AuthZ](#separation-of-concerns-authn-vs-authz)
- [Authentication Flow (Generic OIDC PKCE)](#authentication-flow-generic-oidc-pkce)
- [JWT Token Claims & User Identity](#jwt-token-claims--user-identity)
- [Multi-Tenancy Isolation (`X-Household-ID`)](#multi-tenancy-isolation-x-household-id)
- [FastMCP AI Agent Tenant Safety](#fastmcp-ai-agent-tenant-safety)
- [Frontend Household Context](#frontend-household-context)

---

## Identity Provider Architecture (Zitadel)

Alfheim uses **Zitadel** as its lightweight, Go-based Identity and Access Management (IAM) provider. Zitadel operates as a central OIDC identity server, managing user credentials, primary user profile attributes, and security credentials while running with a minimal memory footprint (<150 MB RAM).

* **Public Issuer Endpoint**: the bare origin of the IAM host — `https://auth.loegien.de` in production, `http://auth.alfheim.loegien.localhost` locally (configured as `OIDC_ISSUER_URL`). Zitadel does not support sub-path hosting.
* **Internal Docker JWKS Endpoint**: `http://zitadel:8080/oauth/v2/keys`
* **Protocol Standard**: Generic OpenID Connect (OIDC) 1.0 & OAuth 2.0 PKCE

---

## Separation of Concerns: AuthN vs AuthZ

To ensure clear architectural boundaries and keep external identity infrastructure lightweight, Alfheim strictly decouples authentication from household authorization:

1. **Identity & Authentication (AuthN - Zitadel)**:
   - Zitadel is responsible exclusively for global user identity verification, authentication (passwords, MFA, OIDC tokens), and user profile management (`sub`, `email`, `preferred_username`).
   - Zitadel does not manage microservice application business data or complex household memberships.

2. **Household Authorization & Context (AuthZ - `core/household`)**:
   - The Tier-1 app `core/household` owns households, invitations, member roles (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`), contacts and the user profile. It is the only source of truth for who belongs to which household.
   - Zitadel issues no household or role claims. Backends never read them; they ask `core/household` instead (see [ADR 0006](./decisions/0006-household-authorization-via-membership-api.md)).
   - The dashboard is not involved in household authorization. It serves only the launcher, app catalog, user links and preferences (plus telemetry), and ignores `X-Household-ID` / `X-Household-Role`.

---

## Authentication Flow (Generic OIDC PKCE)

1. **Authorization Grant**: Frontends redirect unauthenticated users to Zitadel using standard generic OIDC Authorization Code Flow with PKCE (`S256`).
2. **Token Exchange**: Zitadel issues an RSA256/Ed25519-signed JWT access token containing standard identity claims (`sub`, `email`, `preferred_username`).
3. **Session & Header Injection**: Frontends store the access token in session storage and attach `Authorization: Bearer <token>` to outbound API calls. Household-scoped calls also carry `X-Household-ID: <active household UUID>`. Frontends never send `X-Household-Role`.

---

## JWT Token Claims & User Identity

Zitadel issues standardized OIDC identity tokens:

```json
{
  "iss": "https://auth.loegien.de",
  "sub": "usr_981231f2-8921-4831-a89f-2198129d1092",
  "aud": "alfheim-client",
  "preferred_username": "jules",
  "email": "jules@alfheim.local",
  "email_verified": true
}
```

---

## Multi-Tenancy Isolation (`X-Household-ID`)

`X-Household-ID` only *selects* a household. It grants nothing on its own: every household-scoped backend confirms the caller's membership with `core/household` before it serves the request.

1. **Token validation**: the backend validates the JWT (issuer, signature, audience) and takes the user from `sub`. A missing or invalid token is `401 unauthenticated`.
2. **Header check**: the request must carry `X-Household-ID` as a UUID. Missing is `400 household_required`; not a UUID is `400 household_invalid`.
3. **Membership lookup**: the backend calls the household app's internal API:

   ```text
   GET {HOUSEHOLD_INTERNAL_URL}/internal/v1/memberships/{householdId}/{userSub}
   Authorization: Bearer {ALFHEIM_INTERNAL_TOKEN}
   ```

   `200` returns the member's `role`; `404` means not a member (`403 household_forbidden`). Caddy never routes `/internal/*`, and `ALFHEIM_INTERNAL_TOKEN` never reaches a browser.
4. **Role check**: routes that need a role (for example chat's MCP registry toggle, OWNER or ADMIN) use the role from the membership answer, never a token claim. A member without the role gets `403 household_role_forbidden`.
5. **Query filtering**: repository queries filter every read, write, update and delete by the verified household id.

Python backends implement steps 1–4 with `backend_shared.household.require_household` / `require_role`. The chat backend (Go) uses `middleware.RequireHousehold` with `internal/shared/householdclient`. Both behave the same:

| Status | `detail.code` | Meaning |
| :--- | :--- | :--- |
| `401` | `unauthenticated` | No valid JWT, or no `sub` |
| `400` | `household_required` | `X-Household-ID` is missing |
| `400` | `household_invalid` | `X-Household-ID` is not a UUID |
| `403` | `household_forbidden` | The user is not a member of that household |
| `403` | `household_role_forbidden` | The user is a member, but the route needs another role |
| `503` | `household_service_unavailable` | The membership API is unreachable, timed out, returned 5xx, rejected the internal token, or the token is not configured. Requests never fail open |

The body is always `{"detail": {"code": "...", "message": "..."}}`.

**Caching:** answers are cached per process, keyed by household and user: members for 30 s, non-members for 5 s. Errors are never cached. Removing a member therefore takes effect within 30 s, without the user signing in again.

**Service-to-service calls:** when one app calls another (for example shopping → pantry, maintenance → budget), it forwards the caller's bearer token and `X-Household-ID`. The target app authorizes the caller itself; there is no service identity that bypasses the membership check.

The dashboard backend is not household-scoped: its data (preferences, links) is keyed by the user's `sub`, so it neither validates nor rejects `X-Household-ID`, and it never reads or emits `X-Household-Role`. `core/household` authorizes its own public API from the household id in the URL path and also ignores both headers.

---

## FastMCP AI Agent Tenant Safety

MCP tools never take a household (or user) argument from the LLM. The household comes only from the request context:

* The chat backend forwards the caller's `Authorization: Bearer <token>` and `X-Household-ID` on every JSON-RPC request to an MCP server. Credentials are set per request, so one caller's identity is never reused for another.
* Each Python app wraps its MCP app in `MCPAuthenticationMiddleware`, which runs the same token, header and membership checks as the REST API and the same error contract.
* Tools read the verified context with `get_mcp_household_context()` and call the same service functions as the REST routes, so MCP reads and writes the same household the user has selected.

---

## Frontend Household Context

Frontends take the active household from `@alfheim/shared`:

* `HouseholdProvider` loads the user's households from `GET /api/v1/households/me` (served by `core/household`) and picks the active one: the saved id if it is still a membership, then the default household, then the first one. The choice is stored in `localStorage` under `alfheim_active_household_id` and synced across apps and tabs.
* `useActiveHousehold()` exposes `{ status, householdId, role, ... }`. Household-scoped queries wait for `status === 'ready'` and include the household id in their query keys.
* `HouseholdGate` renders the page only when a household is ready. Otherwise it shows a create-or-join card (linking to `/household/onboarding`), switch buttons after `household_forbidden`, or a retry message after `household_service_unavailable`.
* API clients add the header with `applyHouseholdHeaders` / `householdHeaders` and report household errors with `reportHouseholdErrorResponse`.
