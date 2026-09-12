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

---

## Identity Provider Architecture (Zitadel)

Alfheim uses **Zitadel** as its lightweight, Go-based Identity and Access Management (IAM) provider. Zitadel operates as a central OIDC identity server, managing user credentials, primary user profile attributes, and security credentials while running with a minimal memory footprint (<150 MB RAM).

* **Public Issuer Endpoint**: `http://api.alfheim.loegien.localhost/auth` (or configured `OIDC_ISSUER_URL`)
* **Internal Docker JWKS Endpoint**: `http://zitadel:8080/oauth/v2/keys`
* **Protocol Standard**: Generic OpenID Connect (OIDC) 1.0 & OAuth 2.0 PKCE

---

## Separation of Concerns: AuthN vs AuthZ

To ensure clear architectural boundaries and keep external identity infrastructure lightweight, Alfheim strictly decouples authentication from household authorization:

1. **Identity & Authentication (AuthN - Zitadel)**:
   - Zitadel is responsible exclusively for global user identity verification, authentication (passwords, MFA, OIDC tokens), and user profile management (`sub`, `email`, `preferred_username`).
   - Zitadel does not manage microservice application business data or complex household memberships.

2. **Household Authorization & Context (AuthZ - Alfheim Core)**:
   - Alfheim Core/Dashboard manages household domain entities, household invitations, member roles (`owner`, `member`, `guest`), and tenant boundaries.
   - Microservices accept authenticated identity tokens from Zitadel and validate household access against active household contexts (`X-Household-ID`) governed by Alfheim Core.

---

## Authentication Flow (Generic OIDC PKCE)

1. **Authorization Grant**: Frontends redirect unauthenticated users to Zitadel using standard generic OIDC Authorization Code Flow with PKCE (`S256`).
2. **Token Exchange**: Zitadel issues an RSA256/Ed25519-signed JWT access token containing standard identity claims (`sub`, `email`, `preferred_username`).
3. **Session & Header Injection**: Frontends store the access token securely in session storage and attach both `Authorization: Bearer <token>` and `X-Household-ID: <active_household_id>` to outbound API calls.

---

## JWT Token Claims & User Identity

Zitadel issues standardized OIDC identity tokens:

```json
{
  "iss": "http://api.alfheim.loegien.localhost/auth",
  "sub": "usr_981231f2-8921-4831-a89f-2198129d1092",
  "aud": "alfheim-client",
  "preferred_username": "jules",
  "email": "jules@alfheim.local",
  "email_verified": true
}
```

---

## Multi-Tenancy Isolation (`X-Household-ID`)

To enforce strict tenant boundaries across all microservices:

1. **Request Header Enforcement**: Microservice backends validate that incoming HTTP requests carry a valid `X-Household-ID` header.
2. **Household Authorization Check**: Backend authentication middleware (`backend_shared.auth` and Go auth handlers) validates user identity (`sub`) and checks household membership authorization via Alfheim Core.
3. **Query Filtering**: Database repository queries filter all reads, writes, updates, and deletes by `household_id == active_household_id`.

---

## FastMCP AI Agent Tenant Safety

FastMCP AI agent tools (invoked by LLM clients like ALFI) require an explicit `household_id` parameter on every tool execution. The MCP tool logic enforces household boundaries before performing database modifications, preventing cross-household data leaks.
