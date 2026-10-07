# CLAUDE.md

Entry point for Claude Code in the Alfheim monorepo. This file only routes and lists
commands. The binding rules live in [`.ai/`](.ai/INDEX.md) and are not repeated here.

## Read first

1. [`.ai/INDEX.md`](.ai/INDEX.md): which guideline to read for which task.
2. [`.ai/rules/core.md`](.ai/rules/core.md): English-only code and comments, Conventional
   Commits, no AI attribution trailers, no-stub policy, separate docs commits.
3. [`.ai/CONTEXT.md`](.ai/CONTEXT.md): active sprint state and app index.
4. [`.ai/rules/architecture.md`](.ai/rules/architecture.md): Caddy vs. app routing, FDD
   folders, the 200-line component limit, network segmentation.

## Layout

| Path | Contents |
| --- | --- |
| `core/dashboard`, `core/household` | Tier-1 apps (Go backends, Next.js frontends) |
| `apps/<name>` | Tier-2 apps: `backend/` (FastAPI or Go), `frontend/` (Next.js), `compose.yml` |
| `packages/shared` | `@alfheim/shared`: UI primitives, i18n, auth, household context, assets |
| `packages/backend-shared` | `backend_shared` Python package: auth, household membership checks |
| `docs/` | Diátaxis docs (`en/` is the source of truth, `de/` is translated) |
| `websites/portal` | Astro Starlight renderer for `docs/` |
| `infrastructure/caddy` | Ingress gateway; frontends by path, APIs under `/api/v1/<app>` |
| `deploy/stack-apps.yaml` | Tier-2 app manifest; `status: active \| in_progress \| maintenance` |

## Commands

```bash
pnpm install                        # JS workspace (pnpm 9)
uv sync --all-packages --all-groups # Python workspace
./scripts/up.sh                     # staged local stack boot (add -b to rebuild images)
./scripts/verify.sh --frontend      # tsc --noEmit + Vitest for every frontend
./scripts/verify.sh --python        # ruff, ty, pytest
./scripts/verify.sh --go            # go test -race
./scripts/verify.sh --security      # secret and hardcoding scans
./scripts/verify-stack.sh           # health/routing checks against a running stack
python3 scripts/check-markdown-links.py
```

Run the matching `verify.sh` gate and confirm it exits 0 before committing
(see [`.ai/guidelines/quality-gates.md`](.ai/guidelines/quality-gates.md)).

## UI rules

- **i18n:** no hardcoded user-facing strings. Tier-2 apps use `useTranslation` from
  `@alfheim/shared` with locale files in `packages/shared/src/features/i18n/locales/{en,de,pl}/<app>.json`.
  The household app keeps its own `src/i18n`. Every new key goes into all three locales.
- **Icons:** use `lucide-react` or the exports in `packages/shared/src/assets`. Do not add
  inline `<svg>` blobs to feature components.
- **Incomplete features:** if UI depends on a backend feature that does not exist, hide it
  and file a GitHub issue (labels `app:<name>`, `severity:p<n>`, `type:*`, `app-sprint`).

## Git

- Branches: English kebab-case (`feature/<name>`, `fix/<name>`). PRs target `dev`; `main`
  is the protected release branch.
- Changes go into the root [`CHANGELOG.md`](CHANGELOG.md) under `[Unreleased]`.
- Pushes that touch `.github/workflows/` must go over SSH (`git@github.com:KroegerLeif/Alfheim.git`),
  because the `gh` token lacks the `workflow` scope.
