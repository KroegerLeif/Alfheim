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

### Routing Rules (Ingress)
- **Go Backend (`dashboard-backend`)**: Listens internally on port `8080`. Traefik routes requests matching host `loeger-os` with path prefixes `/api/v1/apps`, `/api/v1/profile`, `/api/v1/households`, or `/api/v1/telemetry` to this service.
- **Next.js Frontend (`dashboard-frontend`)**: Listens internally on port `3000`. Traefik delegates all other requests under `/` to the Next.js container (e.g. `/household`, `/profile`, `/settings`) with a fallback priority of `1`.

---

## 📦 Monorepo Separation of Concerns

To keep code clean and maintainable, components are separated between local application spaces and shared workspaces:

### 1. `@loeger-os/shared` UI Library (Workspace Package)
- Located in [`packages/shared/`](file:///Users/leifkroeger/Dev/loeger-os/packages/shared).
- Contains stateless layout widgets (`Sidebar`, `Header`, `BottomNavBar`), multi-language localization utilities (`LanguageProvider`, `LanguageContext`), dynamic CSS variables theming engines (`ThemeProvider`, `ThemeContext`), and reusable complex components like `OSMMapViewer` and `AddressAutocomplete`.
- **Constraint**: Must remain agnostic of dashboard-specific API endpoints and focus entirely on presentation, token systems, and platform-wide states.

### 2. Local Features (`apps/dashboard/frontend/src/features`)
- Houses dashboard-specific query hooks, mutations, and domain modals (e.g., `AddAppModal`, `EditAppModal`).
- Integrates the business logic of the dashboard (e.g. mapping the user's active household to contact endpoints).

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

