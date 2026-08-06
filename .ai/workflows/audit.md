# Workflow: Existing App Review & Audit Checklist (`.ai/workflows/audit.md`)

This workflow defines the mandatory step-by-step checklist to evaluate existing applications in the monorepo for architectural violations, complexity code smells, and z-index layering bugs.

---

## 🛠️ Step-by-Step Audit Workflow

Execute this checklist whenever evaluating an application's layout, performing code reviews, or before beginning a major refactoring sprint.

### 📋 Phase 1: File Size & Complexity Audit
* [ ] **Scan Page Components**: Locate all `page.tsx` and `layout.tsx` files inside `src/app/`.
* [ ] **Verify Line Limits**: Ensure no view, page, or layout component exceeds **200 lines of code** (Refer to [rules/architecture.md](file:///Users/leifkroeger/Dev/loeger-os/.ai/rules/architecture.md)).
* [ ] **Identify Monoliths**: Flag any single component file housing local queries, modal layouts, list mappings, and forms simultaneously. Enforce Single Responsibility Principle.

### 📁 Phase 2: Feature-Driven Design (FDD) Isolation
* [ ] **Check Core Layers**: Ensure generic concerns (auth, query clients, shared providers, base HTTP clients) are organized inside `src/core/` or `src/shared/`.
* [ ] **Verify Feature Isolation**: Ensure business features reside strictly under `src/features/<feature_name>/` (divided into `api/`, `hooks/`, and `components/`).
* [ ] **Identify Cross-Imports**: Ensure features do not import from other features directly; features should only expose components and hooks via their public barrel `index.ts`.

### ⚡ Phase 3: Hydration & Parameter Safety Audit
* [ ] **Locate Dynamic Routes**: Find all dynamic folder sub-routes (e.g. `[id]`).
* [ ] **Verify Parameter Promise Resolution**: If Next.js 15+, check that the page is an `async` Server Component resolving route params asynchronously (`const { id } = await params;`) instead of using client-side hooks (`useParams`) (Refer to [rules/safety.md](file:///Users/leifkroeger/Dev/loeger-os/.ai/rules/safety.md)).
* [ ] **Verify Suspense Boundaries**: Verify that the dynamic layout wraps client components inside a React `<Suspense>` fallback boundary to protect against hydration crashes.

### 🔒 Phase 4: Array Null-Safety Checks
* [ ] **Identify API Bindings**: Scan for lists, queries, and properties containing array payloads.
* [ ] **Check Array Fallbacks**: Ensure every map (`.map()`), length check (`.length`), or array join (`.join()`) is protected by a null-coalescing default (`?? []`):
  ```typescript
  const members = data?.members ?? [];
  ```
* [ ] **Verify Null Protection**: Flag conditional chains like `members && members.length > 0` as unsafe if `members` can return `null` from the database.

### 🌐 Phase 5: Ingress vs. App Routing Boundary
* [ ] **Check Ingress Definitions**: Inspect the `compose.yml` Docker labels. Verify that Traefik only handles top-level routing (path prefix mapping to containers).
* [ ] **Verify App Routing**: Ensure all sub-routes and dynamic slug parameters are delegated entirely to the Next.js router. No regex path manipulations at the Traefik level.

### 🎨 Phase 6: Stacking Context & Map Layering
* [ ] **Identify Map Instances**: Locate all usages of `<OSMMapViewer />` or Leaflet bindings.
* [ ] **Check Map Isolation**: Verify the map component is wrapped in a container with `relative z-0 isolate overflow-hidden` (Refer to [rules/architecture.md](file:///Users/leifkroeger/Dev/loeger-os/.ai/rules/architecture.md)).
* [ ] **Check Modal Layering**: Inspect all modal container declarations. Verify that modal overlays use `z-[9999]` and absolute/fixed positioning to override Leaflet default layers.
