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
| Workout | `.worktrees/app-workout` | `feature/fix-workout` | in progress (Sonnet sub-agent) |
| Library | `.worktrees/app-library` | `feature/fix-library` | pending |
| Maintenance | `.worktrees/app-maintenance` | `feature/fix-maintenance` | pending |
| Pantry | `.worktrees/app-pantry` | `feature/fix-pantry` | pending |
| Shopping | `.worktrees/app-shopping` | `feature/fix-shopping` | pending |
| Chat | `.worktrees/app-chat` | `feature/fix-chat` | pending |
| Docs & portal | `.worktrees/app-docs` | `feature/fix-docs` | pending |
| Budget / chores / dashboard | `.worktrees/app-tier-checks` | `feature/fix-swept-apps-recheck` | pending (quick check) |

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

## Backlog added during this sweep

| Issue | App | Summary |
| --- | --- | --- |
| #609 | shared | Branch coverage below 90% in OIDC flow and theme context |
| #610 | shared | Map marker popups render raw HTML (stored XSS within a household); household side escapes now |
| #583 (kept open) | household | Internal `GET /internal/v1/households/{id}/members` added; `backend_shared` helper + chores consumer still missing |

### Carry-over for later sweeps (from #608)

- budget: 40 keys missing in `pl/budget.json` (allow-listed in `localeParity.test.ts`; remove entries as they are translated). `QuickAddModal.tsx` is 247 lines.
- maintenance: `Header.tsx` uses next-intl keys `header.notifications`, `header.allCaughtUp`, `header.noNotifications` that do not exist.
- chores, chat, pantry, maintenance, shopping: test mocks return key fragments instead of the real dictionary.
- household (#611): `GET /api/v1/households/me` no longer returns `members` (approved; no consumer reads it). Material Symbols icons for contacts/categories are stored by name in the DB and need a mapping before moving to lucide. `layout.tsx` metadata is static English. `eslint` crashes on config load (`minimatch` "expand is not a function"); not part of `verify.sh`.
- Fresh worktrees need `pnpm --filter @alfheim/docs-portal exec astro sync` before `verify.sh --frontend`.
- PRs into the orchestrator branch only trigger the docs workflow; frontend/Go/Python CI runs on the final PR to `dev`, so local `verify.sh` is the gate per sweep.

## Stall / recovery log

| Time | Agent | Event | Action |
| --- | --- | --- | --- |
| 2026-10-07 | orchestrator | SSH to github.com:22 times out | All pushes/deletes go over HTTPS; briefs updated |
