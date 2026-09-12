#!/usr/bin/env bash
# ==============================================================================
# alfheim: Production Environment Initialization & Secret Generator
# ==============================================================================
# Generates a secure, production-grade .env file from .env.example with
# cryptographically strong random passwords, encryption keys, and single-root
# URL derivation for all frontend and API microservice endpoints.
#
# Usage:
#   ./scripts/init-env.sh                                   # Interactive mode
#   ./scripts/init-env.sh --auto                            # Non-interactive generation (default: https://alfheim.loegien.de)
#   ./scripts/init-env.sh --base-url https://my.os          # Set base URL non-interactively
#   ./scripts/init-env.sh --domain my.os                    # Set target domain (backwards compatible)
#   ./scripts/init-env.sh -f / --force                      # Overwrite existing .env
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Terminal Formatting & UI Utilities
# ------------------------------------------------------------------------------
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
MAGENTA="\033[0;35m"
RED="\033[0;31m"
DIM="\033[2m"
RESET="\033[0m"

log_info()    { echo -e "${CYAN}▶${RESET}  $*"; }
log_success() { echo -e "${GREEN}✔${RESET}  $*"; }
log_warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
log_error()   { echo -e "${RED}✖${RESET}  $*" >&2; }

# ------------------------------------------------------------------------------
# Resolve Working & Template Paths
# ------------------------------------------------------------------------------
TARGET_DIR="${ALFHEIM_INSTALL_DIR:-$(pwd)}"
TEMPLATE_FILE="${TARGET_DIR}/.env.example"
OUTPUT_FILE="${TARGET_DIR}/.env"

# If running inside repo or external directory, fallback to script directory parent
if [[ ! -f "$TEMPLATE_FILE" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
  if [[ -f "${REPO_ROOT}/.env.example" ]]; then
    TEMPLATE_FILE="${REPO_ROOT}/.env.example"
    OUTPUT_FILE="${TARGET_DIR}/.env"
  fi
fi

# ------------------------------------------------------------------------------
# Cryptographic Random Generators
# ------------------------------------------------------------------------------
generate_secret() {
  local length="${1:-24}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$((length / 2))"
  else
    # POSIX /dev/urandom fallback
    LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c "$length" || echo "alfheim_$(date +%s)"
  fi
}

generate_base64_32() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n'
  fi
}

# Zitadel requires a masterkey that is exactly 32 bytes long.
generate_masterkey() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 16
  else
    LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 32
  fi
}

# Zitadel's default password complexity policy requires at least one uppercase
# letter, one lowercase letter, one digit and one symbol. Prefixing a random
# base with "Aa1!" guarantees all four classes are present.
generate_zitadel_password() {
  printf 'Aa1!%s' "$(generate_secret 20)"
}

# ------------------------------------------------------------------------------
# CLI Arguments Parsing
# ------------------------------------------------------------------------------
AUTO_MODE=false
FORCE=false
CUSTOM_BASE_URL=""
CUSTOM_DOMAIN=""
CUSTOM_REGISTRY=""
CUSTOM_REPO=""
CUSTOM_TAG=""

