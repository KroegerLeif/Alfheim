# PostgreSQL Core Service (`infrastructure/postgres/`)

The `infrastructure/postgres` module provisions the consolidated PostgreSQL database cluster (`postgres-core`) for all Alfheim microservices, core control planes, and identity services.

---

## 🎯 Purpose & Role

Instead of running separate PostgreSQL container instances for each service, Alfheim uses a single `postgres-core` database server (PostgreSQL 16) hosting 10 isolated databases using the unified naming convention `alfheim_<app>`.

To enforce least-privilege security, each microservice connects using its own dedicated database user (`<app>_user`) restricted to its own database.

---

## 🗄️ Database & User Matrix

| Database Name | Owner / User | Description |
| :--- | :--- | :--- |
| `alfheim_iam` | `iam_user` | Keycloak Identity & Access Management storage |
| `alfheim_dashboard` | `dashboard_user` | Core Dashboard control plane storage |
| `alfheim_pantry` | `pantry_user` | Pantry inventory management database |
| `alfheim_shopping` | `shopping_user` | Shopping list database |
| `alfheim_maintenance` | `maintenance_user` | Home maintenance & equipment logs |
| `alfheim_chores` | `chores_user` | Household chore schedules & assignments |
| `alfheim_budget` | `budget_user` | Financial transactions & budget tracking |
| `alfheim_chat` | `chat_user` | Chat assistant history & metadata |
| `alfheim_workout` | `workout_user` | Fitness & workout tracking storage |
| `alfheim_library` | `library_user` | Media & digital library catalog |

---

## ⚙️ Initialization & Security

- **Initialization Script**: `infrastructure/postgres/init-multiple-dbs.sh` is mounted into `/docker-entrypoint-initdb.d/` and executes on container first boot.
- **Idempotency**: The script checks `pg_database` and `pg_roles` before creating databases and users, ensuring safe restarts on existing volume data.
- **Isolation**: Each user is granted ownership of its corresponding database schema and cannot access other databases without explicit authorization.

---

## 🌐 Network & Healthcheck

- **Container Name**: `alfheim_postgres_core`
- **Internal Port**: `5432`
- **Docker Networks**: Connected to `infra-net`, `core-net`, and all app networks (`app-*-net`).
- **Healthcheck**: Executed via `pg_isready -U postgres` every 5 seconds.
- **Volume Mount**: `./postgres/data` mounted to `/var/lib/postgresql/data`.
