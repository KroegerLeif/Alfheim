# Loeger OS Dashboard Micro-Service (`apps/dashboard`)

The Dashboard is the central control plane, authentication entrypoint, and telemetry interface for the `loeger-os` platform. It comprises a Go control plane backend and a React/Next.js frontend.

---

## 🏗️ Architecture & Network Communication (Traefik)

The frontend and backend services are decoupled and run in isolated Docker containers, coordinated by Traefik as the reverse proxy. 

```mermaid
graph TD
    Client[Web Browser Client] -->|HTTP Host: loeger-os| Traefik[Traefik Reverse Proxy]
    Traefik -->|PathPrefix: /api/v1/...| GoBackend[Go Backend Control Plane :8080]
    Traefik -->|PathPrefix: / (Fallback)| NextFrontend[Next.js Frontend :3000]
    GoBackend -->|SQL| Postgres[(PostgreSQL DB)]
    GoBackend -->|OIDC Token Validation| Keycloak[Keycloak OIDC]
```

### Routing Rules (Ingress vs. Application)
- **Ingress Gateway (Traefik)**: Routes top-level hosts and path prefixes. Traefik routes `/api/v1/apps`, `/api/v1/profile`, `/api/v1/households`, or `/api/v1/telemetry` to the Go backend, `/api/v1/chores` to the chores-backend, `/chores` to the chores-frontend (with default language redirect `/chores` ➔ `/chores/de`), and delegates all other requests under `/` to the Next.js dashboard-frontend container.
- **Application Page Routing (Next.js)**: Handles all internal route paths (e.g., `/household`, `/household/[id]`, `/profile`, `/settings`) and dynamic parameter evaluation. Next.js does not rely on Traefik routing rules for internal sub-routing.

---

## 📦 Monorepo Separation of Concerns & FDD

Components and libraries are strictly separated to maintain clean architectures and prevent circular dependencies:

### 1. `@loeger-os/shared` UI Library (Workspace Package)
- Located in [`packages/shared/`](file:///Users/leifkroeger/Dev/loeger-os/packages/shared).
- Statically agnostic UI widgets (`Sidebar`, `Header`, `BottomNavBar`), localization (`LanguageProvider`), and presentation components (`OSMMapViewer`, `AddressAutocomplete`).

### 2. Core Engine Layer (`apps/dashboard/frontend/src/core/`)
- Contains global core logic that is application-wide but domain-agnostic, such as the centralized HTTP `ky` instance [`client.ts`](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/frontend/src/core/api/client.ts) and global state provider contexts [`src/core/providers/`](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/frontend/src/core/providers/).

### 3. Local Feature Modules (`apps/dashboard/frontend/src/features/`)
- Organized around business capability folders (e.g. `household`, `contact`, `profile`, `apps`).
- Each feature folder contains its own queries, API calls, and components (e.g. `src/features/household/api/`, `src/features/household/hooks/`, `src/features/household/components/`).
- Feature boundaries are strict; files must not import from internal files of other feature modules.

---

## 🎨 Stacking Contexts & Z-Index Layer Standards

To prevent visual overlapping conflicts with complex map renders like Leaflet (`z-index: 400`):
- **Map Isolation**: Wrap map elements in parent containers using Tailwind's `relative z-0 isolate overflow-hidden` to isolate the leaflet stacking context.
- **Modal Backdrops**: All full-screen overlays and modal containers must use `z-[9999]` and absolute/fixed positioning to always float above the map layer.

---

## 🎯 Single Responsibility Layout Refactoring Strategy

Currently, the frontend suffers from monolithic page designs that violate the **Single Responsibility Principle (SRP)**. Specifically:
- [`src/app/household/page.tsx`](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/frontend/src/app/household/page.tsx) is a single massive file (1,084 lines, ~45KB) managing household selection, creation, joins, address edits, members list, category management, and contact logs.
### Clean Architecture Layout:
We have refactored the monolithic page to a clean Next.js App Router sub-routing design:

```
src/app/
├── household/
│   ├── page.tsx                     # Main Selection Selector / zero-state list / creation page
│   └── [id]/
│       └── page.tsx                 # SRP: Household Detail Overview, Map Banner, Member registry list, and Contacts Directory
```

### Benefits of the Refactoring:
1. **Route-based Isolation**: Each view only loads the state and queries required for its specific task.
2. **Simplified Components**: Reduced file sizes and removed nested modal conditional rendering.
3. **Decoupled API Hooks**: Moved member role, address, and deletion mutations out of the contact module and into the household domain features folder where they belong.
4. **Pruning Shared Imports**: Decoupled routes allow clean dynamic imports of heavy modules like Leaflet `OSMMapViewer` to prevent bundler pollution on simple listing pages.

---

## 📑 System Documentation

For detailed analysis and specifications, please refer to:
- [Go Backend Audit & Schema README](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/backend/README.md)
- [React/Next.js Frontend Audit README](file:///Users/leifkroeger/Dev/loeger-os/apps/dashboard/frontend/README.md)

