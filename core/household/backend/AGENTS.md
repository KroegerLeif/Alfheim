# AGENTS.md — core/household/backend

Go backend: Source of truth for households, memberships, roles, invites, contacts and profiles. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, interfaces, errors, household auth): [Go](../../../docs/en/reference/conventions/go.md).

## Commands

```bash
cd core/household/backend && go test -race ./...
gofmt -l .                  # must print nothing
./scripts/verify.sh --go    # full gate from the repo root, must exit 0
```

## Specific to this app

- Migrations: `migrations/`. Schema changes are new numbered migration files, never edits to old ones.
- The internal membership API (`/internal/v1/memberships/...`, `/internal/v1/households/{id}/members`) is called by every other backend with `ALFHEIM_INTERNAL_TOKEN`; keep its contract stable.
- The public API authorizes only from `household_members`, keyed by the household id in the URL path.
- Roles are `OWNER`, `ADMIN`, `MEMBER`, `GUEST`.

Reference page: [docs/en/reference/apps/household.md](../../../docs/en/reference/apps/household.md).
