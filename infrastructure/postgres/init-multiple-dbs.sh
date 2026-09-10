#!/usr/bin/env bash
# ==============================================================================
# alfheim: Idempotent PostgreSQL Multi-Database and Multi-User Initializer
# ==============================================================================
# Executes automatically during initial boot of the postgres-core container.
# Idempotently creates dedicated databases using the pattern `alfheim_<app>`,
# creates isolated least-privilege users (`<app>_user`), and grants privileges.
# ==============================================================================

set -euo pipefail

# Helper function to execute SQL commands as postgres superuser
psql_exec() {
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    $1
EOSQL
}

# Helper function to create user if not exists and set password
create_user_if_not_exists() {
  local user="$1"
  local pass="$2"

  local user_exists
  user_exists=$(psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$user';" --username "$POSTGRES_USER" --dbname "postgres")

  if [ "$user_exists" != "1" ]; then
    echo "Creating user $user..."
    psql_exec "CREATE USER \"$user\" WITH PASSWORD '$pass';"
  else
    echo "User $user already exists. Updating password..."
    psql_exec "ALTER USER \"$user\" WITH PASSWORD '$pass';"
  fi
}

# Helper function to create database if not exists and set owner
create_db_if_not_exists() {
  local db="$1"
  local owner="$2"

  local db_exists
  db_exists=$(psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db';" --username "$POSTGRES_USER" --dbname "postgres")

  if [ "$db_exists" != "1" ]; then
    echo "Creating database $db owned by $owner..."
    psql_exec "CREATE DATABASE \"$db\" OWNER \"$owner\";"
  else
    echo "Database $db already exists. Ensuring ownership..."
    psql_exec "ALTER DATABASE \"$db\" OWNER \"$owner\";"
  fi

  # Grant all privileges on database schema public to owner
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
    GRANT ALL ON SCHEMA public TO "$owner";
    ALTER SCHEMA public OWNER TO "$owner";
EOSQL
}

# ------------------------------------------------------------------------------
# Database & User Provisioning Matrix
# Format: DB_NAME:USER_NAME:PASSWORD_ENV_VAR:DEFAULT_PASSWORD
# ------------------------------------------------------------------------------
SERVICES=(
  "zitadel:${ZITADEL_DB_USER:-zitadel_user}:${ZITADEL_DB_PASSWORD:-postgres}"
  "alfheim_dashboard:${DASHBOARD_POSTGRES_USER:-dashboard_user}:${DASHBOARD_POSTGRES_PASSWORD:-postgres}"
  "alfheim_pantry:${PANTRY_POSTGRES_USER:-pantry_user}:${PANTRY_POSTGRES_PASSWORD:-postgres}"
  "alfheim_shopping:${SHOPPING_POSTGRES_USER:-shopping_user}:${SHOPPING_POSTGRES_PASSWORD:-postgres}"
  "alfheim_maintenance:${MAINTENANCE_POSTGRES_USER:-maintenance_user}:${MAINTENANCE_POSTGRES_PASSWORD:-postgres}"
  "alfheim_chores:${CHORES_POSTGRES_USER:-chores_user}:${CHORES_POSTGRES_PASSWORD:-postgres}"
  "alfheim_budget:${BUDGET_POSTGRES_USER:-budget_user}:${BUDGET_POSTGRES_PASSWORD:-postgres}"
  "alfheim_chat:${CHAT_POSTGRES_USER:-chat_user}:${CHAT_POSTGRES_PASSWORD:-postgres}"
  "alfheim_workout:${WORKOUT_POSTGRES_USER:-workout_user}:${WORKOUT_POSTGRES_PASSWORD:-postgres}"
  "alfheim_library:${LIBRARY_POSTGRES_USER:-library_user}:${LIBRARY_POSTGRES_PASSWORD:-postgres}"
)

echo "=============================================================================="
echo "Initializing Alfheim Core Databases and Isolated Service Users..."
echo "=============================================================================="

for entry in "${SERVICES[@]}"; do
  IFS=":" read -r db user pass <<< "$entry"
  create_user_if_not_exists "$user" "$pass"
  create_db_if_not_exists "$db" "$user"
done

echo "=============================================================================="
echo "PostgreSQL Multi-Database Initialization Completed Successfully."
echo "=============================================================================="
