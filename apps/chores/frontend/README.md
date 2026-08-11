# Chores Frontend — How It Works

> **This README answers HOW the frontend is implemented.** For the business rationale, see the [app-level README](../README.md). For the API contracts, see [`../backend/README.md`](../backend/README.md).

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| Framework | Next.js 16 (App Router, `src/app/[locale]/`) |
| Language | TypeScript (strict mode) |
| State / Fetching | TanStack Query v5 |
| Styling | Tailwind CSS v4 (via CSS variables design tokens) |
| i18n | `@alfheim/shared` / `next-intl` |
| HTTP Client | `ky` (via `src/core/api.ts` — `choresClient`) |

---

## 📁 Feature-Driven Directory Layout

```
src/
├── core/               # Cross-cutting concerns (auth, HTTP client, utilities)
│   ├── api.ts          # choresClient (ky instance) + type-safe fetcher
│   ├── authContext.tsx # useActiveHouseholdId hook (JWT → household_id)
│   └── utils.ts        # Shared utility helpers (cn, formatDate)
│
├── features/
│   └── chore_management/
│       ├── components/
│       │   ├── DashboardView.tsx          # Dashboard Orchestrator
│       │   ├── ChoresList.tsx             # Checkbox task listings
│       │   ├── GoalProgress.tsx           # Streaks & progress indicators
│       │   ├── BoardView.tsx              # Board Orchestrator
│       │   ├── TaskCard.tsx               # Bento-style blueprint cards
│       │   ├── FilterBar.tsx              # Search & Priority tab selection
│       │   ├── InsightsView.tsx           # Insights Orchestrator
│       │   ├── GoalDonutChart.tsx         # SVG category donut distribution chart
│       │   ├── WizardView.tsx             # Wizard Form Orchestrator
│       │   └── WizardSteps.tsx            # Multi-step creation form wizard steps
│       ├── services/choresService.ts      # TanStack query and mutation hooks
│       ├── types.ts                       # TypeScript interfaces
│       └── index.ts                       # Barrel export
│
├── app/[locale]/       # Next.js App Router pages (thin entry points)
│   ├── page.tsx        # → DashboardView
│   ├── board/          # → BoardView
│   ├── insights/       # → InsightsView
│   └── wizard/         # → WizardView
```

---

## 🏛️ Architecture Rules

1. **SRP Compliance**: All components must be under **200 lines**. View components are thin orchestrators that import domain subcomponents.
2. **Null Safety**: All `.map()`, `.length`, and `.filter()` calls on API data must use `?? []` fallbacks. No `!` non-null assertions on API-derived values.
3. **FDD Boundaries**: Features do not import from other features directly. Cross-feature types are imported from `@/features/<name>/types`.
4. **Core Separation**: HTTP client (`choresClient`), auth context, and utilities live exclusively in `src/core/`.
