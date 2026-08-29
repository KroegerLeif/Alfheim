# Keycloak Identity & Access Management (`infrastructure/keycloak/`)

The `infrastructure/keycloak` module configures Keycloak OIDC (OpenID Connect) service for authentication and single sign-on (SSO) across the Alfheim monorepo.

---

## 🎯 Purpose & Realm Architecture

Keycloak acts as the central Identity Provider (IdP) for all core and microservice applications:

- **Realm**: `alfheim` (pre-configured in `alfheim-realm.json`).
- **User Authentication**: Standard OIDC Authorization Code Flow with PKCE for microfrontends.
- **Token Claims**: Extends standard JWT access tokens with `household_id`, `active_household_id`, and `households` array claims for tenant isolation.
- **Storage**: Backed by PostgreSQL (`postgres-iam`).

---

## ⚙️ Environment Variables

Configured in `infrastructure/keycloak/.env.example` / `.env`:

- `KEYCLOAK_ADMIN`: Admin console username (default: `admin`).
- `KEYCLOAK_ADMIN_PASSWORD`: Admin console password (default: `admin`).
- `KC_DB`: Database engine (`postgres`).
- `KC_DB_URL`: JDBC connection string (`jdbc:postgresql://postgres-iam:5432/keycloak_db`).
- `KC_DB_USERNAME`: Database user (`alfheim_admin`).
- `KC_DB_PASSWORD`: Database password.

---

## 🔗 Realm Auto-Import

`alfheim-realm.json` contains pre-configured client definitions, scopes, and test users:
- **Clients**: `chat-backend`, `dashboard-frontend`, `pantry-frontend`, `shopping-frontend`, etc.
- **Import Location**: Mounted read-only into `/opt/keycloak/data/import/alfheim-realm.json` in `infrastructure/compose.yml`.
- **Command Flag**: Keycloak container starts with `start-dev --import-realm`.

---

## 🚀 Execution & Management

```bash
# Start Keycloak and postgres-iam container stack
docker compose -f infrastructure/compose.yml up -d keycloak

# View Keycloak startup logs
docker compose -f infrastructure/compose.yml logs -f keycloak
```
