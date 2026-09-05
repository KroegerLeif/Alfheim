#!/usr/bin/env bash
# ==============================================================================
# alfheim: Home Server Single-Command Installer
# ==============================================================================
# Installs Alfheim Smart Home OS on a home server using prebuilt production
# containers and automated cryptographic secret initialization.
#
# Quickstart:
#   curl -sSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/scripts/install.sh | bash
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Terminal Colors & UI
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
# Banner
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}"
echo "    █████╗ ██╗     ███████╗██╗  ██╗███████╗██╗███╗   ███╗"
echo "   ██╔══██╗██║     ██╔════╝██║  ██║██╔════╝██║████╗ ████║"
echo "   ███████║██║     █████╗  ███████║█████╗  ██║██╔████╔██║"
echo "   ██╔══██║██║     ██╔══╝  ██╔══██║██╔══╝  ██║██║╚██╔╝██║"
echo "   ██║  ██║███████╗██║     ██║  ██║███████╗██║██║ ╚═╝ ██║"
echo "   ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝╚═╝     ╚═╝"
echo -e "${RESET}"
echo -e "   ${BOLD}Alfheim Home Server Installer${RESET} — ${DIM}Production Edition${RESET}\n"

# ------------------------------------------------------------------------------
# 1. Check Prerequisites
# ------------------------------------------------------------------------------
echo -e "${BOLD}Checking System Prerequisites...${RESET}"

if ! command -v curl >/dev/null 2>&1; then
  log_error "cURL is required but not installed. Please install curl and retry."
  exit 1
fi
log_success "cURL detected"

if ! command -v docker >/dev/null 2>&1; then
  log_error "Docker is required but not installed."
  echo -e "   Install Docker from: ${CYAN}https://docs.docker.com/engine/install/${RESET}"
  exit 1
fi
log_success "Docker engine detected"

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not running. Please start the Docker service and retry."
  exit 1
fi
log_success "Docker daemon is active and running"

if ! docker compose version >/dev/null 2>&1; then
  log_error "Docker Compose v2 is required ('docker compose' plugin)."
  exit 1
fi
COMPOSE_VER=$(docker compose version --short 2>/dev/null || docker compose version)
log_success "Docker Compose detected (${COMPOSE_VER})"

# ------------------------------------------------------------------------------
# 2. Setup Installation Directory
# ------------------------------------------------------------------------------
INSTALL_DIR="${ALFHEIM_INSTALL_DIR:-${HOME}/alfheim}"

echo -e "\n${BOLD}Setting up Installation Target...${RESET}"
log_info "Target directory: ${BOLD}${INSTALL_DIR}${RESET}"

mkdir -p "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}/keycloak/providers"
mkdir -p "${INSTALL_DIR}/infrastructure/telemetry/collector"

# ------------------------------------------------------------------------------
# 3. Download Production Assets
# ------------------------------------------------------------------------------
REPO_RAW_BASE="${ALFHEIM_RAW_BASE:-https://raw.githubusercontent.com/KroegerLeif/Alfheim/main}"
REPO_FALLBACK_BASE="https://raw.githubusercontent.com/KroegerLeif/loeger-os/main"

# Local script directory check for dev testing
LOCAL_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
LOCAL_REPO_ROOT=""
if [[ -n "$LOCAL_SCRIPT_DIR" && -d "${LOCAL_SCRIPT_DIR}/.." ]]; then
  LOCAL_REPO_ROOT="$(cd "${LOCAL_SCRIPT_DIR}/.." && pwd)"
fi

fetch_asset() {
  local remote_path="$1"
  local target_path="$2"

  if [[ -n "$LOCAL_REPO_ROOT" && -f "${LOCAL_REPO_ROOT}/${remote_path}" ]]; then
    cp "${LOCAL_REPO_ROOT}/${remote_path}" "${target_path}"
    log_success "Loaded ${remote_path} (local workspace)"
    return 0
  fi

  if curl -fsSL "${REPO_RAW_BASE}/${remote_path}" -o "${target_path}" 2>/dev/null; then
    log_success "Downloaded ${remote_path}"
    return 0
  fi

  if curl -fsSL "${REPO_FALLBACK_BASE}/${remote_path}" -o "${target_path}" 2>/dev/null; then
    log_success "Downloaded ${remote_path} (via mirror)"
    return 0
  fi

  log_error "Failed to fetch ${remote_path} from remote repository."
  return 1
}

echo -e "\n${BOLD}Fetching Production Artifacts...${RESET}"
fetch_asset "compose.prod.yaml" "${INSTALL_DIR}/compose.prod.yaml"
fetch_asset ".env.example" "${INSTALL_DIR}/.env.example"
fetch_asset "scripts/init-env.sh" "${INSTALL_DIR}/init-env.sh"
fetch_asset "infrastructure/caddy/Caddyfile" "${INSTALL_DIR}/Caddyfile"
fetch_asset "infrastructure/keycloak/alfheim-realm.json" "${INSTALL_DIR}/keycloak/alfheim-realm.json"
fetch_asset "infrastructure/telemetry/collector/config.yaml" "${INSTALL_DIR}/infrastructure/telemetry/collector/config.yaml"

chmod +x "${INSTALL_DIR}/init-env.sh"

# ------------------------------------------------------------------------------
# 4. Generate Production Environment & Secrets
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}Initializing Environment & Secrets...${RESET}"
cd "${INSTALL_DIR}"
ALFHEIM_INSTALL_DIR="${INSTALL_DIR}" "${INSTALL_DIR}/init-env.sh" ${INSTALL_ENV_FLAGS:---auto}

# ------------------------------------------------------------------------------
# 5. Success Feedback & Next Steps
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${GREEN}==============================================================================${RESET}"
echo -e "${BOLD}${GREEN}  ✔ Alfheim installation prepared successfully!${RESET}"
echo -e "${BOLD}${GREEN}==============================================================================${RESET}\n"

echo -e "${BOLD}Installed Files in ${INSTALL_DIR}:${RESET}"
echo -e "  ├── ${CYAN}compose.prod.yaml${RESET}                     # Multi-service production compose"
echo -e "  ├── ${CYAN}.env${RESET}                                  # Production secrets (chmod 600)"
echo -e "  ├── ${CYAN}Caddyfile${RESET}                             # Central ingress reverse-proxy configuration"
echo -e "  ├── ${CYAN}init-env.sh${RESET}                           # Secret generator utility"
echo -e "  ├── ${CYAN}keycloak/alfheim-realm.json${RESET}           # OIDC realm definition"
echo -e "  └── ${CYAN}infrastructure/telemetry/collector/config.yaml${RESET}"
echo ""
echo -e "${BOLD}Next Steps to Launch Alfheim:${RESET}"
echo -e "  1. Switch to the installation directory:"
echo -e "     ${CYAN}cd ${INSTALL_DIR}${RESET}"
echo ""
echo -e "  2. (Optional) Review or adjust environment settings:"
echo -e "     ${CYAN}nano .env${RESET}"
echo ""
echo -e "  3. Start all platform services:"
echo -e "     ${CYAN}docker compose -f compose.prod.yaml up -d${RESET}"
echo ""
echo -e "  4. Follow container startup logs:"
echo -e "     ${CYAN}docker compose -f compose.prod.yaml logs -f${RESET}"
echo ""
echo -e "  5. Access Alfheim Dashboard:"
echo -e "     ${GREEN}http://localhost${RESET} (or your configured server domain / IP)"
echo ""
