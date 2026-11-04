# AGENTS.md

Binding instructions for every AI coding agent in the Alfheim monorepo (Claude Code, Codex,
Cursor, Copilot, Gemini and others). Directories may add a nested `AGENTS.md`; the closest one
adds to these rules and never relaxes them. Explanations for humans live in [`docs/en`](docs/en);
this file holds rules only.

## Project

Alfheim is a self-hosted, multi-tenant household platform: Go and FastAPI backends, Next.js
frontends, Zitadel for authentication, one Postgres (`postgres-core`), RustFS (S3) for files,
Caddy as the only ingress. Every request belongs to a household that the `core/household`
membership API confirms.

## Layout

| Path | Contents |
| --- | --- |
| `core/dashboard`, `core/household` | Tier-1 apps (Go backends, Next.js frontends) |
| `apps/<name>` | Tier-2 apps: `backend/` (FastAPI or Go), `frontend/` (Next.js), `compose.yml` |
| `packages/shared` | `@alfheim/shared`: UI primitives, i18n, auth, household context, assets |
| `packages/backend-shared` | `backend_shared` Python package: auth, household checks, storage |
| `tools/installer` | `alfheim-setup` (Go): install, update, backup, restore |
| `infrastructure/` | Caddy, Postgres init, telemetry, dev compose files |
| `docs/` | Diátaxis docs; `en/` is the source of truth, `de/` is translated |
| `websites/portal` | Astro Starlight renderer for `docs/` |
| `deploy/stack-apps.yaml` | External integrations shown on the dashboard |

## Commands

```bash
pnpm install                        # JS workspace (pnpm 11)
uv sync --all-packages --all-groups # Python workspace
./scripts/up.sh                     # staged local stack boot (-b rebuilds images)
./scripts/verify.sh --frontend      # tsc --noEmit + Vitest for every frontend
./scripts/verify.sh --python        # ruff, ruff format, ty, pytest (95 % per app backend)
./scripts/verify.sh --go            # gofmt, go vet, go test -race
./scripts/verify.sh --security      # secret scans and non-mutating pre-commit checks
./scripts/verify-stack.sh           # health and routing checks against a running stack
python3 scripts/check-markdown-links.py
```

## Rules

### Code and language

- Write all code, comments, docstrings, identifiers, log and error messages and commit messages
  in English.
- Comment why, not what. Public functions, types and API endpoints get a doc comment.
- No stubs: no empty functions or files, no `pass` placeholders, no hardcoded mock returns.
- Never mask errors: no empty `except`/`catch`, no `// @ts-ignore`, no silently swallowed errors.
- Organise code by feature (FDD): `features/<domain>/` owns its models, schemas, logic, data
  access and handlers. `shared/` or `core/` holds only domain-agnostic code.

### Frontend

- Feature code lives in `src/features/<domain>/{api,hooks,components}`. Pages do not call
  `fetch` or query hooks directly.
- A component or view file stays under 200 lines; split it before it gets there.
- No hardcoded user-facing strings. Tier-2 apps use `useTranslation` from `@alfheim/shared` with
  `packages/shared/src/features/i18n/locales/{en,de,pl}/<app>.json`; the household app keeps
  `src/i18n`. Every new key goes into all three locales.
- Icons come from `lucide-react` or `packages/shared/src/assets`. No inline `<svg>` in feature
  components.
- Coalesce array data before use: `const items = data ?? [];`. A truthiness check is not enough.
- Route `params` and `searchParams` are Promises (Next.js 15+): `const { id } = await params;`.
- Wrap every Leaflet map (`OSMMapViewer`) in `relative z-0 isolate overflow-hidden`; modals and
  overlays use `fixed inset-0 z-[9999]`.
- Hide UI whose backend does not exist yet, and file an issue for it (labels `app:<name>`,
  `severity:p<n>`, `type:*`, `app-sprint`).

### Backend and security

- Filter every query by the household that `require_household` (Python) or `RequireHousehold`
  (Go) returned. Never trust household or role claims from the JWT.
