# Next.js & Tailwind CSS v4 Architectural Guide (`.ai/stacks/nextjs_tailwind.md`)

> **Note for AI Agents**: Always read [.ai/rules/core.md](.ai/rules/core.md) first.

---

## 1. Overview & Stack Specifications

* **Framework**: Next.js 14+ (App Router)
* **Styling**: Tailwind CSS v4
* **Data Fetching & State**: TanStack Query (React Query v5) + `ky` / Centralized Typed HTTP Client Wrappers
* **Type Safety**: TypeScript 5.x + Zod schemas

---

## 2. Feature-Driven Frontend Architecture

Frontend applications are structured into feature modules under `src/features/` and cross-cutting modules under `src/shared/`:

```text
src/
├── app/                      # Next.js App Router pages, layouts, and route handlers only
│   ├── layout.tsx
│   ├── page.tsx
│   └── (routes)/
├── features/                 # Domain-driven feature modules
│   └── <domain>/             # e.g., pantry, shopping, user-profile
│       ├── components/       # Feature-specific UI components
│       │   ├── item-card.tsx
│       │   └── item-list.tsx
│       ├── hooks/            # TanStack Query custom hooks (use-pantry-items.ts)
│       ├── api/              # Feature-specific API calls using shared fetch client
│       ├── types/            # TypeScript interfaces & Zod schemas for domain
│       └── index.ts          # Public interface barrel file for feature
└── shared/                   # Domain-agnostic primitives & global utilities
    ├── api.ts                # Centralized typed fetch client instance
    ├── components/           # Generic design system components (Button, Input, Modal)
    ├── hooks/                # Generic utility hooks (use-debounce.ts)
    └── lib/                  # Utility functions (cn, formatters)
```

---

## 3. Data Fetching Rules: TanStack Query & Centralized HTTP Client

### 1. Centralized Typed API Client (`src/shared/api.ts` or `src/core/api/client.ts`)
* All external HTTP communication MUST go through centralized API client wrappers (using `ky` instances with configured prefix URLs, timeouts, and request/response hooks).
* Direct, unconfigured `fetch()` calls inside components or feature files are prohibited; always use the centralized API client wrapper.

```typescript
// src/shared/api.ts or src/core/api/client.ts
import ky from 'ky';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api.alfheim.loegien.localhost/api/v1';

export const api = ky.create({
  prefixUrl: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window !== 'undefined') {
          const token = sessionStorage.getItem('alfheim_access_token');
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
          }
          const activeHhId = localStorage.getItem('alfheim_active_household_id');
          if (activeHhId) {
            request.headers.set('X-Household-ID', activeHhId);
          }
        }
      },
    ],
  },
});
```

### 2. TanStack Query Hooks
* Wrap all API calls inside custom hooks using `@tanstack/react-query` inside `src/features/<domain>/hooks/`.
* Component files should consume data via hooks, keeping UI rendering separate from query configuration.

---

## 4. Strict Tailwind CSS v4 Theme Pairing Rules

To ensure complete dark mode compatibility and maintainable design systems, AI agents must strictly follow these Tailwind rules:

* ❌ **NO Hardcoded Hex Values**: Never use arbitrary color utilities like `bg-[#0f172a]`, `text-[#1e293b]`, or `border-[#e2e8f0]`.
* ✅ **Mandatory Dynamic Theme Classes**: Every background, text color, and border MUST pair light and dark mode classes using standard color tokens.

### Theme Class Pairing Reference Table:

| UI Role | Light Mode / Dark Mode Pair | Example |
| :--- | :--- | :--- |
| **Page Background** | `bg-slate-50 dark:bg-slate-950` | `<main className="bg-slate-50 dark:bg-slate-950">` |
| **Card / Surface Background** | `bg-white dark:bg-slate-900` | `<div className="bg-white dark:bg-slate-900">` |
| **Primary Text** | `text-slate-900 dark:text-slate-100` | `<h1 className="text-slate-900 dark:text-slate-100">` |
| **Muted / Secondary Text** | `text-slate-600 dark:text-slate-400` | `<p className="text-slate-600 dark:text-slate-400">` |
| **Subtle Borders** | `border-slate-200 dark:border-slate-800` | `<div className="border border-slate-200 dark:border-slate-800">` |
| **Hover States** | `hover:bg-slate-100 dark:hover:bg-slate-800` | `<button className="hover:bg-slate-100 dark:hover:bg-slate-800">` |

---

## 5. Quality Gate & Compilation Commands

Verify build and type correctness before completing any Next.js task:

```bash
# Workspace frontend verification (type checking & tests)
./scripts/verify.sh --frontend

# Type check TypeScript files across frontend packages
pnpm check-types # or pnpm --recursive exec tsc --noEmit

# Next.js build verification
pnpm build
```
