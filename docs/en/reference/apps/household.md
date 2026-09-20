---
title: "Household & Roles"
description: "Tier-1 core app that owns households, members and roles, invites, the household contact book and user profiles, and answers membership checks for every other backend."
---

> **TL;DR:** Tier-1 core app that owns households, members and roles, invites, the household contact book and user profiles. Every other backend asks it whether a user belongs to a household.

Source: [`core/household/`](https://github.com/KroegerLeif/Alfheim/tree/main/core/household)

---

## 🎯 Purpose & Core Value

| Need / Problem | Solution / Capability |
| :--- | :--- |
| Zitadel only authenticates | Owns household membership and roles, the source of truth for authorization ([ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md)) |
| Sharing a home with others | Invites with QR codes and join links (`/household/join?token=…`), roles `OWNER`, `ADMIN`, `MEMBER`, `GUEST` |
| Several households per user | Default household per user, create, leave, delete and transfer ownership |
| Household contacts | Contact book with categories, per household |
| User profile | `GET/PUT /api/v1/profile/me` |

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Go (`household-backend`, Chi, `pgxpool`, golang-migrate), Zitadel JWT middleware.
- **Frontend:** Next.js (`household-frontend`, basePath `/household`) with `@alfheim/shared`.
- **Database:** `alfheim_household` on `postgres-core`, owned by `household_user`.

---

## 🌐 Ingress Routing & Environment Configuration

### Gateway & Network Matrix
| Service | Internal Port | Host Mapping / Gateway Route | Description |
| :--- | :--- | :--- | :--- |
| `household-backend` | 8080 | `/api/v1/households*`, `/api/v1/profile*` (path preserved) | Public REST API, Zitadel JWT required |
| `household-backend` | 8080 | `/internal/*` is **never** routed by Caddy (`404`) | Internal membership API on `gateway-net` / `core-net` |
| `household-frontend` | 3000 | `/household*` | Next.js microfrontend |

### Essential Environment Variables
| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://household_user:…@postgres-core:5432/alfheim_household?sslmode=disable` | PostgreSQL connection string |
| `OIDC_ISSUER_URL` / `OIDC_AUDIENCE` | `https://auth.loegien.de` / `alfheim` | JWT validation for the public API |
| `ALFHEIM_INTERNAL_TOKEN` | *(generated secret)* | Protects the internal API. If unset, the internal API returns `503` and every household-scoped request in other apps fails |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/api/v1` | Browser API base URL of the frontend |

See the [environment variables reference](../environment-variables.md#household--roles-service-corehousehold) for the database variables.

---

## 🔐 Authorization Model

- The public API authorizes only from `household_members`, keyed by the household id in the URL path. It ignores `X-Household-ID` and `X-Household-Role`.
- Only transfer-ownership changes the owner. Invites and role changes never grant `OWNER`.
- The first household a user creates or joins becomes their default.

### Internal membership API

```text
GET /internal/v1/memberships/{householdId}/{userSub}
Authorization: Bearer <ALFHEIM_INTERNAL_TOKEN>
```

| Status | Meaning |
| :--- | :--- |
| `200` | `{"household_id": "<uuid>", "user_id": "<sub>", "role": "OWNER\|ADMIN\|MEMBER\|GUEST"}` |
| `400` | `householdId` is not a UUID |
| `401` | Missing or wrong token |
| `404` | The household does not exist, or the user is not a member |
| `503` | `ALFHEIM_INTERNAL_TOKEN` is not configured |

Python backends call it through `backend_shared.household.require_household`, and the chat backend through `internal/shared/householdclient`. The full route and role tables live in [`core/household/backend/README.md`](../../../../core/household/backend/README.md).

---

## 🖥️ Frontend Routes

| URL | Page |
| :--- | :--- |
| `/household` | Household list, create and join |
| `/household/[id]` | Members, roles, invites, address, contacts, settings |
| `/household/onboarding` | Create or join; linked from every app's `HouseholdGate` when the user has no household |
| `/household/join?token=<token>` | Redeems an invite after login (QR code target) |
| `/household/profile` | User profile |

---

## ⚠️ Known Issues & Open Follow-Ups

- **Membership cache staleness**: a member removed from a household keeps access for up to 30 s;
  a user who just joined can get `403 household_forbidden` for up to 5 s, since every consumer
  caches membership answers per process. See
  [Known Issues](../../explanation/known-issues.md).
- **Availability**: every household-scoped request in every app fails with
  `503 household_service_unavailable` while `household-backend` is down or
  `ALFHEIM_INTERNAL_TOKEN` differs between services — membership is checked online with no offline
  fallback. See [Troubleshooting](../../how-to/troubleshooting.md#symptom-4-503-household_service_unavailable).
- No other known open issues.
