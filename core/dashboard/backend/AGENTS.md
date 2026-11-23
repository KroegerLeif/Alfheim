# AGENTS.md — core/dashboard/backend

Go backend: App launcher: catalog, household launchers, user links, preferences, telemetry view. Adds to the [root rules](../../../AGENTS.md).

Conventions (layout, interfaces, errors, household auth): [Go](../../../docs/en/reference/conventions/go.md).

## Commands

```bash
cd core/dashboard/backend && go test -race ./...
gofmt -l .                  # must print nothing
./scripts/verify.sh --go    # full gate from the repo root, must exit 0
```

## Specific to this app

- Migrations: `migrations/`. Schema changes are new numbered migration files, never edits to old ones.
- Households, members, roles and profiles live in `core/household`. Only household-scoped features (`launchers`) read `X-Household-ID`, through `household.RequireHousehold` from `alfheim/go-shared`; writes add `household.RequireHouseholdRole(OWNER, ADMIN)`. `X-Household-Role` is always ignored.
- Launchers are links only (ADR 0010): never fetch, proxy or embed the target and store no credential for it. Anything that talks to the target is a typed plugin (migration `000009` is reserved for it).
- Tier-1 apps are registered in `internal/features/apps/tier1_core_registry.go`; Tier-2 integrations in `deploy/stack-apps.yaml`.

Reference page: [docs/en/reference/apps/dashboard.md](../../../docs/en/reference/apps/dashboard.md).
