# App Stability Sweep: Orchestration State

> Working state for crash-safe resumption. This file lives only on
> `orchestrator/app-stability-sweep`. Before the final PR to `dev`, its durable
> content moves into `.ai/CONTEXT.md` and GitHub issues, and the file is removed.

## Decisions (confirmed by the user, 2026-10-07)

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Merge path | Each `feature/fix-<app>` branch opens a PR into `orchestrator/app-stability-sweep`; one final PR merges the orchestrator branch into `dev`. |
| 2 | Agent docs | Thin root `CLAUDE.md` that routes to `.ai/`. This `STATE.md` is committed here and removed before the final PR. |
| 3 | Changelog | Per-app entries under `[Unreleased]` in the root `CHANGELOG.md`, each with its test method. No per-app changelog files. |
| 5 | Caddy shopping route (2026-10-07) | APPROVED for Phase 3: fix `/api/v1/shopping*` so paths pass through unmangled. Until then sweeps keep using `/shopping/api/v1/...`. |
| 4 | Scope | Delta audit (i18n, icons, overflow, docs) on top of the 56 open `app-sprint` issues. Budget, chores and dashboard get a quick check only; they were swept in #577/#578, #580/#582 and #584. |

## Standing rules

- No AI attribution trailers in commits or PRs (`.ai/rules/core.md` §3).
- Docs and `.ai/` changes go in a separate commit after the code commit (`.ai/rules/core.md` §5).
- Hide only UI that has no backend behind it. Where the backend exists but the UI is missing, the issue stays open and nothing is built.
- No Caddy, Compose or network changes without orchestrator sign-off.
- Pushes that touch `.github/workflows/` go over SSH.

## Branches & worktrees