show_help() {
  cat << USAGE
Usage: $(basename "$0") [OPTIONS]

Options:
  -a, --auto                  Run non-interactively and generate secure defaults
  -b, --base-url <url>        Configure root base URL (default: https://alfheim.loegien.de)
  -d, --domain <domain>       Configure domain / host (backwards compatible)
  -r, --registry <registry>   Configure container registry (auto-derived from Git remote if omitted)
  --repo <repo>               Configure image repository (auto-derived from Git remote if omitted)
  --tag <tag>                 Configure container image tag (default: latest)
  -f, --force                 Overwrite existing .env file
  -h, --help                  Show this help message
USAGE
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--auto)
      AUTO_MODE=true
      shift
      ;;
    -b|--base-url)
      CUSTOM_BASE_URL="$2"
      shift 2
      ;;
    --base-url=*)
      CUSTOM_BASE_URL="${1#*=}"
      shift
      ;;
    -d|--domain)
      CUSTOM_DOMAIN="$2"
      shift 2
      ;;
    --domain=*)
      CUSTOM_DOMAIN="${1#*=}"
      shift
      ;;
    -r|--registry|--image-registry)
      CUSTOM_REGISTRY="$2"
      shift 2
      ;;
    --registry=*|--image-registry=*)
      CUSTOM_REGISTRY="${1#*=}"
      shift
      ;;
    --repo|--image-repo)
      CUSTOM_REPO="$2"
      shift 2
      ;;
    --repo=*|--image-repo=*)
      CUSTOM_REPO="${1#*=}"
      shift
      ;;
    --tag|--image-tag)
      CUSTOM_TAG="$2"
      shift 2
      ;;
    --tag=*|--image-tag=*)
      CUSTOM_TAG="${1#*=}"
      shift
      ;;
    -f|--force)
      FORCE=true
      shift
      ;;
    -h|--help)
      show_help
      ;;
    *)
      log_error "Unknown option: $1"
      show_help
      ;;
  esac
done

# ------------------------------------------------------------------------------
# Verification & Prerequisites
# ------------------------------------------------------------------------------
if [[ ! -f "$TEMPLATE_FILE" ]]; then
  log_error "Template file '$TEMPLATE_FILE' not found!"
  exit 1
fi

