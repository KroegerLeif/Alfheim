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

## Shopping

### Pantry Sync
- [ ] Define and implement explicit API contract for unresolved product reconciliation edge cases.

### Notifications
- [ ] Replace any remaining UI-only status badges with backend-driven status fields.

## Pantry

### Inventory / Analytics
- [ ] Add backend endpoint for aggregated low-stock trend history used by analytics widgets.

## Maintenance

### Device Monitoring
- [ ] Add backend endpoint for normalized device health timeline data used in dashboard widgets.

## Shared (`@loeger-os/shared`)

### i18n
- [ ] Keep locale parity checks for `common`, `dashboard`, `shopping`, `pantry`, `maintenance` dictionaries.

### Theme
- [ ] Add automated token completeness check to ensure every theme variant defines both light and dark values.
