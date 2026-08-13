# Dashboard Frontend Architecture Audit (`apps/dashboard/frontend`)

This document captures the audited state of the Next.js App Router frontend application.

### 📁 Directory Structure & Feature Folders

```
src/
├── app/                           # Next.js App Router route components
│   ├── globals.css                # Custom global CSS styles
│   ├── layout.tsx                 # Root layout wrapper (injects global providers)
│   ├── page.tsx                   # Main Dashboard landing page (3-Tier App Grid)
│   ├── settings/                  # App Settings page (Theme picker & Core App toggles)
│   └── household/                 # Household management route
├── core/                          # Core engine layer (domain-agnostic global setups)
│   ├── api/
│   │   └── client.ts              # Centralized ky instance with auth & refresh handling
│   └── providers/                 # Global providers (Auth, Query, Theme, Language)
├── features/                      # Business domain features (local components & hooks)
│   ├── apps/                      # 3-Tier Apps & Link Management
│   │   ├── components/            # AddAppModal (Tier 3 User Links), EditAppModal
│   │   └── queries.ts             # useDashboardApps, useUserPreferences, useCreateUserLink
│   ├── contact/                   # Contacts management domain
│   ├── dashboard/                 # System landing feature components (SystemHealthWidget, SystemShellLogs)
│   ├── household/                 # Household management domain
│   └── profile/                   # Profile features
└── shared/                        # Shared UI components and types
    ├── api.ts                     # Generic REST endpoints (profile, dashboard apps, telemetry)
    ├── components/                # Presentation layout wrappers (Header, Sidebar, BottomNavBar)
    └── types.ts                   # Unified monorepo DTO type contracts (TierType, AppItem, DashboardAppsResponse)
```

---

## 🛣️ Page Routing Breakdown

1. **`/` (Dashboard Root)**: Displays live telemetry stats, interactive terminal log feed, and the **3-Tier Application Grid**:
   - **Tier 1 (Core Applications):** Pre-built native modules (`pantry`, `shopping`, `maintenance`, `chores`).
   - **Tier 2 (Stack Integrations):** Integrations defined in `deploy/stack-apps.yaml` and role-filtered via Keycloak.
   - **Tier 3 (My Personal Links):** Custom user bookmarks managed with `AddAppModal` and `EditAppModal`.
2. **`/settings` (App Settings)**: Visual theme configuration & **Core Application Visibility Toggle** panel (Tier 1 preferences).
3. **`/household` & `/household/[id]`**: Household selection and detailed household overview.
4. **`/profile`**: Form page for updating user profile details synced to Keycloak.

---

## 🪝 API Query Hooks (`features/apps/queries.ts`)

- **`useDashboardApps`**: Queries `GET /api/v1/apps/dashboard` returning unified 3-tier app payload.
- **`useUserPreferences`**: Queries `GET /api/v1/user/preferences`.
- **`useUpdateUserPreferences`**: Mutation `PUT /api/v1/user/preferences` (toggles hidden Core Apps).
- **`useCreateUserLink`**: Mutation `POST /api/v1/user/links` (creates custom Tier 3 user bookmark).
- **`useUpdateUserLink`**: Mutation `PUT /api/v1/user/links/{id}`.
- **`useDeleteUserLink`**: Mutation `DELETE /api/v1/user/links/{id}`.
