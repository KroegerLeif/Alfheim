# Dashboard Frontend Architecture Audit (`apps/dashboard/frontend`)

This document captures the audited state of the Next.js App Router frontend application.

### 📁 Directory Structure & Feature Folders

```
src/
├── app/                           # Next.js App Router route components
│   ├── globals.css                # Custom global CSS styles
│   ├── layout.tsx                 # Root layout wrapper (injects global providers)
│   ├── page.tsx                   # Main Dashboard landing page (/)
│   └── household/                 # Household management route
│       ├── page.tsx               # Selector & Zero-state dashboard list / creation page
│       └── [id]/                  # Household detail dynamic sub-route
│           └── page.tsx           # SRP: Async server wrapper unwrapping dynamic param promise
├── core/                          # Core engine layer (domain-agnostic global setups)
│   ├── api/
│   │   └── client.ts              # Centralized ky instance with auth & refresh handling
│   └── providers/                 # Relocated global providers (Auth, Query, Theme, Language)
├── features/                      # Business domain features (local components & hooks)
│   ├── apps/                      # Apps catalog components and hooks
│   │   ├── components/            # AddAppModal, EditAppModal components
│   │   └── queries.ts             # Catalog query & mutation hooks
│   ├── contact/                   # Contacts management domain
│   │   ├── api/                   # Contacts & Categories HTTP client endpoints
│   │   ├── hooks/                 # Custom TanStack hooks (useContacts, useCategories)
│   │   └── components/            # ContactCards, CategoryManager, ContactModal, CategoryModal
│   ├── dashboard/                 # System landing feature components
│   │   └── components/            # SystemHealthWidget, SystemShellLogs components
│   ├── household/                 # Household management domain
│   │   ├── api/                   # Household REST endpoints
│   │   ├── hooks/                 # Custom TanStack hooks (useHousehold, useHouseholds, etc.)
│   │   └── components/            # HouseholdDetailView, MemberGrid, MapAddressBanner, InviteModal
│   └── profile/                   # Profile features
├── middleware.ts                  # Handles locale path rewrites (e.g. /de/household -> /household)
└── shared/                        # Shared UI components and types
    ├── api.ts                     # Generic REST endpoints (profile, app catalog, telemetry)
    ├── components/                # Presentation layout wrappers (Header, Sidebar, BottomNavBar)
    └── types.ts                   # Unified monorepo DTO type contracts
```

---

## 🛣️ Page Routing Breakdown & Bottlenecks

1. **`/` (Dashboard Root)**: Displays system health telemetry charts, the live terminal shell feed, and categories of launched/registered applications.
2. **`/household` (Household Selector)**: Displays a zero-state dashboard selection panel, a grid of active households for quick navigation, and forms/modals to create or join a household.
3. **`/household/[id]` (Household Detail Dashboard)**: Renders a single household's dashboard, including a full-width geocoded Leaflet map widget, address descriptors, member registry lists, invite tokens, contact categories, and contact book details in a clean sub-routing boundary.
4. **`/profile` (User Profile)**: Form page for updating the user profile details synced back to database & Keycloak.
5. **`/settings` (App Settings)**: Page for changing active language and theme color variants.
6. **`/under-construction` (Under Construction)**: Informative splash screen shown when booting up maintenance/disabled services.

---

## 🕸️ Traefik Routing Rules Integration

In `apps/dashboard/compose.yml`, Traefik delegates incoming traffic to the frontend service running on port `3000` via these rule definitions:

```yaml
labels:
  - "traefik.enable=true"
  # Match host 'alfheim' and root sub-paths
  - "traefik.http.routers.dashboard-frontend.rule=Host(`alfheim`) && PathPrefix(`/`)"
  - "traefik.http.routers.dashboard-frontend.entrypoints=web"
  - "traefik.http.routers.dashboard-frontend.service=dashboard-frontend"
  # Low priority fallback to prevent frontend overriding specific backend api route prefixes
  - "traefik.http.routers.dashboard-frontend.priority=1"
  - "traefik.http.services.dashboard-frontend.loadbalancer.server.port=3000"
```

---

## 📦 State Providers & API Hook Inventory

### 🔑 State Providers
- **`AuthProvider`** (`src/shared/providers/AuthProvider.tsx`): Integrates `keycloak-js` to enforce session logins, handle client-side token exchanges via PKCE, and execute silent token refreshes (every 60s).
- **`QueryProvider`** (`src/shared/providers/QueryProvider.tsx`): Wraps TanStack Query clients for caching server requests.
- **`ThemeProvider`** (`@alfheim/shared` component library): Configures the active system visual theme (e.g. `obsidian`, `kinetic`, `slate`, `custom`), sets corresponding class values (`.dark` / `.light`) for Tailwind, and injects customized raw CSS variable values.
- **`LanguageProvider`** (`@alfheim/shared` component library): Resolves preferred locales (`de`, `en`, `pl`) from cookies or localStorage and provisions appropriate translations.

