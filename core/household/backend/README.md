# household-backend

Tier-1 core service that owns households, membership, roles, invites, the
household contact book and user profiles. Zitadel only authenticates users
(ADR 0003). This service decides who belongs to which household and with which
role.

📖 **Full specification** — routes, the internal membership API, roles and
household scoping for every other app — lives in the documentation portal:
[Reference → Household](../../../docs/en/reference/apps/household.md)

Authorization comes only from `household_members`, keyed by the household id
in the URL path. The service ignores the `X-Household-ID` and
`X-Household-Role` headers.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `DATABASE_URL` | `postgres://household_user:postgres@localhost:5432/alfheim_household?sslmode=disable` | Own database `alfheim_household` |
| `OIDC_ISSUER_URL` | `http://localhost:8080` | Zitadel issuer (JWKS discovered from it) |
| `OIDC_AUDIENCE` | `alfheim` | Expected `aud` claim |
| `ALFHEIM_EXTRA_CA_FILE` | unset | Extra PEM root CA to trust for the issuer (`--tls internal`) |
| `ALFHEIM_INTERNAL_TOKEN` | unset | Shared secret for the internal API. If unset, the internal API returns 503 and the service logs a warning at startup |
| `CORS_ALLOWED_ORIGINS` | local dev origins | Comma-separated CORS allowlist |
| `MIGRATIONS_DIR` | `migrations` | golang-migrate files, applied on startup |
| `DB_MAX_CONNS`, `DB_MIN_CONNS`, `DB_MAX_CONN_LIFETIME_MINUTES` | `25`, `5`, `30` | Pool tuning |

## Public API

Every route requires a valid Zitadel JWT (`Authorization: Bearer ...`).
`GET /healthz` (no auth) and `GET /readyz` are the only exceptions.

| Method and path | Who |
| --- | --- |
| `POST /api/v1/households` `{name, slug?}` | any user; creator becomes OWNER |
| `GET /api/v1/households/me` | own households, each with `role` and `is_default` |
| `GET /api/v1/households/{id}` | member |
| `PATCH /api/v1/households/{id}` `{name}` | OWNER, ADMIN |
| `DELETE /api/v1/households/{id}` | OWNER (cascades to members, invites, contacts) |
| `POST /api/v1/households/{id}/transfer-ownership` `{user_id}` | OWNER; the target must be a member; the old owner becomes ADMIN |
| `POST /api/v1/households/{id}/leave` | any member except OWNER |
| `PUT /api/v1/households/{id}/default` | member; sets the caller's default household |
| `PUT /api/v1/households/{id}/address` | OWNER, ADMIN |
| `POST /api/v1/households/invite` `{household_id, role?, ttl_minutes?, max_uses?}` | OWNER, ADMIN; role ADMIN, MEMBER or GUEST |
| `GET /api/v1/households/{id}/invites` | OWNER, ADMIN (active invites only) |
| `DELETE /api/v1/households/{id}/invites/{token}` | OWNER, ADMIN |
| `POST /api/v1/households/join` `{token}` | any user; 409 if already a member |
| `PUT /api/v1/households/{id}/members/{userID}/role` `{role}` | OWNER, ADMIN; never grants OWNER |
| `DELETE /api/v1/households/{id}/members/{userID}` | OWNER, ADMIN, or the member themselves; never the owner |
| `GET, POST /api/v1/households/{id}/contact-categories`, `PUT, DELETE .../{catId}` | read: member; write: OWNER, ADMIN |
| `GET, POST /api/v1/households/{id}/contacts`, `PUT, DELETE .../{contactId}` | read: member; write: see `internal/features/contact` |
| `GET, PUT /api/v1/profile/me` | any user |

The first household a user creates or joins becomes their default household.

## Internal API

Other backends call this route over the internal network. Caddy never routes
it, and it takes no JWT.

```
GET /internal/v1/memberships/{householdId}/{userSub}
Authorization: Bearer <ALFHEIM_INTERNAL_TOKEN>
```

The service compares the token in constant time.

| Status | Meaning |
| --- | --- |
| `200` | `{"household_id":"<uuid>","user_id":"<sub>","role":"OWNER\|ADMIN\|MEMBER\|GUEST"}` |
| `400` | `householdId` is not a UUID |
| `401` | missing or wrong token |
| `404` | the household does not exist or the user is not a member |
| `503` | `ALFHEIM_INTERNAL_TOKEN` is not configured |

## Roles

| Action | OWNER | ADMIN | MEMBER | GUEST |
| --- | :-: | :-: | :-: | :-: |
| View household, members, contacts | yes | yes | yes | yes |
| Rename, edit address, manage invites | yes | yes | no | no |
| Change roles and remove members (not the owner) | yes | yes | no | no |
| Grant OWNER (invite or role change) | no | no | no | no |
| Transfer ownership, delete household | yes | no | no | no |
| Leave household | no | yes | yes | yes |

Only transfer-ownership can change the owner. The schema enforces one OWNER
per household, one default household per user, valid role names, and that
invites never carry OWNER.

## Development

```sh
go test -race -cover ./...
# Optional PostgreSQL integration tests (the public schema is reset):
docker run -d --rm -p 55432:5432 -e POSTGRES_PASSWORD=pg postgres:16-alpine
HOUSEHOLD_TEST_DATABASE_URL='postgres://postgres:pg@localhost:55432/postgres?sslmode=disable' go test -race ./...
```