- MCP tools never take `household_id` or `user_id` arguments; they read the request context.
  They have docstrings and type annotations and return structured errors, not tracebacks.
- Validate tokens against the JWKS from the issuer's discovery document. Do not tie signature
  checks to the host string the token was issued on (browser and containers use different hosts).
- Python models: wrap columns in `sqlmodel.col()` for `.asc()`, `.desc()`, `.in_()`, `.is_()`;
  index definitions use string column names.
- Schema changes go through Alembic migrations (Python) or the module's migration files (Go).
- Never commit secrets. Only `.env.example` with placeholder values is tracked.

### Routing and networks

- Caddy (`infrastructure/caddy/Caddyfile`) only maps hosts and path prefixes to containers:
  frontends by path, APIs under `/api/v1/<app>`. Page routing belongs to the Next.js App Router;
  no gateway rewrites for app paths.
- `gateway-net` carries ingress traffic only. A backend joins its own `app-<name>-net` (where it
  reaches `postgres-core`) and never another app's network. Cross-app calls go through the public
  API routes.

### Files and storage

- Binary files (photos, PDFs, receipts, manuals) go to RustFS, never to a container filesystem or
  a Postgres column.
- Object keys: `households/{household_id}/{app}/...` or `users/{user_id}/{app}/...`, built with
  `backend_shared.storage` helpers. The backend generates the final key; never use a client
  filename as a path.
- New uploads go through the backend (multipart, size limit, content-type check by magic bytes).
  Downloads may use short-lived presigned GET URLs. The budget presigned PUT upload is legacy
  (#802); do not copy it.

## Git

- Branches in English kebab-case (`feature/<name>`, `fix/<name>`). Pull requests target `dev`;
  `main` is the protected release branch and only receives release merges.
- Conventional Commits in English: `<type>(<scope>): <imperative summary>` with `feat`, `fix`,
  `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- No AI attribution in commits or pull requests: no `Co-authored-by` for tools, no
  `Generated-by`, no bot emojis or signatures.
- Documentation changes go in a separate `docs(...)` commit after the code commit.
- Record user-visible changes in the root [`CHANGELOG.md`](CHANGELOG.md) under `[Unreleased]`.
- Pushes that touch `.github/workflows/` must go over SSH
  (`git@github.com:KroegerLeif/Alfheim.git`); the `gh` token lacks the `workflow` scope.

## Quality gates

- Run the `verify.sh` gate for every stack you touched and confirm it exits 0 before committing.
  Do not commit speculative fixes you have not verified.
- Python app backends keep at least 95 % line coverage; `tools/installer` at least 80 %.
- Go tests must pass with `-race`; `gofmt -l .` must print nothing.
- CI mirrors these gates; `ci-required` is the single required check.

## Documentation

- Update the affected page in `docs/en` (and `docs/de`, or leave the English fallback) when
  behaviour, configuration, endpoints or data invariants change.
- Pick the Diátaxis quadrant by reader intent: tutorial (learn), how-to (do), reference (look
  up), explanation (understand). ADRs go to `docs/en/explanation/decisions/`.
- Never put machine-specific absolute paths in shared docs.

## Where to read more

- [Architecture overview](docs/en/explanation/architecture-overview.md),
  [authentication](docs/en/explanation/authentication-security.md),
  [feature-driven design](docs/en/explanation/feature-driven-design.md)
- [Ingress matrix](docs/en/reference/ingress-matrix.md),
  [environment variables](docs/en/reference/environment-variables.md),
  [app references](docs/en/reference/apps/)
- [Create a new FDD service](docs/en/tutorials/create-new-fdd-service.md)
- Stack conventions, one canonical page each: [Python and FastAPI](docs/en/reference/conventions/python-fastapi.md),
  [Go](docs/en/reference/conventions/go.md), [Next.js and Tailwind](docs/en/reference/conventions/nextjs-tailwind.md).
  Each backend, frontend, shared package and the installer has a nested `AGENTS.md` with its own commands and invariants.
- The detailed quality-gate reference still lives in [`.ai/`](.ai/INDEX.md) until it moves into
  `docs/` (#799).
