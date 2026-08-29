# Alfheim — Living Tech-Debt Backlog

**Status:** open / rolling
**Convention:** `TD-<AREA>-<NN>`

This is the **living** backlog for open technical debt. It is deliberately separate from
[`AUDIT_MASTER_BACKLOG.md`](AUDIT_MASTER_BACKLOG.md), which is a frozen `v1.0.0` audit snapshot
(ID scheme `AUDIT-<AREA>-<NN>`, all phases marked COMPLETED) and should be treated as a historical
record rather than appended to.

Items are logged as they are discovered during feature work. Each entry names how it was found so
it can be re-verified independently.

---

## Legend

| Severity | Meaning |
| :--- | :--- |
| 🔴 **High** | Broken in production paths, or a security/tenancy gap |
| 🟠 **Medium** | Violates a documented invariant; no user-visible breakage yet |
| 🟡 **Low** | Inconsistency, dead code, or ergonomics |

---

## Open Items

### 🔴 `TD-DOCKER-01` — Backend Dockerfiles do not build (pantry, chores, shopping, maintenance)

**Discovered:** Phase 0 of the `apps/workout` backend build, by running `docker compose build pantry-backend`.

Every existing app's backend declares `build.context: ./backend` in `apps/<app>/compose.yml`, but its
`pyproject.toml` declares `backend-shared = { workspace = true }` — a uv workspace path dependency
living at `packages/backend-shared`, outside that build context. The build fails at the first
`uv sync`:

```
Failed to build `pantry-backend @ file:///app`
├─▶ Failed to parse entry: `backend-shared`
╰─▶ `backend-shared` references a workspace in `tool.uv.sources`, but is not a workspace member
```

None of the four backend images can currently be built via `docker compose build`.

**Fix:** switch to a repo-root build context with an explicit dockerfile path. `apps/workout/backend/Dockerfile`
plus `apps/workout/compose.yml` are a working reference (COPY root `pyproject.toml` +
`packages/backend-shared` + the app manifest for layer caching, then `WORKDIR` into the app).

**Affects:** `apps/{pantry,chores,shopping,maintenance}/backend/Dockerfile` and their `compose.yml`.

---

### 🔴 `TD-MCP-01` — MCP tools bypass household isolation

**Discovered:** while designing `apps/workout`'s MCP surface.

`apps/pantry` and `apps/chores` MCP tools hardcode `MOCK_HOME_ID` / `MOCK_USER_ID` from
`src/core/dependencies` instead of deriving tenant context from the caller. An agent invoking these
tools operates against a fixed mock household regardless of who it is acting for — the REST routes
enforce isolation, the MCP path does not.

**Fix:** give every tool explicit `household_id` / `user_id` parameters passed straight into the same
service-layer functions the routers use. `apps/workout/backend/src/features/*/mcp_tools.py` is the
reference implementation.

**Affects:** `apps/pantry/backend/src/features/*/mcp_tools.py`, `apps/chores/backend/src/features/*/mcp_tools.py`,
and `apps/maintenance/backend/app/features/*/mcp_tools.py` (same pattern, unverified).

---

### 🔴 `TD-SHARED-02` — `HouseholdSwitcher` token chain is a hardcoded four-app list

**Discovered:** during the `apps/workout/frontend` reuse audit.

`packages/shared/src/features/ui/components/HouseholdSwitcher.tsx:44-47` resolves the access token
by trying exactly four session-storage keys (`token_chores-frontend`, `token_maintenance-frontend`,
`token_pantry-frontend`, `token_shopping-frontend`). Any new app is invisible to it: the fetch is
skipped, the component returns `null`, `alfheim_active_household_id` is never written, and every
downstream API call ships without `X-Household-ID`.

**Fix (short term):** append the new app's key. **Fix (proper):** fall back to the shared
`alfheim_access_token` key that every app already writes, so the list stops needing maintenance.

---

### 🟠 `TD-CI-02` — No frontend CI exists

**Discovered:** while auditing `.github/workflows/` for the workout frontend.

Only `python-ci.yml` and `deploy-docs.yml` exist. No TypeScript, Vitest, or ESLint job runs on any
pull request — frontend regressions are caught only if a developer runs `./scripts/verify.sh --frontend`
locally.

**Fix:** add `frontend-ci.yml`. No per-app matrix is needed since both commands are already recursive
over the pnpm workspace:

```yaml
run: pnpm -r exec tsc --noEmit
run: pnpm -r test
```

Path filters: `apps/*/frontend/**`, `core/*/frontend/**`, `packages/shared/**`, `pnpm-lock.yaml`.

---

### 🟠 `TD-CI-01` — `apps/workout/backend` missing from the Python CI matrix

**Discovered:** while wiring the workout backend.

`.github/workflows/python-ci.yml`'s `test-matrix` job enumerates services in a hardcoded list
(`apps/{pantry,shopping,maintenance,chores}/backend`). `apps/workout/backend` is absent, so its 116
tests never run in CI.

**Fix:** add the entry. Consider globbing instead, so the list stops drifting from reality.

---

### 🟠 `TD-NEXT-01` — Two frontends still use the deprecated `middleware.ts`

**Discovered:** repo-wide scan for `proxy.ts` vs `middleware.ts`.

`.ai/blueprints/new_app.md` states the Next.js 16 convention is `src/proxy.ts` and that
`src/middleware.ts` "must **NOT** be used". `apps/chores`, `apps/pantry` and `apps/maintenance` comply;
`apps/shopping/frontend/src/middleware.ts` and `core/dashboard/frontend/src/middleware.ts` do not,
despite both running Next 16.2.11.

**Fix:** rename to `src/proxy.ts` (contents are otherwise identical to the compliant apps).

---

### 🟡 `TD-FE-01` — `apps/chores/frontend` has a lint script but no ESLint config

`package.json` ships `"lint": "eslint"` while the app has no `eslint.config.mjs`, so the script cannot
succeed. `apps/pantry/frontend/eslint.config.mjs` is the working reference.

---

### 🟡 `TD-FE-02` — `apps/pantry/frontend` emits a duplicate `<html>` element

`src/app/layout.tsx` returns `<html><body>{children}</body></html>` and `src/app/[locale]/layout.tsx`
emits `<html>`/`<body>` again. `apps/chores/frontend/src/app/layout.tsx` (`return children`) is correct.

---

### 🟡 `TD-FE-03` — Per-app `src/styles/theme.css` is dead code

Both `apps/chores/frontend` and `apps/pantry/frontend` contain `src/styles/theme.css`, but neither
`globals.css` imports it — while both reference `--font-heading` / `--font-body` / `--font-mono`,
which are defined **only** in that unimported file. Those variables therefore resolve to nothing.

**Fix:** either import the file or inline its `@theme` block into `globals.css`.

---

### 🟡 `TD-SHARED-01` — Inconsistent theme-toggle semantics

`packages/shared`: `ThemeToggle` accepts a `showVariantToggle` prop that its body never reads, and
`useTheme().toggleTheme()` flips the theme **variant** (nordic ↔ obsidian) while `ThemeToggle` flips the
**mode** (dark ↔ light). Two different behaviors behind similar names.

---

## Resolved

_None yet — items move here with the commit that closed them._
