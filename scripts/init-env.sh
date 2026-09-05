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

# ------------------------------------------------------------------------------
# CLI Arguments Parsing
# ------------------------------------------------------------------------------
AUTO_MODE=false
FORCE=false
CUSTOM_BASE_URL=""
CUSTOM_DOMAIN=""

show_help() {
  cat << USAGE
Usage: $(basename "$0") [OPTIONS]

Options:
  -a, --auto                  Run non-interactively and generate secure defaults
  -b, --base-url <url>        Configure root base URL (default: https://alfheim.loegien.de)
  -d, --domain <domain>       Configure domain / host (backwards compatible)
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

if [[ -f "$OUTPUT_FILE" && "$FORCE" != true ]]; then
  log_warn "Target environment file '$OUTPUT_FILE' already exists."
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
log_info "Generating cryptographically secure secrets..."

# Generate Secrets
KC_ADMIN_PW="$(generate_secret 24)"
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
  -e "s|^KEYCLOAK_ADMIN_PASSWORD=.*|KEYCLOAK_ADMIN_PASSWORD=${KC_ADMIN_PW}|" \
  -e "s|^KC_DB_PASSWORD=.*|KC_DB_PASSWORD=${POSTGRES_IAM_PW}|" \
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
  -e "s|^GRAFANA_KEYCLOAK_CLIENT_SECRET=.*|GRAFANA_KEYCLOAK_CLIENT_SECRET=${GRAFANA_CLIENT_SECRET}|" \
  -e "s|^ALFHEIM_BASE_URL=.*|ALFHEIM_BASE_URL=${BASE_URL}|" \
  -e "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" \
  -e "s|^HOST_HEADER=.*|HOST_HEADER=${HOST_HEADER}|" \
  -e "s|^NEXT_PUBLIC_FRONTEND_URL=.*|NEXT_PUBLIC_FRONTEND_URL=\${ALFHEIM_BASE_URL}|" \
  -e "s|^NEXT_PUBLIC_API_GATEWAY_URL=.*|NEXT_PUBLIC_API_GATEWAY_URL=\${ALFHEIM_BASE_URL}/api|" \
  -e "s|^KEYCLOAK_PUBLIC_URL=.*|KEYCLOAK_PUBLIC_URL=\${ALFHEIM_BASE_URL}/auth|" \
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

# Restrict file permissions to current user only (0600)
chmod 600 "$OUTPUT_FILE"

log_success "Production environment file generated: ${BOLD}${OUTPUT_FILE}${RESET}"
log_success "File permissions set to 0600 (owner read/write only)"

echo -e "\n${BOLD}Generated Credentials & URL Summary (Stored in .env):${RESET}"
echo -e "  Base URL:                  ${CYAN}${BASE_URL}${RESET}"
echo -e "  Host Header:               ${CYAN}${HOST_HEADER}${RESET}"
echo -e "  Domain:                    ${CYAN}${DOMAIN}${RESET}"
echo -e "  Keycloak Public Auth URL:  ${CYAN}${BASE_URL}/auth${RESET}"
echo -e "  Keycloak Admin User:       ${CYAN}admin${RESET}"
echo -e "  Keycloak Admin Password:   ${YELLOW}${KC_ADMIN_PW}${RESET}"
echo -e "  Grafana Admin User:        ${CYAN}admin${RESET}"
echo -e "  Grafana Admin Password:    ${YELLOW}${GRAFANA_PW}${RESET}"
echo -e "  Chat AES-256 Key:          ${DIM}${CHAT_ENC_KEY:0:8}...${RESET}"
echo ""
