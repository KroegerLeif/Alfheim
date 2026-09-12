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

2. Create `apps/recipes/compose.yml` defining the dedicated database container (`recipes-db`) and backend/frontend services.

---

## Step 2: Implement Backend Feature Domains

Follow Feature-Driven Design (FDD) in `apps/recipes/backend/src/features/catalog/`:

1. Define SQLModel database tables in `models.py`.
2. Define Pydantic request/response models in `schemas.py`.
3. Implement business logic in `service.py`.
4. Create FastAPI REST routes in `router.py`.
5. Export public interfaces explicitly in `__init__.py`:
   ```python
   # src/features/catalog/__init__.py
   from .models import Recipe
   from .service import RecipeService

   __all__ = ["Recipe", "RecipeService"]
   ```

---

## Step 3: Implement Microfrontend

1. Configure Next.js App Router in `apps/recipes/frontend/src/app/[locale]/page.tsx`.
2. Import shared UI primitives from `@alfheim/shared`.
3. Enforce the strict 200 lines of code (LOC) limit per `.tsx` source file.

---

## Step 4: Register Service in Caddy & Dashboard

1. **Caddy Ingress**: Add reverse proxy rule in `infrastructure/caddy/Caddyfile`:
   ```caddy
   handle_path /recipes/* {
       reverse_proxy recipes-backend:8000
   }
   ```

2. **Control Plane Registry**: Register `recipes` in `core/dashboard/backend/internal/features/apps/tier1_core_registry.go`.
3. **Application Catalog**: Add `recipes` to [`docs/reference/apps-catalog.md`](../reference/apps-catalog.md).

---

## Step 5: Write Tests & Verify Quality Gates

1. Write Pytest backend tests in `apps/recipes/backend/src/features/catalog/tests/`.
2. Run workspace verification suite:
   ```bash
   ./scripts/verify.sh --python --frontend
   ```