# ------------------------------------------------------------------------------
# Legacy Environment Migration
# ------------------------------------------------------------------------------
migrate_existing_env() {
  local env_file="$1"
  local migrated=false

  # 1. Migrate legacy database host: postgres-iam -> postgres-core
  if grep -q "postgres-iam" "$env_file"; then
    sed -i.bak -e 's|postgres-iam|postgres-core|g' "$env_file" && rm -f "${env_file}.bak"
    migrated=true
    log_warn "Migrated legacy database host 'postgres-iam' -> 'postgres-core' in $(basename "$env_file")"
  fi

  # 2. Migrate legacy IAM database name & user
  if grep -qE '^KC_DB_URL=.*keycloak_db' "$env_file"; then
    sed -i.bak -e 's|/keycloak_db|/alfheim_iam|g' "$env_file" && rm -f "${env_file}.bak"
    migrated=true
    log_warn "Migrated legacy IAM database 'keycloak_db' -> 'alfheim_iam' in $(basename "$env_file")"
  fi
  if grep -qE '^KC_DB_USERNAME=alfheim_admin' "$env_file"; then
    sed -i.bak -e 's|^KC_DB_USERNAME=alfheim_admin|KC_DB_USERNAME=iam_user|g' "$env_file" && rm -f "${env_file}.bak"
    migrated=true
    log_warn "Migrated legacy KC_DB_USERNAME 'alfheim_admin' -> 'iam_user' in $(basename "$env_file")"
  fi
  if grep -qE '^IAM_POSTGRES_USER=alfheim_admin' "$env_file"; then
    sed -i.bak -e 's|^IAM_POSTGRES_USER=alfheim_admin|IAM_POSTGRES_USER=iam_user|g' "$env_file" && rm -f "${env_file}.bak"
    migrated=true
  fi
  if grep -qE '^POSTGRES_DB=keycloak_db' "$env_file"; then
    sed -i.bak -e 's|^POSTGRES_DB=keycloak_db|POSTGRES_DB=postgres|g' "$env_file" && rm -f "${env_file}.bak"
    migrated=true
  fi

  # 3. Migrate legacy app database names
  local legacy_dbs=(
    "DASHBOARD_POSTGRES_DB=dashboard_db:DASHBOARD_POSTGRES_DB=alfheim_dashboard"
    "PANTRY_POSTGRES_DB=pantry:PANTRY_POSTGRES_DB=alfheim_pantry"
    "SHOPPING_POSTGRES_DB=shopping:SHOPPING_POSTGRES_DB=alfheim_shopping"
    "MAINTENANCE_POSTGRES_DB=maintenance:MAINTENANCE_POSTGRES_DB=alfheim_maintenance"
    "CHORES_POSTGRES_DB=chores:CHORES_POSTGRES_DB=alfheim_chores"
    "BUDGET_POSTGRES_DB=budget:BUDGET_POSTGRES_DB=alfheim_budget"
    "CHAT_POSTGRES_DB=chat_db:CHAT_POSTGRES_DB=alfheim_chat"
    "WORKOUT_POSTGRES_DB=workout:WORKOUT_POSTGRES_DB=alfheim_workout"
    "LIBRARY_POSTGRES_DB=library:LIBRARY_POSTGRES_DB=alfheim_library"
  )

  for pair in "${legacy_dbs[@]}"; do
    local old_val="${pair%%:*}"
    local new_val="${pair##*:}"
    if grep -q "^${old_val}" "$env_file"; then
      sed -i.bak -e "s|^${old_val}|${new_val}|g" "$env_file" && rm -f "${env_file}.bak"
      migrated=true
    fi
  done

  # 4. Migrate legacy app database users (postgres -> <app>_user)
  local legacy_users=(
    "DASHBOARD_POSTGRES_USER=postgres:DASHBOARD_POSTGRES_USER=dashboard_user"
    "PANTRY_POSTGRES_USER=postgres:PANTRY_POSTGRES_USER=pantry_user"
    "SHOPPING_POSTGRES_USER=postgres:SHOPPING_POSTGRES_USER=shopping_user"
    "MAINTENANCE_POSTGRES_USER=postgres:MAINTENANCE_POSTGRES_USER=maintenance_user"
    "CHORES_POSTGRES_USER=postgres:CHORES_POSTGRES_USER=chores_user"
    "BUDGET_POSTGRES_USER=postgres:BUDGET_POSTGRES_USER=budget_user"
    "CHAT_POSTGRES_USER=postgres:CHAT_POSTGRES_USER=chat_user"
    "WORKOUT_POSTGRES_USER=postgres:WORKOUT_POSTGRES_USER=workout_user"
    "LIBRARY_POSTGRES_USER=postgres:LIBRARY_POSTGRES_USER=library_user"
  )

  for pair in "${legacy_users[@]}"; do
    local old_user="${pair%%:*}"
    local new_user="${pair##*:}"
    if grep -q "^${old_user}" "$env_file"; then
      sed -i.bak -e "s|^${old_user}|${new_user}|g" "$env_file" && rm -f "${env_file}.bak"
      migrated=true
    fi
  done

  # 5. Inject missing IAM_POSTGRES_* variables if not present
  if ! grep -q "^IAM_POSTGRES_USER=" "$env_file"; then
    echo "IAM_POSTGRES_USER=iam_user" >> "$env_file"
    migrated=true
  fi
  if ! grep -q "^IAM_POSTGRES_DB=" "$env_file"; then
    echo "IAM_POSTGRES_DB=alfheim_iam" >> "$env_file"
    migrated=true
  fi

  # 6. Rename legacy identity-provider variables (issue #358).
  #    ADR 0003 replaced Keycloak with Zitadel; the variable names followed in
  #    this release. Old names are rewritten in place so existing installations
  #    keep booting after an upgrade.
  local legacy_auth_vars=(
    "KEYCLOAK_PUBLIC_URL:OIDC_ISSUER_URL"
    "KEYCLOAK_PUBLIC_ISSUER:OIDC_ISSUER_URL"
    "KEYCLOAK_BASE_URL:OIDC_INTERNAL_URL"
    "KEYCLOAK_URL:OIDC_INTERNAL_URL"
    "KEYCLOAK_JWKS_URL:OIDC_JWKS_URL"
    "NEXT_PUBLIC_KEYCLOAK_URL:NEXT_PUBLIC_OIDC_ISSUER"
  )
  for pair in "${legacy_auth_vars[@]}"; do
    local old_var="${pair%%:*}"
    local new_var="${pair##*:}"
    if grep -qE "^${old_var}=" "$env_file" && ! grep -qE "^${new_var}=" "$env_file"; then
      sed -i.bak -e "s|^${old_var}=|${new_var}=|" "$env_file" && rm -f "${env_file}.bak"
      migrated=true
      log_warn "Renamed legacy auth variable '${old_var}' -> '${new_var}' in $(basename "$env_file")"
    elif grep -qE "^${old_var}=" "$env_file"; then
      sed -i.bak -e "/^${old_var}=/d" "$env_file" && rm -f "${env_file}.bak"
      migrated=true
      log_warn "Dropped legacy auth variable '${old_var}' (superseded by '${new_var}') in $(basename "$env_file")"
    fi
  done

  # 7. KEYCLOAK_REALM has no Zitadel equivalent: the JWKS URI comes from discovery.
  if grep -qE "^KEYCLOAK_REALM=" "$env_file"; then
    sed -i.bak -e "/^KEYCLOAK_REALM=/d" "$env_file" && rm -f "${env_file}.bak"
    migrated=true
    log_warn "Dropped obsolete 'KEYCLOAK_REALM' (Zitadel has no realms) in $(basename "$env_file")"
  fi

  if [[ "$migrated" == true ]]; then
    log_success "Successfully migrated legacy database configuration in $(basename "$env_file")"
  fi
}

