# Authentication & Multi-Tenancy Model (`docs/explanation/authentication-security.md`)

> **TL;DR:** Architectural explanation of Keycloak OIDC authentication, JWT token verification, and tenant isolation using household contexts (`X-Household-ID`).

---

## 📋 Table of Contents
- [Identity Provider Architecture (Keycloak)](#identity-provider-architecture-keycloak)
- [Authentication Flow (OIDC PKCE)](#authentication-flow-oidc-pkce)
- [JWT Token Claims & Household Context](#jwt-token-claims--household-context)
- [Multi-Tenancy Isolation (`X-Household-ID`)](#multi-tenancy-isolation-x-household-id)
- [FastMCP AI Agent Tenant Safety](#fastmcp-ai-agent-tenant-safety)

---

## Identity Provider Architecture (Keycloak)

Alfheim uses **Keycloak 26** as its centralized Identity and Access Management (IAM) provider, running in a dedicated container (`keycloak`) backed by an isolated PostgreSQL database (`postgres-iam`).

* **Issuer Realm**: `alfheim`
* **Public Issuer Endpoint**: `http://api.alfheim.loegien.localhost/auth/realms/alfheim`
* **Internal Docker JWKS Endpoint**: `http://keycloak:8080/auth/realms/alfheim/protocol/openid-connect/certs`

---

## Authentication Flow (OIDC PKCE)

1. **Authorization Grant**: Frontends redirect unauthenticated users to Keycloak using the OIDC Authorization Code Flow with PKCE (`S256`).
2. **Token Exchange**: Keycloak issues an RSA256-signed JWT access token containing user profile information, roles, and assigned household memberships.
3. **Session Propagation**: Frontends store the access token securely in session storage and inject `Authorization: Bearer <token>` on HTTP requests.

---

## JWT Token Claims & Household Context

Keycloak custom protocol mappers inject household membership claims directly into access tokens:

```json
{
  "sub": "usr_981231f2-8921-4831-a89f-2198129d1092",
  "preferred_username": "jules",
  "email": "jules@alfheim.local",
  "household_id": "hh_11111111-1111-1111-1111-111111111111",
  "households": [
    "hh_11111111-1111-1111-1111-111111111111",
    "hh_22222222-2222-2222-2222-222222222222"
  ]
}
```

---

## Multi-Tenancy Isolation (`X-Household-ID`)

To prevent tenant data leaks in multi-household environments:

1. **Request Header Enforcement**: Backends validate that incoming HTTP requests carry a valid `X-Household-ID` request header.
2. **Token Membership Check**: Backend authentication middleware (`backend_shared.auth`) verifies that the requested `X-Household-ID` matches one of the user's authorized `households` claims in the JWT token.
3. **Query Filtering**: Database repository queries explicitly filter all reads, writes, updates, and deletes by `household_id == active_household_id`.

---

## FastMCP AI Agent Tenant Safety

FastMCP AI agent tools (invoked by LLM clients like ALFI) require an explicit `household_id` parameter on every tool execution. The MCP tool logic enforces household boundaries before performing database modifications, preventing cross-household data leaks.
