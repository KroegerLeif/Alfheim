# AGENTS.md — packages/go-shared (`alfheim/go-shared`)

Go module shared by every Go backend: OIDC JWT validation (`auth`), HTTP middleware (`httpmw`),
the PostgreSQL client (`db`) and the logger (`logger`). Adds to the [root rules](../../AGENTS.md).
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
- Never read household or role claims from the JWT. Household membership is confirmed per request against core/household.
- No backend-specific code: anything that knows about one app's config or features stays in that app's `internal/shared`.