### 🪝 API Query Hooks
- **`useAppCatalog`** (`features/apps/queries.ts`): Queries `GET /api/v1/apps`.
- **`useCreateApp`** (`features/apps/queries.ts`): Mutation `POST /api/v1/apps`.
- **`useUpdateApp`** (`features/apps/queries.ts`): Mutation `PUT /api/v1/apps/{id}`.
- **`useHouseholds`** (`features/household/queries.ts`): Queries `GET /api/v1/households/me`.
- **`useCreateHousehold`** (`features/household/queries.ts`): Mutation `POST /api/v1/households`.
- **`useCreateInvite`** (`features/household/queries.ts`): Mutation `POST /api/v1/households/invite`.
- **`useJoinHousehold`** (`features/household/queries.ts`): Mutation `POST /api/v1/households/join`.
- **`useContacts`** (`features/contact/queries.ts`): Queries `GET /api/v1/households/{id}/contacts`.
- **`useCreateContact`** (`features/contact/queries.ts`): Mutation `POST /api/v1/households/{id}/contacts`.
- **`useUpdateContact`** (`features/contact/queries.ts`): Mutation `PUT /api/v1/households/{id}/contacts/{contactId}`.
- **`useDeleteContact`** (`features/contact/queries.ts`): Mutation `DELETE /api/v1/households/{id}/contacts/{contactId}`.
- **`useCategories`** (`features/contact/queries.ts`): Queries `GET /api/v1/households/{id}/contact-categories`.
- **`useCreateCategory`** (`features/contact/queries.ts`): Mutation `POST /api/v1/households/{id}/contact-categories`.
- **`useUpdateCategory`** (`features/contact/queries.ts`): Mutation `PUT /api/v1/households/{id}/contact-categories/{catId}`.
- **`useDeleteCategory`** (`features/contact/queries.ts`): Mutation `DELETE /api/v1/households/{id}/contact-categories/{catId}`.
- **Household Management Hooks** (Moved to `features/household/queries.ts` to follow SRP):
  - `useUpdateHouseholdAddress`: Mutation `PUT /api/v1/households/{id}/address`.
  - `useUpdateMemberRole`: Mutation `PUT /api/v1/households/{id}/members/{userId}/role`.
  - `useRemoveMember`: Mutation `DELETE /api/v1/households/{id}/members/{userId}`.

---

## 🗺️ Leaflet Map Integration & Hydration Issues

### 🌍 OSM Map Viewer
The OpenStreetMap (OSM) leaflet integration resides in the shared library:
[`packages/shared/src/features/ui/components/OSMMapViewer.tsx`](file:///Users/leifkroeger/Dev/alfheim/packages/shared/src/features/ui/components/OSMMapViewer.tsx).
- Renders custom HTML markers and binds interactive popups containing contact address info.
- It is imported dynamically inside the household view to disable server-side pre-rendering (since Leaflet relies heavily on DOM globals):
  ```typescript
  const OSMMapViewer = dynamic(
    () => import('@alfheim/shared').then((mod) => mod.OSMMapViewer),
    { ssr: false }
  );
  ```
- **Shared Library Bottleneck**: Because `@alfheim/shared` exposes exports via a central index file (`packages/shared/src/index.ts`), importing *any* module from this library (such as providers or translators in `layout.tsx`) implicitly imports the entire shared bundle on the server. This executes top-level imports in `OSMMapViewer.tsx` (like `leaflet/dist/leaflet.css`), which can disrupt server rendering or bloat server bundles.

---

## ⚠️ Client Hydration Warning / Mismatch Analysis

When booting the application in development, Next.js outputs standard console hydration warning logs:

```
Warning: Prop `className` did not match. Server: "h-full antialiased dark" Client: "h-full antialiased light"
Warning: Prop `data-theme` did not match. Server: "obsidian" Client: "kinetic"
Extra attributes from the server: data-theme, class
```

### Cause of Mismatch:
1. **Server Rendering (SSR)**: Next.js pre-renders HTML using defaults. On the server side, `typeof window` is undefined, meaning `ThemeProvider` and `LanguageProvider` state initializations fall back to static presets (`dark` mode, German `de` locale, and `obsidian` theme variant).
2. **Client Hydration**: When the bundle runs in the browser, `window` becomes available. The providers read settings previously configured by the user stored in client-side cookies (`NEXT_LOCALE`) and `localStorage` (`alfheim_theme_override`).
3. If the user had previously selected Light mode or English language, the client immediately updates the HTML attributes during page loading. Since this rendered outcome differs from the pre-generated server HTML, React throws a hydration mismatch error.
4. **Missing Fix**: The root element inside `src/app/layout.tsx` is missing the `suppressHydrationWarning` attribute on the `<html>` and `<body>` tags, which is necessary when structural CSS/class injection occurs based on browser-only local storage data.
