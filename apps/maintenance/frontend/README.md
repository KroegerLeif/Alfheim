# Maintenance Frontend Architecture — HOW (`apps/maintenance/frontend/`)

This directory houses the **Next.js & React Query** frontend web application for `alfheim` Maintenance. It provides user interfaces for browsing device lists, configuring maintenance checklists, registering devices, and checking overdue tasks.

---

## 📁 Directory Structure & Feature-Driven Design (FDD)

The codebase strictly adheres to Feature-Driven Design principles. Technical concerns are segregated into **Core** and **Features**:

```text
src/
├── app/                  # Next.js App Router (Routing, Layout, Providers)
│   ├── layout.tsx        # Base root wrapper
│   └── [locale]/         # Localised routes (en, de, pl)
├── core/                 # Core domain-agnostic layer
│   ├── api.ts            # Base Ky HTTP client & default error formatter
│   ├── auth/             # Keycloak OIDC context & hooks
│   └── utils.ts          # Shared helpers (date formatting, days calculations)
├── features/             # Business domains
│   ├── devices/          # Device inventory and details
│   ├── maintenance/      # Checklist wizard flow & metrics
│   ├── scheduled/        # Calendar tasks lists
│   ├── history/          # Logs timeline list
│   └── shopping/         # Cart associated supplies
└── shared/               # Shared presentation layouts and primitives
    ├── layout/           # Sidebar and Header wrappers
    └── types.ts          # Central API interfaces
```

### Feature Module Layout Invariant
Each business feature domain (e.g. `src/features/devices/`) is structured as:
* `api/`: Raw REST endpoints network functions (calls `maintenanceClient`).
* `hooks/`: TanStack Query wrapper hooks (handles caching, invalidation).
* `components/`: Pure, single-responsibility UI components (strictly `< 200 lines`).
* `index.ts`: The feature's public barrel file. All pages and external modules must import only from this barrel.

---

## ⚡ Runtime Safety & Conventions

1. **Array Null-Safety**: Coalesce all collection responses (`data ?? []`) before executing `.map()`, `.length`, or `.join()` to prevent hydration exceptions.
2. **Next.js 15 Async Params**: Asynchronously unwrap all route params promises in page/layout wrappers (`const { locale } = await params;`).
3. **Z-Index Layering**: Modals and wizard checklists overlay containers must utilize `z-[9999]` and absolute/fixed positioning to sit above all contexts.
