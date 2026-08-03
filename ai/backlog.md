# Loeger-OS Central Backlog

Living backlog for missing endpoints, cross-app gaps, and pending integration tasks.

## Dashboard

### Catalog / Services
- [ ] Validate that all dashboard edit flows use persisted backend data only (no fallback static placeholders).

### Household
- [ ] Add endpoint-level contract documentation for invite code generation/join error states.

### Notifications
- [ ] Add real-time SSE/WebSocket backend endpoint for notification stream and header unread badge counter.

### System Shell / Telemetry
- [ ] Add backend endpoint for streaming live container/shell logs directly to the dashboard terminal widget.

### Stale Code
- [ ] Remove unused `apps/dashboard/frontend/src/shared/providers/ThemeProvider.tsx` since the application relies entirely on `@loeger-os/shared` theme infrastructure.

## Shopping

### Household / Pantry Target
- [x] Implement backend endpoint `GET /api/v1/households/me` to provide authenticated user's active household targets for checkout storage.

### Pantry Sync
- [ ] Define and implement explicit API contract for unresolved product reconciliation edge cases.

### Middleware & Routing
- [x] Rename `proxy.ts` → `middleware.ts` so Next.js recognizes the next-intl locale middleware.
- [x] Fix React Rules of Hooks violation in `page.tsx` — hooks were called after conditional early returns.
- [x] Add `error.tsx` error boundary in `[locale]` route for graceful crash recovery.
- [ ] Verify locale negotiation works end-to-end in local dev (without Traefik redirect fallback).

### Notifications
- [ ] Replace any remaining UI-only status badges with backend-driven status fields.

## Pantry

### Inventory / Analytics
- [ ] Add backend endpoint for aggregated low-stock trend history used by analytics widgets.
- [ ] Add backend endpoint for external barcode scan auto-fill / OpenFoodFacts catalog integration.
- [ ] Add backend endpoint for CSV bulk export/import for physical inventory audits.

## Maintenance

### Device Monitoring
- [ ] Add backend endpoint for normalized device health timeline data used in dashboard widgets.

### Notifications & System Alerts
- [ ] Add backend notification stream endpoint (`GET /api/v1/maintenance/notifications`) for real-time system alerts and header counter.

### Documentation & Manuals
- [ ] Add backend endpoint for device manuals and attachment documents (`GET /api/v1/maintenance/devices/{id}/manuals`).

### Shopping Cart Integration
- [ ] Add backend export/integration endpoint (`POST /api/v1/maintenance/shopping-export`) for dispatching maintenance supply items directly to the Shopping app.

## Shared (`@loeger-os/shared`)

### i18n
- [ ] Keep locale parity checks for `common`, `dashboard`, `shopping`, `pantry`, `maintenance` dictionaries.

### Theme
- [ ] Add automated token completeness check to ensure every theme variant defines both light and dark values.
