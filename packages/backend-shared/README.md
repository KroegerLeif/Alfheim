# backend-shared

Shared Python backend library for Alfheim microservices providing unified S3 object storage utilities, OpenTelemetry instrumentation and logging, and OIDC JWT authentication dependencies.

OIDC discovery and JWKS calls trust the system roots plus any extra root CA named by `ALFHEIM_EXTRA_CA_FILE` (`backend_shared.tls`), which lets backends verify an issuer signed by the installer's local root CA. See the [environment variables reference](../../docs/en/reference/environment-variables.md).

## Household authorization (`backend_shared.household`)

Zitadel only authenticates. Household membership and roles live in the household app (`core/household`), so every household-scoped request is authorized by asking its internal membership API:

```text
GET {HOUSEHOLD_INTERNAL_URL}/internal/v1/memberships/{householdId}/{userSub}
Authorization: Bearer {ALFHEIM_INTERNAL_TOKEN}
```

### Usage

```python
from fastapi import Depends
from backend_shared.household import HouseholdContext, configure_household_auth, require_household, require_role

configure_household_auth(settings)  # once in main.py: OIDC settings for JWT validation, validates env


@router.get("/items")
async def list_items(ctx: HouseholdContext = Depends(require_household)):
    return await service.list_items(household_id=ctx.household_id, user_id=ctx.user_id)


@router.delete("/items/{item_id}")
async def delete_item(item_id: int, ctx: HouseholdContext = Depends(require_role("OWNER", "ADMIN"))): ...
```

`HouseholdContext` is a frozen dataclass with these fields:

- `user_sub`: the JWT `sub`.
- `user_id`: a UUID. Non-UUID subjects map to `uuid5(NAMESPACE_DNS, sub)`, the same derivation as the legacy dependencies, so existing rows keep matching.
- `household_id`: a UUID.
- `role`: `OWNER`, `ADMIN`, `MEMBER` or `GUEST`.
- `email` and `username`: from the JWT, if present.

Results are cached per process, keyed by `(household_id, sub)`: members for 30 seconds, non-members for 5 seconds. Errors are never cached. Call `await close_membership_client()` from the lifespan shutdown to release connections.

### MCP

Wrap the MCP app with `MCPAuthenticationMiddleware(mcp_app, settings=settings)`. It runs the same resolution and error contract. Tools read the context with `backend_shared.mcp_middleware.get_mcp_household_context()`. The `get_mcp_user_context()` alias returns the same object but stays typed `Any` until all apps are migrated.

### Error contract

The body is `{"detail": {"code": ..., "message": ...}}`.

| Status | Code | When |
| --- | --- | --- |
| 401 | `unauthenticated` | The JWT is missing, malformed or invalid, or has no `sub`. |
| 400 | `household_required` | The `X-Household-ID` header is missing. |
| 400 | `household_invalid` | `X-Household-ID` is not a UUID. |
| 403 | `household_forbidden` | The user is not a member of the household. |
| 403 | `household_role_forbidden` | The user is a member, but `require_role` does not allow their role. |
| 503 | `household_service_unavailable` | The membership API is unreachable, times out (2 seconds), returns 5xx or rejects the internal token, or the token is not configured. Requests never fail open. |

### Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | `https` URLs also trust `ALFHEIM_EXTRA_CA_FILE`. |
| `ALFHEIM_INTERNAL_TOKEN` | None | Required outside tests. `configure_household_auth` raises `HouseholdConfigError` at startup when it is missing. |

### Testing apps

```python
from backend_shared.household.testing import (
    make_test_token,
    mcp_household_context,
    override_household,
    override_membership,
)

# Keep JWT decoding, stub the membership API:
override_membership(app, {(household_id, "user-1"): "OWNER"})
headers = {"Authorization": f"Bearer {make_test_token('user-1')}", "X-Household-ID": str(household_id)}

# Or skip authentication entirely:
ctx = override_household(app, role="MEMBER")

# MCP tool unit tests:
with mcp_household_context(role="OWNER") as ctx:
    await my_tool(...)
```

Unsigned test tokens only decode when `is_mock_auth_allowed()` is true, which means pytest or `TESTING=true` and never production or staging. Undo overrides with `app.dependency_overrides.clear()`.

### Deprecated

`get_current_user_and_home`, `get_current_user_and_household`, `UserHomeContext` and `UserHouseholdContext` in `backend_shared.dependencies` trust household claims Zitadel never issues. They remain only until every app is migrated.