| Target | Worktree | Branch | Status |
| --- | --- | --- | --- |
| Orchestrator | (session worktree) | `orchestrator/app-stability-sweep` | created from `origin/dev` @ `9550532d` |
| Shared packages | `.worktrees/shared-packages` | `feature/fix-shared` | merged (#608, squash `7f3c3f5d`); worktree removed |
| Household | `.worktrees/app-household` | `feature/fix-household` | merged (#611, squash `4c53afb8`); worktree removed |
| Workout | `.worktrees/app-workout` | `feature/fix-workout` | merged (#616, squash `4440336e`); worktree removed |
| Library | `.worktrees/app-library` | `feature/fix-library` | merged (#619, squash `fa4dc888`); worktree removed |
| Maintenance | `.worktrees/app-maintenance` | `feature/fix-maintenance` | merged (#624, squash `3d1018be`); worktree removed |
| Pantry | `.worktrees/app-pantry` | `feature/fix-pantry` | merged (#625, squash `805c5636`); worktree removed |
| Shopping | `.worktrees/app-shopping` | `feature/fix-shopping` | merged (#631, squash `7d2a0a0e`); worktree removed |
| Chat | `.worktrees/app-chat` | `feature/fix-chat` | merged (#634, squash `73f12f66`); worktree removed |
| Docs & portal | `.worktrees/app-docs` | `feature/fix-docs` | merged (#635, squash `2aac19ca`); worktree removed |
| Shared follow-ups | `.worktrees/shared-followups` | `feature/fix-shared-followups` | merged (#638, squash `e4b8d8de`); worktree removed |
| Budget / chores / dashboard | `.worktrees/app-tier-checks` | `feature/fix-swept-apps-recheck` | in progress (Sonnet sub-agent, parallel with shared follow-ups) |

## Phase 1: Delta audit (2026-10-07)

### Open `app-sprint` issues (baseline backlog)

| App | p1 | p2 | p3 | Total |
| --- | --- | --- | --- | --- |
| shared | 1 | 0 | 0 | 1 |
| household | 0 | 3 | 1 | 4 |
| workout | 3 | 3 | 2 | 8 |
| library | 2 | 3 | 2 | 7 |
| maintenance | 2 | 3 | 3 | 8 |
| pantry | 1 | 6 | 2 | 9 |
| shopping | 1 | 4 | 5 | 10 |
| chat | 0 | 3 | 2 | 5 |
| budget | 0 | 1 | 0 | 1 |
| chores | 0 | 0 | 2 | 2 |
| dashboard | 0 | 0 | 1 | 1 |
| **Total** | **10** | **26** | **20** | **56** |

### Static scan

The counts below come from a heuristic grep: JSX text nodes, literal
`placeholder`/`aria-label`/`title`/`alt` attributes, and inline `<svg>` in `.tsx`
outside `assets/` and tests. They include false positives (brand names, symbols), so
each sweep must check every hit by hand.

| Frontend | Hardcoded JSX text | Literal attrs | Inline `<svg>` files |
| --- | --- | --- | --- |
| packages/shared | 7 | 7 | 5 |
| core/household | 14 | 0 | 1 |
| core/dashboard | 17 | 0 | 0 |
| budget | 40 | 9 | 0 |
| chat | 4 | 2 | 0 |
| chores | 0 | 0 | 1 |
| library | 6 | 2 | 0 |
| maintenance | 0 | 0 | 0 |
| pantry | 3 | 1 | 0 |
| shopping | 1 | 0 | 1 |
| workout | 2 | 0 | 0 |

- **Docs:** `scripts/check-markdown-links.py` reports all relative links resolve (132
  files). Portal build, sidebar and rendering are checked in the docs sweep.
- **Locale parity:** `en`, `de` and `pl` each have 11 namespace files. Key-level parity
  is checked per app in its sweep.
- **Stale directory:** `websites/docs/` contains only `node_modules` and is untracked.
- **Not yet checked:** text overflow and layout. These need a running stack and
  headless browser screenshots during each sweep.

## Execution order

1. `shared` first: #579 (p1, `t()` with unprefixed keys masked by a test mock) affects
   every app, and the shared inline SVGs feed every frontend.
2. `household` next: Tier-1, every app depends on it.
3. Tier-2 apps ordered by p1 count: workout, library, maintenance, pantry, shopping, chat.
4. `docs` (docs + portal).
5. Quick check of budget, chores and dashboard.

All sweeps run one after another. Locale files are split by app namespace, so app
sweeps only touch their own `<app>.json`.

## Model assignment

| Task | Model | Reason |
| --- | --- | --- |
| shared, household | Opus | Cross-cutting; a regression breaks every app |
| Tier-2 app sweeps | Sonnet | Bounded to one app; FDD structure is consistent |
| Mechanical i18n extraction inside a sweep, recheck sweep | Haiku | Repetitive, low risk |
| Docs and portal | Sonnet | Rendering and link fixes |

## Testing coverage log

| Target | Method | Result |
| --- | --- | --- |
| shared (#608) | `tsc --noEmit`; Vitest + v8 coverage (296 tests); new static key-resolution, locale-parity and German-rendering tests; `verify.sh --frontend` | Pass. Coverage stmts 87.12→90.19, branches 75.54→81.49 (below the 90% threshold that was already missed before; see #609), funcs 89.24→92.24, lines 88.79→91.97 |
| household (#611) | Go `build`/`vet`/`test -race -cover`; PostgreSQL integration tests against a throwaway `postgres:16-alpine`; frontend `tsc`, Vitest (38→73 tests) incl. en/de/pl key-resolution + parity tests and a long-content layout test; `verify.sh --frontend --go` | Pass. Go coverage 81–100% per package (household 98.2, membership 96.8, httpjson 100). Frontend stmts 58.7 / branches 55.9 / funcs 44.1 / lines 60.2 (`src/app/**` excluded) |
| shared follow-ups (#638) | shared `tsc`, Vitest + v8 coverage (312→353 tests; XSS payload via real marker click, `$&`/`$1`/`$$` interpolation, OIDC/theme branches); backend-shared pytest (69, incl. two callers on one session id against a real FastMCP app); `pnpm audit` (no brace-expansion advisory); `pnpm exec eslint src` runs in every frontend again; `verify.sh --frontend --python` | Pass. Shared stmts 95.54 / branches 86.83 / funcs 95.75 / lines 97.17 (base 90.20 / 81.66 / 92.30 / 91.99). `verify.sh --frontend` 68–85 s with bounded parallelism (was 111 s unbounded) |
| docs (#635) | portal `check-types` (0 errors/warnings/hints), portal build (85 pages), landing build, new crawler `scripts/check-docs-site.py` over the merged Pages artifact (87 HTML pages), 375 px overflow spot-check, `check-markdown-links.py` (134 files), `verify.sh --frontend` | Pass. Crawl before → after: broken internal links 201 → 0, broken assets 85 → 0, broken anchors 4 → 0, pages missing from sidebar 80 → 0 |
| chat (#634) | Go `build`/`vet`/`test -race -cover` incl. concurrent two-household/three-user pool test and stream-cancel handler test; frontend `tsc`, Vitest + v8 coverage with real dictionaries (26→56 tests, long content); `verify.sh --frontend --go` | Pass. Go 94.7–100% per package (conversations 95.7, mcp 97.2, mcpservers 98.8). Frontend stmts 81.1 / branches 74.0 / funcs 76.3 / lines 82.8 (base 73.2 / 61.5 / 67.3 / 75.1) |
| shopping (#631) | ruff, `ty`, pytest + cov; frontend `tsc`, Vitest + v8 coverage with real dictionaries via the `next-intl` mock (long content, notifications, optimistic items, Einlagern flow); `verify.sh --frontend --python` | Pass. Backend 65 tests, 95.95% (base 51, 95.72%). Frontend 112 tests, stmts 80.60 / branches 68.88 / funcs 76.02 / lines 82.51 (base 20 tests, 55.58 / 46.32 / 45.57 / 56.25) |
| pantry (#625) | ruff, `ty`, pytest + cov; frontend `tsc`, Vitest + v8 coverage with real dictionaries (long content, de/pl error states, nested-form fix, export outcomes, ledger paging); `verify.sh --frontend --python` | Pass. Backend 135 tests, 96.17%. Frontend 134 tests, stmts 88.0 / lines 91.4 |
| maintenance (#624) | frontend `tsc`, Vitest + v8 coverage with real en/de/pl dictionaries (18→164 tests; TZ tests under LA, São Paulo, UTC, Auckland + DST; MSW for the shopping cart; i18n guard test); backend ruff/`ty`/pytest unchanged code; `verify.sh --frontend --python` | Pass. Frontend stmts 95.18 / branches 84.86 / funcs 93.81 / lines 95.94 (base 68.00 / 47.14 / 64.35 / 70.49). Backend 58 tests, 98.59% |
| library (#619) | ruff, `ty`, pytest + cov; frontend `tsc`, Vitest + v8 coverage with real-dictionary mock (12→125 tests, long-content renders); `verify.sh --frontend --python` | Pass. Backend 77 tests, 96.2%. Frontend stmts 89.9 / branches 82.6 / lines 91.0 (new `coverage.include`; base 64% on imported files only) |
| workout (#616) | ruff, `ty`, pytest + cov; frontend `tsc`, Vitest + v8 coverage (56→218 tests: HUD, offline queue with fake-indexeddb + MSW, sync badge, long-content renders); `next build`; `verify.sh --frontend --python` | Pass. Backend 149 tests, 95.66% (base 95.56%). Frontend stmts 87.5 / branches 80.8 / funcs 82.1 / lines 88.8 (base 58.0 / 49.7 / 46.0 / 59.1) |

## Backlog added during this sweep

| Issue | App | Summary |
| --- | --- | --- |
| #609 | shared | Branch coverage below 90% in OIDC flow and theme context |
| #610 | shared | Map marker popups render raw HTML (stored XSS within a household); household side escapes now |
| #612 | workout | Leaderboard shows truncated user ids; backend returns no display names |
| #613 | workout | Exercises/equipment cannot be edited in the UI although `PATCH` exists |
| #614 | shared | Shared `Button` has no default `type`; buttons inside forms submit them |
| #615 | shared | Shared `t()` interpolation garbles values containing `$&` / `$1` |
| #617 | shared/tooling | ESLint crashes on config load in every frontend (minimatch "expand is not a function") |
| #568 (kept open) | workout | `preferred_unit` kg/lb wiring is a feature of its own |
| #618 | library | Provider subscriptions have no notes field in the backend |
| #551, #567 (kept open) | library | Lending UI not built (agreed); search facets not exposed |
| #620 | maintenance | Saving a step comment overwrites the procedure description |
| #621 | maintenance | Steps created with a device never get a first due date |
| #622 | pantry | Low-stock push posts to a path the shopping backend does not serve |
| #623 | chores | `useShoppingIntegration` calls `/api/v1/shopping-lists`, rewritten by Caddy to `/api/v1-lists` |
| #503, #505, #509, #519, #523 (kept open) | maintenance | Photo picker and Manuals hidden (no backend); device/step edit has no endpoints; unused backend paths |
| #626 | pantry | Locations with any ledger history can never be deleted (needs archive/soft delete) |
| #540 (kept open) | pantry | Nutrition UI is feature-sized |
| #627 | shopping | Target-household picker in the Einlagern dialog cannot work for another household's list |
| #628 | shopping | Full sync re-counts skipped items in purchase history |
| #629 | shopping | Pantry failures answered with 400 instead of a gateway status |
| #630 | pantry | `bulk_add_items` turns any barcode lookup exception into `product_not_found` |
| #511, #530, #535 (kept open) | shopping | Icon picker hidden (no column); dead OpenFoodFacts client; N+1 on list read |
| #632 | chat | Backend accepts OpenRouter/Anthropic/Gemini model blocks it cannot run (hidden in UI) |
| #633 | shared/security | Python MCP servers don't bind session ids to the caller; idle chat sessions are not terminated server-side |
| #636 | shared/testing | Vitest suites time out intermittently under parallel `verify.sh --frontend` |
| #637 | shared/tooling | Fix ESLint errors (dashboard 11, household 0, budget 8, chat 1, chores 1, library 1, maintenance 5, pantry 30, shopping 8, workout 19), add a config to `packages/shared`, then gate lint in `verify.sh` |
| #609, #636 (kept open, partly fixed) | shared | Branch coverage 86.83% (<90%); flaky-test timeouts mitigated by bounded parallelism |
| #583 (kept open) | household | Internal `GET /internal/v1/households/{id}/members` added; `backend_shared` helper + chores consumer still missing |

### Carry-over for later sweeps (from #608)

- budget: 40 keys missing in `pl/budget.json` (allow-listed in `localeParity.test.ts`; remove entries as they are translated). `QuickAddModal.tsx` is 247 lines.
- maintenance: `Header.tsx` uses next-intl keys `header.notifications`, `header.allCaughtUp`, `header.noNotifications` that do not exist.
- chores, chat, pantry, maintenance, shopping: test mocks return key fragments instead of the real dictionary.
- household (#611): `GET /api/v1/households/me` no longer returns `members` (approved; no consumer reads it). Material Symbols icons for contacts/categories are stored by name in the DB and need a mapping before moving to lucide. `layout.tsx` metadata is static English. `eslint` crashes on config load (`minimatch` "expand is not a function"); not part of `verify.sh`.
- workout (#616): `POST /sessions/{id}/sets/sync` now returns `409 session_not_active` for finalized sessions (approved, additive); MCP `log_completed_set` returns an `Error:` string for that case. Residual race: status is checked once per request; closing it needs a PostgreSQL row lock.
- library (#619): delete of an in-use location/provider now returns `409 location_in_use`/`provider_in_use` (was silent unlinking; #558's 500 did not reproduce); `LendingRecordResponse.item_title` added; TMDB lookup without key returns `502 lookup_not_configured`; global `IntegrityError` → `409 conflict`. Providers UI had never worked (wrong field names/enum); aligned with API. Lending history beyond 100 records shows a truncation notice.
- maintenance (#624): "Send to Shopping" posts each part to `POST /shopping/api/v1/shopping/items`. Notification bell now lists real overdue/due-soon steps. `testTimeout` raised to 30s under heavy machine load.
- pantry (#625): 409 `category_in_use`/`location_in_use`/`product_in_use` on deletes (additive; MCP tools catch the `ValueError` base); `GET /inventory/transactions` gained `date_from`, `date_to`, repeatable `transaction_type` and an id tie-break; low-stock export posts to `/shopping/api/v1/shopping/items` with per-item retry; dead server-side shopping push removed (#542). Product creation had dropped `minimum_stock`.
- shopping (#631): `POST /api/v1/shopping-lists/{id}/sync-to-pantry` takes an optional `{"item_ids": [...]}` body (additive). Unit codes Pantry rejected (`stk`, `fl.`, `pkg.`, `pkt.`, `bund`, `dose`) are mapped on sync. Shopping header now uses `Navigation.shoppingSubtitle` because pantry's `Navigation.subtitle` won in the merged dictionary. `verify.sh --security` fails at the pre-commit step because of #617, and its hooks edit unrelated files.
- chat (#634): MCP clients pooled per (endpoint, household, user), resolved per call, 15 min idle TTL. Registry role errors now use the household `{"detail":{...}}` shape (`household_role_forbidden`, `household_required`). Tool results persisted with `tool_call_id`/`tool_name`/`is_error`; history replay sends `tool_call_id`. SSE wire format unchanged.
- docs (#635): the portal sidebar was empty on every page and 201 relative links 404ed; fixed via a tracked symlink `websites/portal/src/content/docs → docs/` (accepted: the portal is only built in the Linux Pages workflow) and a base-aware link-rewrite plugin. Landing `t()` inline fallbacks removed. Benign `astro build` warning about `/404` route collision. Landing bundle is one 692 kB chunk (imports the whole `@alfheim/shared` index).
- Parallel sweeps 10 and 11 both add CHANGELOG entries: expect a CHANGELOG conflict on the second merge; rebase and resolve by keeping both entries.
- `Closes #n` in PRs into the orchestrator branch does not auto-close issues (not the default branch). Issues close when the work reaches `main`; the final PR body must list them.
- shared follow-ups (#638): `MapMarker.popupContent` is plain text (+ `popupTitle`); household `escapeHtml` removed. `Button` defaults to `type="button"`. New `interpolate()` export. brace-expansion override split per major. `MCPAuthenticationMiddleware` binds `Mcp-Session-Id` to (subject, household), 403 on mismatch, 404 on unknown id, max 10,000 bindings.
- **Phase 3 TODO (found reviewing #638):** chat's Go MCP client keeps a stale session after a 404 (`ErrEndpointNotFound`, `initialized` stays true) until the 15 min idle TTL. Per the MCP spec, clear the session and re-initialize once on 404. Pre-existing with FastMCP restarts, but more reachable now.
- **Caddy finding (needs user decision, not changed):** `handle_path /api/v1/shopping*` and `/shopping/api/v1*` both rewrite to `/api/v1{rest}`, while the shopping backend serves `/api/v1/shopping/items` and `/api/v1/shopping-lists`. So `/api/v1/shopping/items` → `/api/v1/items` (404) and `/api/v1/shopping-lists` → `/api/v1-lists` (404); only `/shopping/api/v1/shopping/...` and `/shopping/api/v1/shopping-lists` work. Verified by reading the Caddyfile and routers. Decision: user approved fixing the Caddy rule in Phase 3 (switch the shopping block to pass-through like chores/chat/library, then verify `/shopping/api/v1/...` callers still work).
- shared follow-up candidates for the final re-check sweep: #610, #614, #615 (small, low-risk).
- Fresh worktrees need `pnpm --filter @alfheim/docs-portal exec astro sync` before `verify.sh --frontend`.
- PRs into the orchestrator branch only trigger the docs workflow; frontend/Go/Python CI runs on the final PR to `dev`, so local `verify.sh` is the gate per sweep.

## Stall / recovery log

| Time | Agent | Event | Action |
| --- | --- | --- | --- |
| 2026-10-07 | orchestrator | SSH to github.com:22 times out | All pushes/deletes go over HTTPS; briefs updated |
| 2026-10-08 | pantry sub-agent | Stopped by the account session limit (HTTP 429) mid-sweep; 1 commit + uncommitted frontend work left in `.worktrees/app-pantry` | Resumed the same agent with its context after the limit reset; told it to commit incrementally |
| 2026-10-08 | re-check + shared follow-up sub-agents | Both stopped by the account session limit (HTTP 429). Re-check: 2 budget commits + 9 uncommitted files. Shared: 7 commits (#610, #614, #615, overrides, verify.sh parallelism, #633, format) + 3 uncommitted (#609 tests) | Both resumed with their context after the reset |
