# Pantry Frontend — How It Works

> **This README answers HOW the frontend is implemented.** For the business rationale, see the [app-level README](../README.md). For the API contracts, see [`../backend/README.md`](../backend/README.md).

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| Framework | Next.js 15 (App Router, `src/app/[locale]/`) |
| Language | TypeScript (strict mode) |
| State / Fetching | TanStack Query v5 |
| Styling | Tailwind CSS (via CSS variables design tokens) |
| i18n | `@alfheim/shared` / `react-i18next` |
| Testing | Vitest + Testing Library (35 tests, 100% passing) |
| HTTP Client | `ky` (via `src/core/api.ts` — `pantryClient`) |

---

## 📁 Feature-Driven Directory Layout

```
src/
├── components/shared/  # Shared shell components (ClientHeader, Sidebar, PantryChatOverlay)
├── core/               # Cross-cutting concerns (auth, chat, HTTP client, utilities)
│   ├── api.ts          # pantryClient (ky instance) + type-safe fetcher
│   ├── authContext.tsx # useActiveHouseholdId hook (JWT → household_id)
│   ├── chatContext.tsx # usePantryChat hook + PantryChatProvider
│   └── utils.ts        # Shared utility helpers
│
├── features/
│   ├── analytics/
│   │   ├── components/
│   │   │   ├── AnalyticsView.tsx          # Orchestrator (~75 lines)
│   │   │   ├── ConsumptionChart.tsx       # Monthly OUT/WASTE bar chart
│   │   │   └── CategoryStockChart.tsx     # Category stock horizontal chart
│   │   └── index.ts                       # Barrel export
│   │
│   ├── categories/
│   │   ├── services/categoryService.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── inventory/
│   │   ├── components/
│   │   │   ├── DashboardView.tsx          # Orchestrator (~85 lines)
│   │   │   ├── MetricSummaryCards.tsx     # 4-column KPI grid
│   │   │   ├── AlertsFeed.tsx             # Expiration urgency feed
│   │   │   ├── ShoppingSyncPanel.tsx      # Low-stock → shopping export
│   │   │   ├── StockActionModal.tsx       # Orchestrator (~90 lines)
│   │   │   ├── ProductSearchStep.tsx      # Search + barcode lookup
│   │   │   ├── QuickProductForm.tsx       # Inline product creation
│   │   │   ├── QuickCategoryForm.tsx      # Inline category creation
│   │   │   ├── TransactionForm.tsx        # Qty/location/batch entry
│   │   │   ├── InventoryTableView.tsx     # Orchestrator (~90 lines)
│   │   │   ├── InventoryFilterBar.tsx     # Search + category/location filters
│   │   │   ├── InventoryTableRow.tsx      # Single stock row (null-safe)
│   │   │   ├── LedgerHistoryView.tsx      # Orchestrator (~75 lines)
│   │   │   ├── LedgerFilterBar.tsx        # Product/location filters
│   │   │   └── LedgerTableRow.tsx         # Single audit log entry row
│   │   ├── services/inventoryService.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── locations/
│   │   ├── components/
│   │   │   ├── LocationsGridView.tsx      # Orchestrator (~70 lines)
│   │   │   ├── LocationCard.tsx           # Single location card + badges
│   │   │   └── LocationCreateForm.tsx     # Inline provisioning form
│   │   ├── services/locationService.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   └── products/
│       ├── components/
│       │   ├── ProductCatalogView.tsx     # Orchestrator (~55 lines)
│       │   ├── ProductList.tsx            # Scrollable blueprint card feed
│       │   └── ProductCreateForm.tsx      # Right-panel creation form
│       ├── services/productService.ts
│       ├── types.ts
│       └── index.ts
│
├── app/[locale]/       # Next.js App Router pages (thin entry points)
│   ├── page.tsx        # → DashboardView
│   ├── inventory/      # → InventoryTableView
│   ├── ledger/         # → LedgerHistoryView
│   ├── locations/      # → LocationsGridView
│   ├── products/       # → ProductCatalogView
│   └── analytics/      # → AnalyticsView
│
└── tests/setup.ts      # Vitest global mock (localStorage/sessionStorage for JSDOM)
```

---

## 🏛️ Architecture Rules

1. **SRP Compliance**: All components must be under **200 lines**. View components are thin orchestrators that import domain subcomponents.
2. **Null Safety**: All `.map()`, `.length`, and `.filter()` calls on API data must use `?? []` fallbacks. No `!` non-null assertions on API-derived values.
3. **FDD Boundaries**: Features do not import from other features directly. Cross-feature types are imported from `@/features/<name>/types`.
4. **Core Separation**: HTTP client (`pantryClient`), auth context (`useActiveHouseholdId`), and utilities live exclusively in `src/core/`.
5. **Barrel Exports**: Each feature exposes a public API via its `index.ts` barrel file.

---

## 🧪 Running Tests

```bash
cd apps/pantry/frontend
npm run test          # Watch mode
npm run test -- --run  # Single run (CI)
```

All 35 tests across 9 test suites must pass before committing.
