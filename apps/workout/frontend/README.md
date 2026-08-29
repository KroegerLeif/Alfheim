# Workout Frontend

Next.js 16 (App Router) frontend for the `workout` app.

## Data-layer convention

This app follows the `.ai`-documented data-layer convention rather than the
`services/` layout used by `pantry`/`chores`:

* `src/features/<domain>/api/` — raw HTTP calls (via the shared `ky` client in `src/core/api.ts`).
* `src/features/<domain>/hooks/` — TanStack Query hooks that wrap the `api/` functions.

Components consume data exclusively through the `hooks/` layer, keeping query
configuration separate from UI rendering. This is a deliberate divergence
from the single `services/<domain>Service.ts` file pattern used by the
`pantry` and `chores` frontends.

## i18n

The default locale is `de` (see `src/proxy.ts`). Supported locales are
`en`, `de`, `pl` (see `src/navigation.ts`).
