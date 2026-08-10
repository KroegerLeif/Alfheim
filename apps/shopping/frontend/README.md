# Shopping Checklist Frontend (`apps/shopping/frontend/`)

A standalone localized Next.js 15 application powering the checklist dashboard.

---

## ⚡ Tech Stack & Libraries

* **Core**: Next.js 15 (App Router), React 19.
* **State & Query**: TanStack Query v5 (React Query) for server caching, Context API for sidebar & active list selections.
* **HTTP Client**: Ky HTTP client wrapper utilizing JWT token interceptors.
* **Localization**: `next-intl` supporting English (`en`), German (`de`), and Polish (`pl`) translation subpaths.
* **Auth**: Keycloak-js OIDC flow securing client sessions.

---

## 📁 Folder Structure & Split-Component Architecture

The frontend conforms to the **Feature-Driven Design (FDD)** layout, separating domain features from shared layout primitives:

```text
src/
├── app/
│   └── [locale]/
│       ├── providers.tsx   # QueryClient, Keycloak Auth, Contexts
│       ├── layout.tsx      # Font variables and structural frame
│       └── page.tsx        # Dashboard page shell (ShoppingDashboard)
├── components/
│   └── shared/
│       ├── Header.tsx      # Global title and hamburger toggle
│       ├── Sidebar.tsx     # Navigation panel using split sidebar items
│       └── sidebar/        # Split sidebar subcomponents
│           ├── SidebarItem.tsx       # System lists (Personal/Household)
│           ├── SidebarCustomItem.tsx # Custom list (drag-and-drop support)
│           └── CreateListForm.tsx    # Inline list creation form
├── features/
│   ├── shopping-history/   # Selection metrics and history tiles
│   └── shopping-lists/     # Core checklist logic
│       ├── components/
│       │   ├── ChecklistContainer.tsx # Category groupings scroll list
│       │   ├── ItemRow.tsx            # Single checkbox row
│       │   ├── AddManualItem.tsx      # Stepper form for list additions
│       │   ├── DashboardHeader.tsx    # Progress ring & toolbar controls
│       │   ├── EinlagernModal.tsx     # Wizard resolution modal
│       │   ├── EinlagernItemRow.tsx   # Wizard item editing row
│       │   ├── ListSelector.tsx       # Tab reorder navigation bar
│       │   └── ListTab.tsx            # List selector single tab wrapper
│       └── utils/
│           └── category.ts # Isolated string-matching categorization
└── lib/
    ├── api.ts              # Ky clients configuration
    └── useKeycloakUser.ts  # Keycloak JWT claim parser hook
```

---

## 🔑 Session & Authentication

Authentication is verified on mount in [`providers.tsx`](file:///Users/leifkroeger/Dev/alfheim/apps/shopping/frontend/src/app/[locale]/providers.tsx):
1. Secure session initialization checks Keycloak status.
2. Interceptors in [`src/lib/api.ts`](file:///Users/leifkroeger/Dev/alfheim/apps/shopping/frontend/src/lib/api.ts) inject the Bearer token into every API call.
3. Automatically sets the `X-Household-ID` header corresponding to the active selection.

---

## 🛠️ Run & Development Commands

Install workspace dependencies and run locally:
```bash
# Install packages
pnpm install

# Run dev server on Port 3010
pnpm dev

# Type check and build standalone production bundles
pnpm build

# Run unit and visual tests
pnpm test
```
