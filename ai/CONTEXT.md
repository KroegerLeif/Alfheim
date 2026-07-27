# Loeger-OS — Sprint Context (`ai/CONTEXT.md`)

> **READ THIS FIRST.** Future AI agents must read this document before performing any file audit.
> It captures the current sprint state, completed work, DB schema invariants, and active feature flags
> so agents can resume work immediately without expensive repo-wide exploration.

---

## Quick-Resume Checklist for AI Agents

1. Read [`ai/CORE.md`](./CORE.md) — universal coding standards (English comments, FDD, Conventional Commits).
2. Read this file (`ai/CONTEXT.md`) — current sprint state and DB invariants.
3. Read [`ai/ARCHITECTURE.md`](./ARCHITECTURE.md) — full service map, Traefik routing, JWT claims.
4. Read the relevant stack guide in [`ai/stacks/`](./stacks/) for the service you are modifying.
5. **Do NOT re-audit the entire monorepo.** Use the architecture doc as your map.

---

## Current Sprint — Completed Commits

### `feat(infra): add scripts/up.sh for staged stack boot and ensure auto-provisioned household shopping list`

**Date**: 2026-07-27

#### What was delivered

| Area | Change |
|---|---|
| `scripts/up.sh` | New sequential boot orchestrator (5-stage pipeline, animated spinner, health polling, URL summary). Supports `--no-build` and `--skip-logging` flags. |
| Shopping backend — `models.py` | Added `is_default: bool` and `is_personal: bool` columns to `ShoppingList`. Both default to `false` with `server_default="false"`. |
| Shopping backend — `schemas.py` | Added `is_default: bool` and `is_personal: bool` to `ShoppingListRead` response schema. |
| Shopping backend — `service.py` | Full rewrite: `get_lists()` now auto-provisions both a **Personal List** (per `owner_id`, `is_personal=True`) and a **Household List** (per `home_id`, `is_default=True`). `delete_list()` raises `ShoppingListProtectedError` for both protected types. |
| Shopping backend — `exceptions.py` | Added `ShoppingListProtectedError` with i18n key `shopping.error.list_protected`. |
| Shopping backend — `router.py` | `get_lists()` route now passes `username=context.username` to the service for Personal List naming. |
| Shopping frontend — `schemas.ts` | Added `is_default` and `is_personal` to `ShoppingListSchema` (Zod). |
| Shopping frontend — `ListSelector.tsx` | Delete button suppressed for `is_default` and `is_personal` lists. Personal lists display `<User />` icon (blue), Household lists display `<Home />` icon (emerald). |
| Shopping frontend — `page.tsx` | Replaced async `useEffect` default-list selection with synchronous `useMemo`. Introduced `resolvedListId = activeListId ?? defaultListId` pattern to eliminate blank-screen flicker. |
| `ai/ARCHITECTURE.md` | New — comprehensive architecture reference. |
| `ai/CONTEXT.md` | New — this file. |

---

## DB Schema Invariants (Shopping Service)

> These invariants MUST be preserved across all future migrations and feature additions.

### Table: `shopping_lists`

| Column | Type | Default | Constraint | Notes |
|---|---|---|---|---|
| `id` | UUID | `uuid4()` | PK | — |
| `name` | VARCHAR(255) | — | NOT NULL, min 1 | Display name |
| `home_id` | UUID | — | NOT NULL, INDEX | Active household |
| `owner_id` | UUID | — | NOT NULL, INDEX | Creator / owner |
| `is_default` | BOOLEAN | `false` | NOT NULL | **Protected** — Household List (1 per `home_id`) |
| `is_personal` | BOOLEAN | `false` | NOT NULL | **Protected** — Personal List (1 per `owner_id`, cross-household) |
| `created_at` | TIMESTAMPTZ | `now()` | NOT NULL | — |
| `updated_at` | TIMESTAMPTZ | `now()` | NOT NULL | Updated on write |

**Invariant rules:**
- At most **one** `is_default=true` row per `home_id`. Enforced in service layer, not DB constraint.
- At most **one** `is_personal=true` row per `owner_id`. Enforced in service layer, not DB constraint.
- **Never** delete or mutate `is_default` or `is_personal` rows via the REST API. Use direct SQL for maintenance only.

### ⚠️ Migration Note (Existing Databases)

Because this project uses `SQLModel.metadata.create_all` (no Alembic), the new `is_default` and `is_personal` columns **will not be automatically added to existing databases**. Run the following DDL against any existing `shopping` Postgres instance:

```sql
ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;
```

Fresh deployments (empty volume) will have the columns created automatically at startup.

---

## Active Feature Flags

| Flag | Scope | State | Notes |
|---|---|---|---|
| `OTEL_ENABLED` | All Python backends | `true` in Docker Compose | Disable in dev by setting `OTEL_ENABLED=false` |
| `TESTING` env var | Shopping backend | `false` (production) | Set to `"true"` to bypass JWT validation in tests |
| `--no-build` flag | `scripts/up.sh` | Optional | Skip Docker image rebuilds on restart |
| `--skip-logging` flag | `scripts/up.sh` | Optional | Skip the SigNoz observability stack |

---

## Known Constraints & Tech Debt

| Item | Severity | Description |
|---|---|---|
| No Alembic | Medium | Schema migrations require manual DDL for existing DBs. Recommend adding Alembic in a future sprint. |
| `MOCK_HOME_ID` fallback | Low | If `household_id` is absent from the JWT, `home_id` falls back to `00000000-0000-0000-0000-000000000002`. This is intentional for dev mode but must never occur in production. |
| Single Personal List uniqueness | Low | The uniqueness constraint (`is_personal=true` per `owner_id`) is enforced in the service layer only — a concurrent race on first login could theoretically create two. A future DB-level unique partial index would harden this. |
| SigNoz schema migrator wait | Low | `scripts/up.sh` polls for container exit rather than using `condition: service_completed_successfully` — this is intentional to decouple the script from compose dependency chains. |

---

## URLs (Local Development)

| App | URL |
|---|---|
| Dashboard | `http://loeger-os/` |
| Pantry | `http://loeger-os/pantry` |
| Shopping | `http://loeger-os/shopping` |
| Maintenance | `http://loeger-os/maintenance` |
| Keycloak Admin | `http://loeger-os/auth/admin` |
| Traefik Dashboard | `http://localhost:8080` |
| SigNoz | `http://loeger-os/signoz` |

> **Prerequisite**: `loeger-os` must resolve to `127.0.0.1` in `/etc/hosts`.
