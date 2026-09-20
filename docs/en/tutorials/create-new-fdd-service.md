---
title: "Create a New FDD Microservice"
description: "Step-by-step guide to scaffolding, implementing, and registering a new Feature-Driven Design (FDD) microservice application in the Alfheim monorepo."
---

> **TL;DR:** Step-by-step guide to scaffolding, implementing, and registering a new Feature-Driven Design (FDD) microservice application in the Alfheim monorepo.

---

## 📋 Table of Contents
- [Overview](#overview)
- [Step 1: Scaffold Directory Structure](#step-1-scaffold-directory-structure)
- [Step 2: Implement Backend Feature Domains](#step-2-implement-backend-feature-domains)
- [Step 3: Implement Microfrontend](#step-3-implement-microfrontend)
- [Step 4: Register Service in Caddy & Dashboard](#step-4-register-service-in-caddy--dashboard)
- [Step 5: Write Tests & Verify Quality Gates](#step-5-write-tests--verify-quality-gates)

---

## Overview

New microservices in `apps/<new-app>` consist of a paired FastAPI (or Go) backend and Next.js 16 microfrontend. This tutorial walks through creating a new service called `recipes`.

---

## Step 1: Scaffold Directory Structure

1. Create application directories under `apps/recipes/`:
   ```bash
   mkdir -p apps/recipes/backend/src/features/catalog
   mkdir -p apps/recipes/frontend/src/app/[locale]
   ```

2. Create `apps/recipes/compose.yml` defining the backend/frontend services. New apps do not get a
   dedicated database container: they share the consolidated `postgres-core` cluster, like
   `budget` and `library`. Add `recipes` to the `SERVICES` array in
   `infrastructure/postgres/init-multiple-dbs.sh`
   (`"alfheim_recipes:${RECIPES_POSTGRES_USER:-recipes_user}:${RECIPES_POSTGRES_PASSWORD:-postgres}"`)
   so the database and its least-privilege owner are created idempotently, and point
   `DATABASE_URL` at `postgres-core:5432/alfheim_recipes`.

---

## Step 2: Implement Backend Feature Domains

Follow Feature-Driven Design (FDD) in `apps/recipes/backend/src/features/catalog/`:

1. Define SQLModel database tables in `models.py`.
2. Define Pydantic request/response models in `schemas.py`.
3. Implement business logic in `service.py`.
4. Create FastAPI REST routes in `router.py`, with every household-scoped route depending on
   `backend_shared.household.require_household` (or `require_role(...)` where a route needs a
   specific role). Never parse `X-Household-ID` or a JWT household/role claim yourself — Zitadel
   issues neither. Call `configure_household_auth(settings)` in `main.py` and
   `await close_membership_client()` on shutdown. See
   [ADR 0006](../explanation/decisions/0006-household-authorization-via-membership-api.md) and
   [.ai/guidelines/new-app-scaffolding.md](../../../.ai/guidelines/new-app-scaffolding.md).
5. Export public interfaces explicitly in `__init__.py`:
   ```python
   # src/features/catalog/__init__.py
   from .models import Recipe
   from .service import RecipeService

   __all__ = ["Recipe", "RecipeService"]
   ```
6. Wire the app's own `HOUSEHOLD_INTERNAL_URL` (default `http://household-backend:8080`) and
   `ALFHEIM_INTERNAL_TOKEN` into `compose.yml` and `compose.prod.yaml`, and make the backend
   depend on `household-backend` being healthy. Without a valid, matching
   `ALFHEIM_INTERNAL_TOKEN` every household-scoped request fails closed with
   `503 household_service_unavailable`.

---

## Step 3: Implement Microfrontend

1. Configure Next.js App Router in `apps/recipes/frontend/src/app/[locale]/page.tsx`.
2. Import shared UI primitives from `@alfheim/shared`, including `HouseholdProvider` (mounted by
   the shared `AppShell`) and `HouseholdGate`, which every household-scoped page renders behind.
   Use `useActiveHousehold()` for the active household id — never read
   `localStorage.alfheim_active_household_id` directly — and include it in every household-scoped
   TanStack Query key.
3. Send only `X-Household-ID` (via `applyHouseholdHeaders`, never `X-Household-Role`) on API
   calls, and report household errors with `reportHouseholdErrorResponse`.
4. Enforce the strict 200 lines of code (LOC) limit per `.tsx` source file.

---

## Step 4: Register Service in Caddy & Dashboard

1. **Caddy Ingress**: Add both a frontend and an API route in `infrastructure/caddy/Caddyfile`,
   following the existing per-app pattern (see the `budget` or `library` entries). On the frontend
   domain:
   ```caddy
   redir /recipes /recipes/en 302
   redir /recipes/ /recipes/en 302

   handle /recipes* {
       reverse_proxy recipes-frontend:3000
   }

   handle_path /api/v1/recipes* {
       rewrite * /api/v1/recipes{path}
       reverse_proxy recipes-backend:8000
   }
   handle_path /recipes/api/v1* {
       rewrite * /api/v1/recipes{path}
       reverse_proxy recipes-backend:8000
   }
   ```
   Add the matching native + prefix-stripped alias on the `api.*` API Gateway domain as well (see
   [Ingress Matrix](../reference/ingress-matrix.md)).

2. **Control Plane Registry**: Register `recipes` in `core/dashboard/backend/internal/features/apps/tier1_core_registry.go`.
3. **Application Catalog**: Add `recipes` to [`docs/en/reference/apps-catalog.md`](../reference/apps-catalog.md).
4. **Reference page**: Add `docs/en/reference/apps/recipes.md` (purpose, routes, env vars,
   household scoping, MCP tools if any, known issues) — see any existing app reference page for
   the expected shape.

---

## Step 5: Write Tests & Verify Quality Gates

1. Write Pytest backend tests in `apps/recipes/backend/src/features/catalog/tests/`, including a
   household-isolation suite (`backend_shared.household.testing.override_membership`) that proves
   Tenant A cannot read, write or delete Tenant B's data, and covers
   `403 household_forbidden` / `400 household_required` / `503 household_service_unavailable`.
2. Run workspace verification suite:
   ```bash
   ./scripts/verify.sh --python --frontend
   ```
