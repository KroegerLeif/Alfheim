#!/usr/bin/env bash
# ==============================================================================
# alfheim: Production Environment Initialization & Secret Generator
# ==============================================================================
# Generates a secure, production-grade .env file from .env.example with
# cryptographically strong random passwords, encryption keys, and domain config.
#
# Usage:
#   ./scripts/init-env.sh                 # Interactive mode
#   ./scripts/init-env.sh --auto          # Non-interactive automatic generation
#   ./scripts/init-env.sh --domain my.os  # Set target domain non-interactively
#   ./scripts/init-env.sh -f / --force    # Overwrite existing .env
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

# If running inside repo, fallback to script directory parent
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
CUSTOM_DOMAIN=""

show_help() {
  cat << USAGE
Usage: $(basename "$0") [OPTIONS]

Options:
  -a, --auto            Run non-interactively and generate secure defaults
  -d, --domain <domain> Configure the base domain (default: localhost)
  -f, --force           Overwrite existing .env file
  -h, --help            Show this help message
USAGE
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--auto)
      AUTO_MODE=true
      shift
      ;;
    -d|--domain)
      CUSTOM_DOMAIN="$2"
      shift 2
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
# Domain Configuration
# ------------------------------------------------------------------------------
DOMAIN="localhost"
if [[ -n "$CUSTOM_DOMAIN" ]]; then
  DOMAIN="$CUSTOM_DOMAIN"
elif [[ "$AUTO_MODE" == false ]]; then
  read -r -p "Enter server domain or IP [default: localhost]: " user_domain
  if [[ -n "$user_domain" ]]; then
    DOMAIN="$user_domain"
  fi
fi

FRONTEND_URL="http://${DOMAIN}"
API_URL="http://${DOMAIN}"
KEYCLOAK_URL="http://${DOMAIN}/auth"

log_info "Configuring domain: ${BOLD}${DOMAIN}${RESET}"
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
  -e "s|^NEXT_PUBLIC_FRONTEND_URL=.*|NEXT_PUBLIC_FRONTEND_URL=${FRONTEND_URL}|" \
  -e "s|^NEXT_PUBLIC_API_GATEWAY_URL=.*|NEXT_PUBLIC_API_GATEWAY_URL=${API_URL}|" \
  -e "s|^KEYCLOAK_PUBLIC_URL=.*|KEYCLOAK_PUBLIC_URL=${KEYCLOAK_URL}|" \
  "$TEMPLATE_FILE" > "$OUTPUT_FILE"

# Restrict file permissions to current user only (0600)
chmod 600 "$OUTPUT_FILE"

log_success "Production environment file generated: ${BOLD}${OUTPUT_FILE}${RESET}"
log_success "File permissions set to 0600 (owner read/write only)"

echo -e "\n${BOLD}Generated Credentials Summary (Stored in .env):${RESET}"
echo -e "  Keycloak Admin User:       ${CYAN}admin${RESET}"
echo -e "  Keycloak Admin Password:   ${YELLOW}${KC_ADMIN_PW}${RESET}"
echo -e "  Grafana Admin User:        ${CYAN}admin${RESET}"
echo -e "  Grafana Admin Password:    ${YELLOW}${GRAFANA_PW}${RESET}"
echo -e "  Chat AES-256 Key:          ${DIM}${CHAT_ENC_KEY:0:8}...${RESET}"
echo ""
