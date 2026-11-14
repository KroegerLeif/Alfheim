---
title: "Go Conventions"
description: "Canonical conventions for Alfheim Go backends: feature layout, layering, error handling and household authorization."
sidebar:
  label: "Go"
---

> **TL;DR:** Canonical conventions for every Go module (`apps/chat/backend`, `core/dashboard/backend`, `core/household/backend`, `packages/go-shared`, `tools/installer`). Nested `AGENTS.md` files link here instead of repeating these rules.

---

## Stack

Go 1.22+, standard library first (`net/http`, `context`, `encoding/json`), light idiomatic drivers where needed.

## Feature layout

```text
cmd/server/main.go        # entry point and dependency wiring
internal/features/<domain>/
├── entity.go             # domain structs and types
├── dto.go                # request and response objects, validation
├── service.go            # business logic behind an interface
├── handler.go            # HTTP handlers and route registration
├── repository.go         # database access behind an interface
└── errors.go             # sentinel errors such as ErrNotFound
internal/shared/          # app-specific, domain-agnostic code (for example chat's householdclient)
```

## Shared module

`packages/go-shared` (module `alfheim/go-shared`) holds the code every Go backend needs exactly once. Import it instead of copying it into `internal/shared`:

| Package | Contents |
| --- | --- |
| `auth` | OIDC bearer token validation (`NewAuthenticator`, `AuthenticateMiddleware`), `UserClaims`, the operator role (`RequireOperator`) |
| `httpmw` | `RequestLogger`, `CORSWithOrigins`, `MaxBodySize`, `Chain`, `ExtraCATransport` (`ALFHEIM_EXTRA_CA_FILE`) |
| `db` | `Config`, the pgx pool `Client` and golang-migrate `RunMigrations` |
| `logger` | JSON `slog` logger with OpenTelemetry trace and span ids |

- `auth.NewAuthenticator(ctx, auth.Config{IssuerURL, Audience, HTTPClient, Logger})` discovers the JWKS from `{IssuerURL}/.well-known/openid-configuration`. Issuer and audience are required and always checked, tokens need an expiry and a subject, and only RS256 is accepted. The request host plays no part. Tests inject `HTTPClient`; production leaves it nil to get a client that trusts `ALFHEIM_EXTRA_CA_FILE`.
- `UserClaims` carries identity only. Household membership and role never come from the token: see [Household authorization](#household-authorization).
- Each backend aliases its database settings to the shared type (`type DatabaseConfig = db.Config`) and passes its own allowed CORS methods and headers.
- Backends require `alfheim/go-shared v0.0.0` with `replace alfheim/go-shared => ../../../packages/go-shared`, so a module builds outside `go.work`. Their Dockerfiles therefore build from the repository root (`docker build -f core/dashboard/backend/Dockerfile .`), as the compose files and the release workflow do.
- A change to `packages/go-shared` affects every Go backend: run the whole `./scripts/verify.sh --go` gate.

## Conventions

- Package names are short, lower case and single word.
- Define interfaces where they are consumed, not where they are implemented. A feature that needs another feature declares its own narrow interface instead of importing it.
- Check every error. Ignore one with `_` only with a comment that says why.
- Pass `ctx context.Context` as the first parameter of any function that does I/O.
- Handlers parse the request into a DTO, call the service and serialize the response. The service is plain Go, depends on repository interfaces and knows nothing about HTTP.

## Household authorization

Authorization rules are in [Authentication and security](../../explanation/authentication-security.md) and [ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md). In code:

- `middleware.RequireHousehold` runs after JWT validation. Use the chat backend as the reference: `apps/chat/backend/internal/shared/middleware/household.go` with `internal/shared/householdclient`.
- The client asks `GET {HOUSEHOLD_INTERNAL_URL}/internal/v1/memberships/{householdId}/{userSub}` with `Authorization: Bearer $ALFHEIM_INTERNAL_TOKEN`, caches members for 30 s and non-members for 5 s, never caches errors, and fails closed with `503 household_service_unavailable`.
- Errors use the shared body `{"detail": {"code", "message"}}`. Roles come from the membership response, never from the JWT.
- Outbound calls to MCP servers or other apps forward the caller's bearer token and `X-Household-ID`, set per request.

## Gates

`./scripts/verify.sh --go` runs `gofmt`, `go vet` and `go test -race`. `golangci-lint run` is optional when installed. `tools/installer` keeps at least 80 % coverage.
