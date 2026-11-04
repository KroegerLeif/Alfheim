# AGENTS.md — packages/backend-shared (`backend_shared`)

Python package shared by every FastAPI backend: OIDC discovery and JWT validation, household
authorization, MCP middleware, storage helpers, telemetry, TLS. Adds to the
[root rules](../../AGENTS.md). Conventions:
[Python and FastAPI](../../docs/en/reference/conventions/python-fastapi.md).

## Commands

```bash
uv run pytest packages/backend-shared --cov
uv run ruff check packages/backend-shared && uv run ty check packages/backend-shared
./scripts/verify.sh --python   # full gate, must exit 0
```

## Specific to this package

- A change here affects every backend. Keep public names in `backend_shared.household` (`require_household`, `require_role`, `HouseholdContext`, `configure_household_auth`, `close_membership_client`) stable, or update all callers in the same change.
- Fail closed: membership lookup errors end in `503 household_service_unavailable`, never in a permissive default. Cache members 30 s, non-members 5 s, never errors.
- Never read household or role claims from the JWT. Keep the error body `{"detail": {"code", "message"}}`.
- Token validation resolves the JWKS from the issuer's discovery document and does not depend on the host the token was issued on.
- Object keys come from `backend_shared.storage` helpers: `households/{household_id}/{app}/...` or `users/{user_id}/{app}/...`.
- `backend_shared.household.testing` (`make_test_token`, `override_membership`) is public API for app tests.