if [[ -f "$OUTPUT_FILE" && "$FORCE" != true ]]; then
  log_warn "Target environment file '$OUTPUT_FILE' already exists."
  migrate_existing_env "$OUTPUT_FILE"
  if [[ "$AUTO_MODE" == true ]]; then
    log_info "Skipping secret generation. Use --force to regenerate."
    exit 0
  fi
  read -r -p "Do you want to overwrite it? [y/N] " response
  if [[ ! "$response" =~ ^[yY](es)?$ ]]; then
    log_info "Aborted. Existing .env preserved."
    exit 0
  fi
fi

echo -e "\n${BOLD}${MAGENTA}==============================================================================${RESET}"
echo -e "${BOLD}${CYAN}  Alfheim: Production Secret & Environment Initializer${RESET}"
echo -e "${BOLD}${MAGENTA}==============================================================================${RESET}\n"

# ------------------------------------------------------------------------------
# Base URL & Domain Derivation
# ------------------------------------------------------------------------------
DEFAULT_BASE_URL="https://alfheim.loegien.de"
BASE_URL=""

if [[ -n "${CUSTOM_BASE_URL}" ]]; then
  BASE_URL="$CUSTOM_BASE_URL"
elif [[ -n "${CUSTOM_DOMAIN}" ]]; then
  if [[ "$CUSTOM_DOMAIN" =~ ^https?:// ]]; then
    BASE_URL="$CUSTOM_DOMAIN"
  else
    BASE_URL="https://${CUSTOM_DOMAIN}"
  fi
elif [[ "$AUTO_MODE" == false ]]; then
  read -r -p "Enter root Base URL [default: ${DEFAULT_BASE_URL}]: " user_url
  if [[ -n "$user_url" ]]; then
    BASE_URL="$user_url"
  else
    BASE_URL="${ALFHEIM_BASE_URL:-$DEFAULT_BASE_URL}"
  fi
else
  BASE_URL="${ALFHEIM_BASE_URL:-$DEFAULT_BASE_URL}"
fi

# Strip trailing slashes
BASE_URL="${BASE_URL%/}"

# Ensure scheme is present (default to https://)
if [[ ! "$BASE_URL" =~ ^https?:// ]]; then
  BASE_URL="https://${BASE_URL}"
fi

# Parse scheme
if [[ "$BASE_URL" =~ ^(https?):// ]]; then
  SCHEME="${BASH_REMATCH[1]}"
else
  SCHEME="https"
fi

# Extract host and optional port
HOST_PORT="${BASE_URL#*://}"
HOST_PORT="${HOST_PORT%%/*}"
HOST_HEADER="$HOST_PORT"

# Extract naked hostname without port for domain calculations
NAKED_HOST="${HOST_HEADER%%:*}"

# Derive apex domain
if [[ "$NAKED_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  # IPv4 address
  DOMAIN="$NAKED_HOST"
else
  DOT_COUNT=$(awk -F. '{print NF-1}' <<< "$NAKED_HOST")
  if [[ "$DOT_COUNT" -ge 2 ]]; then
    # e.g. alfheim.loegien.de -> loegien.de
    DOMAIN=$(echo "$NAKED_HOST" | sed -E 's/^[^.]+\.//')
  else
    # e.g. loegien.de or localhost
    DOMAIN="$NAKED_HOST"
  fi
fi

log_info "Configuring Base URL:    ${BOLD}${BASE_URL}${RESET}"
log_info "Derived Host Header:     ${BOLD}${HOST_HEADER}${RESET}"
log_info "Derived Apex Domain:     ${BOLD}${DOMAIN}${RESET}"

# ------------------------------------------------------------------------------
# OIDC Issuer Derivation (Zitadel is served on its own dedicated auth.* host)
#
# The derived host must be one infrastructure/caddy/compose.yml declares as a
# gateway-net alias, because backends resolve the issuer over Docker DNS to
# fetch the discovery document at startup.
# ------------------------------------------------------------------------------
if [[ "$NAKED_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ || "$NAKED_HOST" == "localhost" ]]; then
  AUTH_HOST="${NAKED_HOST}"
elif [[ "$NAKED_HOST" == *.localhost ]]; then
  # Local development: the *.localhost aliases are full hostnames, so the apex
  # (loegien.localhost) is not routed — auth.alfheim.loegien.localhost is.
  AUTH_HOST="auth.${NAKED_HOST}"
else
  AUTH_HOST="auth.${DOMAIN}"
fi
OIDC_ISSUER_URL="${SCHEME}://${AUTH_HOST}"
OIDC_AUDIENCE="alfheim"

# Zitadel mints tokens for whatever EXTERNALDOMAIN it is told, so it has to be
# the issuer host itself; a disagreement here breaks every token validation.
ZITADEL_EXTERNALDOMAIN="${AUTH_HOST}"
if [[ "$SCHEME" == "https" ]]; then
  ZITADEL_EXTERNALSECURE="true"
  ZITADEL_EXTERNALPORT="443"
else
  ZITADEL_EXTERNALSECURE="false"
  ZITADEL_EXTERNALPORT="80"
fi

log_info "Derived OIDC Issuer URL: ${BOLD}${OIDC_ISSUER_URL}${RESET}"

# ------------------------------------------------------------------------------
# Image Registry & Repository Derivation
# ------------------------------------------------------------------------------
DEFAULT_REGISTRY="ghcr.io"
DEFAULT_REPO="kroegerleif/alfheim"
DEFAULT_TAG="latest"

IMAGE_REGISTRY="${CUSTOM_REGISTRY:-${IMAGE_REGISTRY:-}}"
IMAGE_REPO="${CUSTOM_REPO:-${IMAGE_REPO:-}}"
IMAGE_TAG="${CUSTOM_TAG:-${IMAGE_TAG:-$DEFAULT_TAG}}"

# Auto-derive registry and repo from Git remote if missing
if [[ -z "$IMAGE_REGISTRY" || -z "$IMAGE_REPO" ]]; then
  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    GIT_REMOTE_URL=$(git remote get-url origin 2>/dev/null || git config --get remote.origin.url 2>/dev/null || echo "")
    if [[ -n "$GIT_REMOTE_URL" ]]; then
      # Strip protocol / prefix
      CLEAN_REMOTE="${GIT_REMOTE_URL#*://}"
      CLEAN_REMOTE="${CLEAN_REMOTE#git@}"
      CLEAN_REMOTE="${CLEAN_REMOTE%.git}"
      CLEAN_REMOTE="${CLEAN_REMOTE/://}"

      # Extract host and repository path
      REMOTE_HOST="${CLEAN_REMOTE%%/*}"
      REMOTE_PATH="${CLEAN_REMOTE#*/}"
      REMOTE_PATH_LOWER=$(echo "$REMOTE_PATH" | tr '[:upper:]' '[:lower:]')

      if [[ -z "$IMAGE_REGISTRY" ]]; then
        case "$REMOTE_HOST" in
          github.com)
            IMAGE_REGISTRY="ghcr.io"
            ;;
          gitlab.com)
            IMAGE_REGISTRY="registry.gitlab.com"
            ;;
          *)
            IMAGE_REGISTRY="$REMOTE_HOST"
            ;;
        esac
      fi

      if [[ -z "$IMAGE_REPO" && -n "$REMOTE_PATH_LOWER" ]]; then
        IMAGE_REPO="$REMOTE_PATH_LOWER"
      fi
    fi
  fi
fi

# Fallbacks if still unset
IMAGE_REGISTRY="${IMAGE_REGISTRY:-$DEFAULT_REGISTRY}"
IMAGE_REPO="${IMAGE_REPO:-$DEFAULT_REPO}"

log_info "Configuring Registry:    ${BOLD}${IMAGE_REGISTRY}${RESET}"
log_info "Configuring Repository:  ${BOLD}${IMAGE_REPO}${RESET}"
log_info "Configuring Image Tag:   ${BOLD}${IMAGE_TAG}${RESET}"
log_info "Generating cryptographically secure secrets..."

# Generate Secrets
ZITADEL_MASTERKEY="$(generate_masterkey)"
ZITADEL_ADMIN_PW="$(generate_zitadel_password)"
POSTGRES_IAM_PW="$(generate_secret 24)"
S3_PW="$(generate_secret 24)"
DASHBOARD_PW="$(generate_secret 24)"
PANTRY_PW="$(generate_secret 24)"
SHOPPING_PW="$(generate_secret 24)"
MAINTENANCE_PW="$(generate_secret 24)"
CHORES_PW="$(generate_secret 24)"
BUDGET_PW="$(generate_secret 24)"
CHAT_PW="$(generate_secret 24)"
CHAT_ENC_KEY="$(generate_base64_32)"
WORKOUT_PW="$(generate_secret 24)"
LIBRARY_PW="$(generate_secret 24)"
GRAFANA_PW="$(generate_secret 24)"
GRAFANA_CLIENT_SECRET="$(generate_secret 32)"

# Build .env from template with variable replacement
sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_IAM_PW}|" \
  -e "s|^IAM_POSTGRES_PASSWORD=.*|IAM_POSTGRES_PASSWORD=${POSTGRES_IAM_PW}|" \
  -e "s|^ZITADEL_MASTERKEY=.*|ZITADEL_MASTERKEY=${ZITADEL_MASTERKEY}|" \
  -e "s|^ZITADEL_ADMIN_USER=.*|ZITADEL_ADMIN_USER=admin|" \
  -e "s|^ZITADEL_ADMIN_PASSWORD=.*|ZITADEL_ADMIN_PASSWORD=${ZITADEL_ADMIN_PW}|" \
  -e "s|^ZITADEL_FIRSTINSTANCE_ORG_HUMAN_USERNAME=.*|ZITADEL_FIRSTINSTANCE_ORG_HUMAN_USERNAME=admin|" \
  -e "s|^ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD=.*|ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD=${ZITADEL_ADMIN_PW}|" \
  -e "s|^ZITADEL_DB_PASSWORD=.*|ZITADEL_DB_PASSWORD=${POSTGRES_IAM_PW}|" \
  -e "s|^ZITADEL_EXTERNALDOMAIN=.*|ZITADEL_EXTERNALDOMAIN=${ZITADEL_EXTERNALDOMAIN}|" \
  -e "s|^ZITADEL_EXTERNALPORT=.*|ZITADEL_EXTERNALPORT=${ZITADEL_EXTERNALPORT}|" \
  -e "s|^ZITADEL_EXTERNALSECURE=.*|ZITADEL_EXTERNALSECURE=${ZITADEL_EXTERNALSECURE}|" \
  -e "s|^S3_ROOT_PASSWORD=.*|S3_ROOT_PASSWORD=${S3_PW}|" \
  -e "s|^S3_SECRET_KEY=.*|S3_SECRET_KEY=${S3_PW}|" \
  -e "s|^DASHBOARD_POSTGRES_PASSWORD=.*|DASHBOARD_POSTGRES_PASSWORD=${DASHBOARD_PW}|" \
  -e "s|^PANTRY_POSTGRES_PASSWORD=.*|PANTRY_POSTGRES_PASSWORD=${PANTRY_PW}|" \
  -e "s|^SHOPPING_POSTGRES_PASSWORD=.*|SHOPPING_POSTGRES_PASSWORD=${SHOPPING_PW}|" \
  -e "s|^MAINTENANCE_POSTGRES_PASSWORD=.*|MAINTENANCE_POSTGRES_PASSWORD=${MAINTENANCE_PW}|" \
  -e "s|^CHORES_POSTGRES_PASSWORD=.*|CHORES_POSTGRES_PASSWORD=${CHORES_PW}|" \
  -e "s|^BUDGET_POSTGRES_PASSWORD=.*|BUDGET_POSTGRES_PASSWORD=${BUDGET_PW}|" \
  -e "s|^CHAT_POSTGRES_PASSWORD=.*|CHAT_POSTGRES_PASSWORD=${CHAT_PW}|" \
  -e "s|^CHAT_ENCRYPTION_KEY=.*|CHAT_ENCRYPTION_KEY=${CHAT_ENC_KEY}|" \
  -e "s|^WORKOUT_POSTGRES_PASSWORD=.*|WORKOUT_POSTGRES_PASSWORD=${WORKOUT_PW}|" \
  -e "s|^LIBRARY_POSTGRES_PASSWORD=.*|LIBRARY_POSTGRES_PASSWORD=${LIBRARY_PW}|" \
  -e "s|^GRAFANA_ADMIN_PASSWORD=.*|GRAFANA_ADMIN_PASSWORD=${GRAFANA_PW}|" \
  -e "s|^GRAFANA_OIDC_CLIENT_SECRET=.*|GRAFANA_OIDC_CLIENT_SECRET=${GRAFANA_CLIENT_SECRET}|" \
  -e "s|^ALFHEIM_BASE_URL=.*|ALFHEIM_BASE_URL=${BASE_URL}|" \
  -e "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" \
  -e "s|^HOST_HEADER=.*|HOST_HEADER=${HOST_HEADER}|" \
  -e "s|^ALFHEIM_HOST=.*|ALFHEIM_HOST=${HOST_HEADER}|" \
  -e "s|^CADDY_TLS_DIRECTIVE=.*|CADDY_TLS_DIRECTIVE=${CADDY_TLS_DIRECTIVE:-}|" \
  -e "s|^IMAGE_REGISTRY=.*|IMAGE_REGISTRY=${IMAGE_REGISTRY}|" \
  -e "s|^IMAGE_REPO=.*|IMAGE_REPO=${IMAGE_REPO}|" \
  -e "s|^IMAGE_TAG=.*|IMAGE_TAG=${IMAGE_TAG}|" \
  -e "s|^NEXT_PUBLIC_FRONTEND_URL=.*|NEXT_PUBLIC_FRONTEND_URL=\${ALFHEIM_BASE_URL}|" \
  -e "s|^NEXT_PUBLIC_API_GATEWAY_URL=.*|NEXT_PUBLIC_API_GATEWAY_URL=\${ALFHEIM_BASE_URL}/api|" \
  -e "s|^OIDC_ISSUER_URL=.*|OIDC_ISSUER_URL=${OIDC_ISSUER_URL}|" \
  -e "s|^OIDC_AUDIENCE=.*|OIDC_AUDIENCE=${OIDC_AUDIENCE}|" \
  -e "s|^NEXT_PUBLIC_OIDC_ISSUER=.*|NEXT_PUBLIC_OIDC_ISSUER=${OIDC_ISSUER_URL}|" \
  -e "s|^S3_PUBLIC_URL=.*|S3_PUBLIC_URL=\${ALFHEIM_BASE_URL}/storage|" \
  -e "s|^NEXT_PUBLIC_PANTRY_API_URL=.*|NEXT_PUBLIC_PANTRY_API_URL=\${ALFHEIM_BASE_URL}/api/pantry/api/v1|" \
  -e "s|^NEXT_PUBLIC_SHOPPING_API_URL=.*|NEXT_PUBLIC_SHOPPING_API_URL=\${ALFHEIM_BASE_URL}/api/shopping/api/v1|" \
  -e "s|^NEXT_PUBLIC_CHORES_API_URL=.*|NEXT_PUBLIC_CHORES_API_URL=\${ALFHEIM_BASE_URL}/api/api/v1/chores|" \
  -e "s|^NEXT_PUBLIC_MAINTENANCE_API_URL=.*|NEXT_PUBLIC_MAINTENANCE_API_URL=\${ALFHEIM_BASE_URL}/api/maintenance/api/v1|" \
  -e "s|^NEXT_PUBLIC_CHAT_API_URL=.*|NEXT_PUBLIC_CHAT_API_URL=\${ALFHEIM_BASE_URL}/api/api/v1/chat|" \
  -e "s|^NEXT_PUBLIC_DASHBOARD_API_URL=.*|NEXT_PUBLIC_DASHBOARD_API_URL=\${ALFHEIM_BASE_URL}/api/api/v1|" \
  -e "s|^NEXT_PUBLIC_WORKOUT_API_URL=.*|NEXT_PUBLIC_WORKOUT_API_URL=\${ALFHEIM_BASE_URL}/api/workout/api/v1|" \
  -e "s|^NEXT_PUBLIC_LIBRARY_API_URL=.*|NEXT_PUBLIC_LIBRARY_API_URL=\${ALFHEIM_BASE_URL}/api/api/v1/library|" \
  -e "s|^NEXT_PUBLIC_BUDGET_API_URL=.*|NEXT_PUBLIC_BUDGET_API_URL=\${ALFHEIM_BASE_URL}/api/budget/api/v1|" \
  "$TEMPLATE_FILE" > "$OUTPUT_FILE"

# Fallback injection if template was missing base URL keys
if ! grep -q '^ALFHEIM_BASE_URL=' "$OUTPUT_FILE"; then
  printf "\nALFHEIM_BASE_URL=%s\nDOMAIN=%s\nHOST_HEADER=%s\n" "${BASE_URL}" "${DOMAIN}" "${HOST_HEADER}" >> "$OUTPUT_FILE"
fi

if ! grep -q '^IMAGE_REGISTRY=' "$OUTPUT_FILE"; then
  printf "IMAGE_REGISTRY=%s\nIMAGE_REPO=%s\nIMAGE_TAG=%s\n" "${IMAGE_REGISTRY}" "${IMAGE_REPO}" "${IMAGE_TAG}" >> "$OUTPUT_FILE"
fi

# Restrict file permissions to current user only (0600)
chmod 600 "$OUTPUT_FILE"

log_success "Production environment file generated: ${BOLD}${OUTPUT_FILE}${RESET}"
log_success "File permissions set to 0600 (owner read/write only)"

echo -e "\n${BOLD}Generated Credentials & URL Summary (Stored in .env):${RESET}"
echo -e "  Base URL:                  ${CYAN}${BASE_URL}${RESET}"
echo -e "  Host Header:               ${CYAN}${HOST_HEADER}${RESET}"
echo -e "  Domain:                    ${CYAN}${DOMAIN}${RESET}"
echo -e "  OIDC Issuer URL (Zitadel): ${CYAN}${OIDC_ISSUER_URL}${RESET}"
echo -e "  OIDC Audience:             ${CYAN}${OIDC_AUDIENCE}${RESET}"
echo -e "  Zitadel Admin User:        ${CYAN}admin${RESET}"
echo -e "  Zitadel Admin Password:    ${YELLOW}${ZITADEL_ADMIN_PW}${RESET}"
echo -e "  Zitadel Masterkey:         ${DIM}${ZITADEL_MASTERKEY:0:8}...${RESET}"
echo -e "  Grafana Admin User:        ${CYAN}admin${RESET}"
echo -e "  Grafana Admin Password:    ${YELLOW}${GRAFANA_PW}${RESET}"
echo -e "  Chat AES-256 Key:          ${DIM}${CHAT_ENC_KEY:0:8}...${RESET}"
echo ""
