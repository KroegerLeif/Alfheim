# AGENTS.md — packages/go-shared (`alfheim/go-shared`)

Go module shared by every Go backend: OIDC JWT validation (`auth`), HTTP middleware (`httpmw`),
the PostgreSQL client (`db`), the logger (`logger`), household authorization (`household`),
AES-256-GCM secret encryption (`crypto`) and the outbound destination guard (`netguard`). Adds to the [root rules](../../AGENTS.md).
Conventions: [Go](../../docs/en/reference/conventions/go.md#shared-module).

## Commands

```bash
cd packages/go-shared && go test -race ./...
gofmt -l .                  # must print nothing
./scripts/verify.sh --go    # full gate from the repo root, must exit 0
```

## Specific to this module

- A change here affects every Go backend: run the full Go gate, not only this module's tests.
- `auth` stays strict: JWKS from the issuer's discovery document, issuer and audience required, RS256 only, expiry and subject required, no dependence on the request host. Do not widen the accepted algorithms.
- Never read household or role claims from the JWT. Household membership is confirmed per request against core/household (`household.RequireHousehold`); write endpoints add `household.RequireHouseholdRole`.
- `RequireHousehold` rejects the `SERVICE` role unless the route opts in with `household.AllowServiceScopes(...)`; service answers are never cached.
- Read no environment variables here. Backends read their own settings (`HOUSEHOLD_INTERNAL_URL`, `CHAT_ALLOWED_LLM_HOSTS`, encryption keys) in `config` and pass them to the constructors in `cmd/server/main.go`.
- `household`, `crypto` and `netguard` are security boundaries: they fail closed, and their coverage must not drop.
- No backend-specific code: anything that knows about one app's config or features stays in that app's `internal/shared`.
