# PostgreSQL IAM Storage (`infrastructure/postgres-iam/`)

The `infrastructure/postgres-iam` module provisions the PostgreSQL database instance reserved specifically for Keycloak identity and session storage in the Alfheim infrastructure stack.

---

## 🎯 Purpose & Role

Keycloak requires a persistent relational database for storing realms, user accounts, credentials, clients, user sessions, and operational logs. `postgres-iam` provides an isolated PostgreSQL 16 container for this purpose.

---

## ⚙️ Environment Variables

Configured in `infrastructure/postgres-iam/.env.example` / `.env`:

- `POSTGRES_USER`: Keycloak database user (default: `alfheim_admin`).
- `POSTGRES_PASSWORD`: Keycloak database password (default: `super_secret_local_password`).
- `POSTGRES_DB`: Keycloak database name (default: `keycloak_db`).

---

## 🌐 Network & Healthcheck

- **Container Name**: `alfheim_postgres_iam`
- **Internal Port**: `5432`
- **Docker Network**: `infra-net` (internal infrastructure network)
- **Healthcheck**: Executed via `pg_isready -U alfheim_admin -d keycloak_db` every 5 seconds.
- **Volume Mount**: `./postgres-iam/data` mounted to `/var/lib/postgresql/data`.

---

## 🚀 Execution & Management

```bash
# Start IAM PostgreSQL database container
docker compose -f infrastructure/compose.yml up -d postgres-iam

# Check database health status
docker inspect --format='{{json .State.Health}}' alfheim_postgres_iam
```
