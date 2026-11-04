---
title: "Go Conventions"
description: "Canonical conventions for Alfheim Go backends: feature layout, layering, error handling and household authorization."
sidebar:
  label: "Go"
---

> **TL;DR:** Canonical conventions for every Go module (`apps/chat/backend`, `core/dashboard/backend`, `core/household/backend`, `tools/installer`). Nested `AGENTS.md` files link here instead of repeating these rules.

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
internal/shared/          # domain-agnostic code: logger, database, middleware
```

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
