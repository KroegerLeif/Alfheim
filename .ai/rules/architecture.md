# Architectural Boundaries & Rules (`.ai/rules/architecture.md`)

This document defines the strict, non-negotiable architectural rules regarding routing delegation, Feature-Driven Design boundaries, file length limitations, and z-index visual layering.

---

## 🚦 Rule 1: Ingress Route Delegation vs. Internal App Routing

To maintain clear boundary isolation between the proxy gateway and application codebases:

### 1. Ingress Routing (Caddy)
* **Caddy** operates solely as an ingress reverse-proxy gateway (`infrastructure/caddy/Caddyfile`). It delegates external HTTP requests across dual domains (`alfheim.loegien.de` / `alfheim.loegien.localhost` for frontends and `api.alfheim.loegien.de` / `api.alfheim.loegien.localhost` for backends) to decoupled Docker containers.
* Ingress routers do **NOT** handle internal page sub-routing.

### 2. Internal Sub-Routing (Next.js App Router)
* The **Next.js App Router** is responsible for all internal route transitions, layout hierarchies, dynamic path parameters (e.g., `/household/[id]`), and page hydration.
* Never write routing hacks or proxy redirects at the gateway level for path parameters that belong inside the application's React routing state.

---

## 📦 Rule 2: FDD Directory Isolation & File Length Constraints

Monolithic files violate the **Single Responsibility Principle (SRP)** and impair readability and maintainability.

### 1. FDD Folder Boundaries
* All feature-related logic (queries, API calls, dialog forms, list items, maps) must reside in a dedicated folder under `src/features/<domain>/`:
  - `src/features/<domain>/api/` for raw HTTP network requests.
  - `src/features/<domain>/hooks/` for TanStack Query wrappers.
  - `src/features/<domain>/components/` for domain-specific UI components.
* Direct query imports or raw fetch calls inside page wrappers are forbidden.
* Cross-cutting concerns belong in `src/core/` (HTTP client, global providers) or `src/shared/` (presentation primitives).

### 2. Strict File Length Limits (SRP)
* **Component & View files** must NEVER exceed **200 lines of code**.
* If a component grows near this limit, immediately split it into smaller, isolated, single-responsibility subcomponents (e.g., factoring forms into modals, list items into card widgets, and container layouts into separate layout views).

---

## 🎨 Rule 3: Stacking Contexts (Leaflet Z-Index Isolation)

Leaflet maps use high default z-indexes (`z-index: 400+`), which cause map elements to bleed through overlay backdrops and float on top of modals.

### 1. Map Containment
* Wrap every instance of `<OSMMapViewer />` in a parent container configured with Tailwind's isolation and positioning utilities to isolate its stacking context:
  ```html
  <div className="relative z-0 isolate overflow-hidden">
    <OSMMapViewer ... />
  </div>
  ```
* The `isolate` class forces a new local stacking context, preventing Leaflet's high-z-index layers from escaping the map block.

### 2. Modal Overlay Layering
* All global modals and screen overlays must use a z-index class of `z-[9999]` and absolute/fixed positioning to sit safely above map containers:
  ```html
  <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm">
  ```

---

## 🔒 Rule 4: OIDC Token Validation & Docker Network Backchannel Isolation

To prevent 401 Unauthorized errors caused by host issuer mismatches:
* **Browser OIDC Operations**: Frontend clients interact with Keycloak via the external API Gateway URL (`http://api.alfheim.loegien.localhost/auth`).
* **Backend JWKS Key Fetching**: Microservice backends fetch Keycloak public certificates via the internal Docker network (`http://keycloak:8080/auth/realms/alfheim/protocol/openid-connect/certs`).
* **Token Issuer Verification**: Backend JWT verification routines MUST decouple signature verification from host-string constraints so tokens issued externally via Caddy pass internal container validation seamlessly.

---

## 🌐 Rule 5: Multi-Zone Docker Network Segmentation

To prevent security leaks and internal cross-talk between isolated application databases:
* **`gateway-net`**: Reserved exclusively for Caddy reverse proxy ingress traffic to frontends, Keycloak OIDC, RustFS S3, and API backend routes.
* **`infra-net`**: Connects core infrastructure services (Keycloak, `postgres-iam`, RustFS S3).
* **`core-net`**: Connects control plane services (`dashboard-backend` ↔ `dashboard-db`).
* **`app-<name>-net`**: Strictly isolates application backends to their dedicated database containers (e.g., `app-pantry-net`, `app-shopping-net`). Microservice backends must **NEVER** join another microservice's internal DB network.
* **Inter-Service API Calls**: Cross-application backend communications MUST take place via `gateway-net` (or public API routes), not by mounting third-party DB networks.

---

## 🗄️ Rule 6: Centralized RustFS S3 Object Storage & Tenant Isolation

All binary media assets (product photos, PDFs, avatar images, device manuals) MUST be stored centrally in RustFS (S3-compatible object storage):
* **No Direct File Storage**: Microservices must not store binary upload blobs directly on local container filesystems or inside PostgreSQL databases.
* **Tenant-Isolated Path Convention**:
  * Shared Household Assets: `households/{household_id}/{app_name}/{filename}`
  * Private User Assets: `users/{user_id}/{app_name}/{filename}`
* **Presigned URLs**: Microservices generate short-lived presigned PUT/GET URLs via `aioboto3` / `src/core/storage.py` and pass them to frontends for direct client-to-RustFS uploads and downloads via Caddy (`http://api.alfheim.loegien.localhost/storage/`).
