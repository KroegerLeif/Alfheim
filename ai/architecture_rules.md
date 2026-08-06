# Monorepo Architecture & Stacking Rules (`ai/architecture_rules.md`)

This document defines the strict, non-negotiable architectural rules regarding routing delegation, Feature-Driven Design code boundaries, z-index visual layering, and runtime safety.

---

## 🚦 Rule 1: Ingress Route Delegation vs. Internal App Routing

To maintain clear boundary isolation between the proxy gateway and application codebases:

### 1. Ingress Routing (Traefik)
- **Traefik** operates solely as an ingress reverse-proxy gateway. It delegates external HTTP requests to decoupled Docker containers based on hostnames and top-level route path prefixes (e.g., routing `/api/v1/households` to the backend control plane and routing the catch-all `/` to the Next.js frontend).
- Ingress routers do **NOT** handle internal page sub-routing.

### 2. Internal Sub-Routing (Next.js App Router)
- The **Next.js App Router** is responsible for all internal route transitions, layout hierarchies, dynamic path parameters (e.g., `/household/[id]`), and page hydration.
- Never write routing hacks or proxy redirects at the gateway level for path parameters that belong inside the application's React routing state.

---

## 📦 Rule 2: FDD Directory Isolation & File Length Constraints

Monolithic files violate the **Single Responsibility Principle (SRP)** and impair readability and maintainability.

### 1. FDD Folder Boundaries
- All feature-related logic (queries, API calls, dialog forms, list items, maps) must reside in a dedicated folder under `src/features/<domain>/`:
  - `src/features/<domain>/api/` for raw HTTP network requests.
  - `src/features/<domain>/hooks/` for TanStack Query wrappers.
  - `src/features/<domain>/components/` for domain-specific UI components.
- Direct query imports or raw fetch calls inside page wrappers are forbidden.
- Cross-cutting concerns belong in `src/core/` (HTTP client, global providers) or `src/shared/` (presentation primitives).

### 2. Strict File Length Limits
- **Component & View files** must NEVER exceed **200 lines of code**.
- If a component grows near this limit, immediately split it into smaller, isolated, single-responsibility subcomponents (e.g., factoring forms into modals, list items into card widgets, and container layouts into separate layout views).

---

## 🔒 Rule 3: Array Safety Guards & Async Route Parameters

Hydration mismatches and raw exceptions from API changes crash Next.js pages. Protect execution frames via the following rules:

### 1. Array Null-Safety Fallbacks
- Array responses returned from REST queries or passed through component properties must be explicitly coalesced to empty arrays (`?? []`) before accessing `.length`, `.map()`, or `.join()` operations:
  ```typescript
  // Safeguard queries
  const contacts = queryData ?? [];

  // Safeguard array property join/map calls
  const links = contact?.links ?? [];
  return links.map(link => ...);
  ```
- Checking array presence (`contacts && contacts.length > 0`) is **insufficient** if the payload resolves to `null`, since `null && null.length > 0` returns `null` which can throw React hydration mismatches or lead to uncaught runtime errors.

### 2. Next.js 15+ Route Parameters Promise Unwrap
- Dynamic path parameters (`params`) in Next.js 15+ page route handlers are **Promises** and must be resolved asynchronously:
  ```typescript
  export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <FeatureView id={id} />;
  }
  ```
- Always wrap the rendering of dynamic views inside a React `<Suspense>` boundary to allow clean stream hydration.

---

## 🎨 Rule 4: Stacking Contexts (Leaflet Z-Index Isolation)

Leaflet maps use high default z-indexes (`z-index: 400+`), which cause map elements to bleed through overlay backdrops and float on top of modals.

### 1. Map Containment
- Wrap every instance of `<OSMMapViewer />` in a parent container configured with Tailwind's isolation and positioning utilities to isolate its stacking context:
  ```html
  <div className="relative z-0 isolate overflow-hidden">
    <OSMMapViewer ... />
  </div>
  ```
- The `isolate` class forces a new local stacking context, preventing Leaflet's high-z-index layers from escaping the map block.

### 2. Modal Overlay Layering
- All global modals and screen overlays must use a z-index class of `z-[9999]` and absolute/fixed positioning to sit safely above map containers:
  ```html
  <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm">
  ```
