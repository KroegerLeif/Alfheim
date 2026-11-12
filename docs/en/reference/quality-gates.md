---
title: "Quality Gates"
description: "Local and CI quality gates per stack: commands, thresholds, security checks and what each GitHub workflow does."
sidebar:
  label: "Quality Gates"
---

> **TL;DR:** `./scripts/verify.sh` runs the same checks as CI. Run the gate for every stack you touched and make sure it exits 0 before committing. The flags are listed in [CLI scripts](./cli-scripts.md).

---

## Local runner

```bash
./scripts/verify.sh --python     # ruff, ruff format, ty, pytest per backend, backend-shared
./scripts/verify.sh --go         # go test -race per module (incl. tools/installer), revive doc comments
./scripts/verify.sh --frontend   # tsc --noEmit, Vitest for every package
./scripts/verify.sh --security   # gitleaks, secret scans, TODO check, non-mutating pre-commit hooks
./scripts/verify.sh              # all of the above
```

## Python

All backends and `packages/backend-shared` form one `uv` workspace. `uv sync --all-packages --all-groups --locked` fails on a stale `uv.lock` instead of rewriting it.

| Check | Command | Threshold |
| --- | --- | --- |
| Lint | `uv run ruff check .` | 0 diagnostics (rules in `ruff.toml`, docstrings per [code comments](./conventions/code-comments.md)) |
| Format | `uv run ruff format --check .` | 0 files to reformat |
| Types | `uv run ty check` | exit 0 |
| Tests | `uv run pytest --cov --cov-fail-under=95` per app backend | at least 95 % line coverage |
| Shared library | `uv run pytest --cov` in `packages/backend-shared` | reported, no threshold yet |

`ty` needs `sqlmodel.col()` around columns used with `.asc()`, `.desc()`, `.in_()`, `.is_()` and string column names in `Index(...)`; assert `entity.id is not None` after a flush or refresh. Test conventions are in [Python and FastAPI](./conventions/python-fastapi.md).

## Go

Modules: `apps/chat/backend`, `core/dashboard/backend`, `core/household/backend`, `tools/installer`.

- `gofmt -l .` prints nothing, `go vet ./...` and `go test -race -cover ./...` pass.
- `golangci-lint run --enable-only revive` passes (doc comments on exported identifiers).
- `tools/installer` additionally keeps at least 80 % coverage (`-coverpkg=./internal/...`) and cross-compiles for linux/amd64 and linux/arm64 in CI.
- Tests mock external dependencies (OIDC JWKS, VictoriaLogs, VictoriaMetrics).

## Frontend

`pnpm -r exec tsc --noEmit` (the docs portal runs `astro check`) and `pnpm -r test`. `verify.sh` runs two packages at a time with half the CPU count in Vitest workers each, because unbounded parallelism made async tests time out under load. Override with `VERIFY_FRONTEND_CONCURRENCY` and `VITEST_MAX_WORKERS`. TypeScript is `strict`; avoid `any` outside safe cast boundaries.

## MCP tools

Every FastMCP tool has a docstring and type annotations, handles exceptions and returns structured errors instead of tracebacks, and takes no `household_id` or `user_id` argument.

## Security

- No live secrets: `.env` files are gitignored, only `.env.example` with placeholders is tracked.
- `verify.sh --security` scans for private keys and tracked `.env` files, fails on `TODO` / `FIXME` without an issue reference, runs the non-mutating pre-commit hooks (`check-yaml`, `check-json`, `check-added-large-files`, `check-merge-conflict`, `detect-private-key`) and `gitleaks detect` over the full history. Fixer hooks are not run because a verification must not rewrite files.
- `verify.sh --security` fails when gitleaks is not installed (`brew install gitleaks` or a [release binary](https://github.com/gitleaks/gitleaks#installing)). `--allow-missing-gitleaks` turns this into a warning for constrained environments; CI still runs gitleaks.
- The pre-commit hooks (`pre-commit install`) also run gitleaks on staged changes, and `gofmt -w` and `go vet` for every module listed in `go.work`. Dependabot does not track pre-commit `rev` pins; bump them by hand and keep the ruff `rev` equal to the ruff version in `uv.lock`.
- Every query filters by the household returned by `require_household` / `RequireHousehold`; see [Authentication and security](../explanation/authentication-security.md).

## Continuous integration

`ci-required.yml` detects changed paths and calls the reusable gates only for the stacks that changed. Its always-running job `ci-required` is the single status check to require in branch protection.

| Workflow | Purpose |
| --- | --- |
| `ci-required.yml` | Path filter, stack gates, aggregated `ci-required` check |
| `python-ci.yml` | Ruff, ty, per-app pytest with the 95 % gate, `packages/backend-shared` pytest |
| `go-ci.yml` | gofmt, `go vet`, revive, `go test -race` per module, installer coverage gate and cross-compile |
| `frontend-ci.yml` | `pnpm check-types`, `pnpm -r test`, `next build` for every frontend (matrix) |
| `security-scan.yml` | gitleaks on every push and pull request; pip-audit, govulncheck, pnpm audit and Trivy when dependencies change; all scans weekly |
| `smoke-test.yml` | Caddy gateway and production core stack startup |
| `deploy-docs.yml` | Markdown link check and docs build; deploys from `main` |
| `release.yml` | Tag-triggered release: ancestry check, quality gates, image build, Trivy gate, push, GitHub release |

Workflow rules: every action is pinned to a full commit SHA with a `# vX.Y.Z` comment (Dependabot updates them); workflows default to `permissions: contents: read` and jobs raise only the scope they need; release images are scanned with Trivy before they are pushed, and pre-release tags (`-rc`, `-beta`, `-alpha`) never receive `latest`.

### When each security scan runs

| Scan | Push to `main` / `dev` and pull requests | Weekly and manual |
| --- | --- | --- |
| gitleaks | Always, full history | Yes |
| pip-audit | `**/pyproject.toml`, `uv.lock` changed | Yes |
| govulncheck | `go.work`, `**/go.mod`, `**/go.sum` or `**/*.go` changed | Yes |
| pnpm audit | `**/package.json`, `pnpm-lock.yaml` changed | Yes |
| Trivy (filesystem) | Any manifest or lockfile above, `**/Dockerfile`, `**/compose*.y*ml` or `release.yml` changed | Yes |

A change to `security-scan.yml` runs every scan. These scans are not part of `ci-required`, so a skipped scan never blocks a merge.

### Dependabot

`.github/dependabot.yml` opens pull requests against `dev` every Monday for uv, each Go module, npm, GitHub Actions, Dockerfiles and compose files. Per ecosystem:

- `security`: minor and patch security fixes in one pull request.
- `minor-and-patch`: all other minor and patch updates in one pull request.
- Major updates stay one pull request per dependency, so frameworks (Next.js, React, FastAPI, Zitadel) get an individual review.
- Dockerfiles and compose files add `major-per-image`: a major bump of one image (for example `postgres`) is one pull request across every directory.
