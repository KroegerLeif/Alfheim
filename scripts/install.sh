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
stage_step()  { echo -e "\n${BOLD}${CYAN}━━━ Stage $1: $2 ━━━${RESET}"; }

# ------------------------------------------------------------------------------
# Progress Spinner & Signal Cleanup
# ------------------------------------------------------------------------------
_SPINNER_PID=""

spin_start() {
  local label="$1"
  local start_time
  start_time=$(date +%s)
  if [[ ! -t 1 ]]; then
    echo -e "  ${CYAN}…${RESET}  ${label}"
    return 0
  fi
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  (
    local i=0
    while true; do
      local now
      now=$(date +%s)
      local elapsed=$(( now - start_time ))
      printf "\r  ${CYAN}%s${RESET}  %s ${DIM}(%ds)${RESET} " "${frames[$((i % ${#frames[@]}))]}" "$label" "${elapsed}"
      i=$((i + 1))
      sleep 0.1
    done
  ) &
  _SPINNER_PID=$!
  disown "${_SPINNER_PID}" 2>/dev/null || true
}

spin_stop() {
  if [[ -n "${_SPINNER_PID}" ]]; then
    kill "${_SPINNER_PID}" 2>/dev/null || true
    wait "${_SPINNER_PID}" 2>/dev/null || true
    _SPINNER_PID=""
    if [[ -t 1 ]]; then
      printf "\r\033[K"  # clear spinner line
    fi
  fi
}

cleanup() {
  spin_stop
}
trap cleanup EXIT INT TERM

# ------------------------------------------------------------------------------
# wait_healthy — blocks until container reports healthy or running
# ------------------------------------------------------------------------------
wait_healthy() {
  local container="$1"
  local label="$2"
  local timeout="${3:-120}"
  local elapsed=0
  local status=""

  spin_start "Waiting for ${label} …"

  while [[ "${elapsed}" -lt "${timeout}" ]]; do
    status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container}" 2>/dev/null || echo "missing")

    case "${status}" in
      healthy)
        spin_stop
        log_success "${label} is healthy (${elapsed}s)"
        return 0
        ;;
      running)
        if ! docker inspect --format='{{json .State.Health}}' "${container}" 2>/dev/null | grep -q 'Status'; then
          spin_stop
          log_success "${label} is running (${elapsed}s)"
          return 0
        fi
        ;;
      unhealthy)
        spin_stop
        log_error "${label} reported UNHEALTHY — inspect logs with: docker logs ${container}"
        return 1
        ;;
      exited|dead)
        spin_stop
        log_error "${label} stopped unexpectedly — inspect logs with: docker logs ${container}"
        return 1
        ;;
      missing)
        ;;
    esac

    sleep 2
    elapsed=$(( elapsed + 2 ))
  done

  spin_stop
  log_error "Timed out after ${timeout}s waiting for ${label} to become healthy."
  return 1
}

# ------------------------------------------------------------------------------
# wait_keycloak_ready — resilient polling loop for Keycloak IAM Core
# ------------------------------------------------------------------------------
wait_keycloak_ready() {
  local container="${1:-alfheim_keycloak}"
  local label="${2:-Keycloak IAM Core}"
  local timeout="${3:-180}"
  local interval=5
  local elapsed=0

  spin_start "Waiting for ${label} to bootstrap …"

  while [[ "${elapsed}" -lt "${timeout}" ]]; do
    # 1. Fail immediately only if container crashed or stopped unexpectedly
    local container_status
    container_status=$(docker inspect --format='{{.State.Status}}' "${container}" 2>/dev/null || echo "missing")
    if [[ "${container_status}" == "exited" || "${container_status}" == "dead" ]]; then
      spin_stop
      log_error "${label} stopped unexpectedly (Status: ${container_status}) — inspect logs with: docker logs ${container}"
      return 1
    fi

    # 2. Check if Docker healthcheck status reports healthy
    local health_status
    health_status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${container}" 2>/dev/null || echo "missing")
    if [[ "${health_status}" == "healthy" ]]; then
      spin_stop
      log_success "${label} is healthy via Docker healthcheck (${elapsed}s)"
      return 0
    fi

    # 3. Direct curl/nc/tcp check against http://127.0.0.1:8080/auth/realms/alfheim inside container
    if docker exec "${container}" curl -s -f -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/auth/realms/alfheim 2>/dev/null | grep -q "^200$" \
       || docker exec "${container}" bash -c "exec 3<>/dev/tcp/127.0.0.1/8080 && echo -e 'GET /auth/realms/alfheim HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3 && cat <&3 | grep -q '200 OK'" 2>/dev/null \
       || docker exec "${container}" sh -c "echo -e 'GET /auth/realms/alfheim HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' | nc -w 2 127.0.0.1 8080 2>/dev/null | grep -q '200 OK'" 2>/dev/null; then
      spin_stop
      log_success "${label} is responding with HTTP 200 (${elapsed}s)"
      return 0
    fi

    if [[ ! -t 1 ]] && (( elapsed > 0 && elapsed % 15 == 0 )); then
      log_info "Still waiting for ${label} (${elapsed}s / ${timeout}s) …"
    fi

    sleep "${interval}"
    elapsed=$(( elapsed + interval ))
  done

  spin_stop
  log_error "Timed out after ${timeout}s waiting for ${label} to become ready."
  return 1
}

# ------------------------------------------------------------------------------
# Argument Parsing
# ------------------------------------------------------------------------------
START_STACK=true
ENV_INIT_FLAGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-start|--skip-start)
      START_STACK=false
      shift
      ;;
    --auto|--interactive)
      ENV_INIT_FLAGS+=("$1")
      shift
      ;;
    --base-url)
      if [[ $# -ge 2 ]]; then
        ENV_INIT_FLAGS+=("$1" "$2")
        shift 2
      else
        ENV_INIT_FLAGS+=("$1")
        shift
      fi
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --skip-start, --no-start   Scaffold configuration and secrets without starting containers"
      echo "  --auto                     Non-interactive environment setup (default)"
      echo "  --interactive              Interactive environment setup"
      echo "  --base-url <url>           Specify base URL (e.g. https://alfheim.example.com)"
      echo "  -h, --help                 Show this help message"
      exit 0
      ;;
    *)
      ENV_INIT_FLAGS+=("$1")
      shift
      ;;
  esac
done

if [[ "${ALFHEIM_SKIP_START:-false}" == "true" ]]; then
  START_STACK=false
fi

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
if [[ ${#ENV_INIT_FLAGS[@]} -eq 0 ]]; then
  ALFHEIM_INSTALL_DIR="${INSTALL_DIR}" "${INSTALL_DIR}/init-env.sh" --auto
else
  ALFHEIM_INSTALL_DIR="${INSTALL_DIR}" "${INSTALL_DIR}/init-env.sh" "${ENV_INIT_FLAGS[@]}"
fi

# ------------------------------------------------------------------------------
# 5. Staged Stack Startup (Resilient Cold-Boot Orchestration)
# ------------------------------------------------------------------------------
if [[ "${START_STACK}" == "true" ]]; then
  echo -e "\n${BOLD}Orchestrating Resilient Staged Boot...${RESET}"

  dc() {
    docker compose -f "${INSTALL_DIR}/compose.prod.yaml" "$@"
  }

  # Stage 1: Database Tier
  stage_step "1/3" "Database & Storage Tier (Cold initdb Resilience)"
  log_info "Launching 10 PostgreSQL databases, MinIO S3, and Mailpit..."
  dc up -d postgres-iam dashboard-db chat-db pantry-db shopping-db maintenance-db chores-db budget-db workout-db library-db rustfs mailpit

  databases=(
    "alfheim_postgres_iam:IAM Postgres (Keycloak)"
    "dashboard-db:Dashboard Database"
    "chat-db:Chat Database"
    "pantry-db:Pantry Database"
    "shopping-db:Shopping Database"
    "maintenance-db:Maintenance Database"
    "chores-db:Chores Database"
    "budget-db:Budget Database"
    "workout-db:Workout Database"
    "library-db:Library Database"
  )

  for db_entry in "${databases[@]}"; do
    container="${db_entry%%:*}"
    label="${db_entry#*:}"
    wait_healthy "${container}" "${label}" 90
  done
  log_success "Database & Storage Tier is fully healthy"

  # Stage 2: IAM Core (Keycloak)
  stage_step "2/3" "Identity & Access Management (Keycloak Bootstrap)"
  log_info "Starting Keycloak IAM (Quarkus cold boot and realm import may take 45-120s)..."
  dc up -d keycloak
  wait_keycloak_ready "alfheim_keycloak" "Keycloak IAM Core" 180
  log_success "Identity Provider (Keycloak) is fully healthy and ready for token issuance"

  # Stage 3: Backends, Frontends, Telemetry & Caddy Ingress Gateway
  stage_step "3/3" "Application Services & Ingress Gateway"
  log_info "Starting microservice backends, frontends, telemetry, and Caddy ingress gateway..."
  dc up -d

  wait_healthy "alfheim_caddy" "Caddy Ingress Gateway" 60
  wait_healthy "dashboard-backend" "Dashboard Control Plane Backend" 180
  wait_healthy "dashboard-frontend" "Dashboard Frontend" 120
  log_success "All application services, backends, and ingress proxy are online"
fi

# ------------------------------------------------------------------------------
# 6. Success Feedback & Next Steps
# ------------------------------------------------------------------------------
APP_URL=$(grep -E '^ALFHEIM_BASE_URL=' "${INSTALL_DIR}/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
APP_URL="${APP_URL:-http://localhost}"

if [[ "${START_STACK}" == "true" ]]; then
  echo -e "\n${BOLD}${GREEN}==============================================================================${RESET}"
  echo -e "${BOLD}${GREEN}  ✔ Alfheim Smart Home OS is live and ready!${RESET}"
  echo -e "${BOLD}${GREEN}==============================================================================${RESET}\n"

  echo -e "${BOLD}Platform Access URLs:${RESET}"
  echo -e "  • ${BOLD}Alfheim Dashboard:${RESET}     ${GREEN}${APP_URL}${RESET}"
  echo -e "  • ${BOLD}Keycloak Admin:${RESET}        ${CYAN}${APP_URL}/auth/admin/${RESET}"
  echo -e "  • ${BOLD}Grafana Telemetry:${RESET}     ${CYAN}${APP_URL}/grafana/${RESET}"
  echo -e "  • ${BOLD}Mailpit UI:${RESET}            ${CYAN}${APP_URL}:8025${RESET}"
  echo ""
  echo -e "${BOLD}Operational Commands:${RESET}"
  echo -e "  • Switch to app directory:   ${CYAN}cd ${INSTALL_DIR}${RESET}"
  echo -e "  • View real-time logs:       ${CYAN}docker compose -f compose.prod.yaml logs -f${RESET}"
  echo -e "  • Check service health:      ${CYAN}docker compose -f compose.prod.yaml ps${RESET}"
  echo -e "  • Stop platform:             ${CYAN}docker compose -f compose.prod.yaml down${RESET}"
  echo -e "  • Restart platform:          ${CYAN}docker compose -f compose.prod.yaml up -d${RESET}"
  echo ""
else
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
  echo -e "  3. Start all platform services (resilient healthcheck orchestration):"
  echo -e "     ${CYAN}docker compose -f compose.prod.yaml up -d${RESET}"
  echo ""
  echo -e "  4. Follow container startup logs:"
  echo -e "     ${CYAN}docker compose -f compose.prod.yaml logs -f${RESET}"
  echo ""
  echo -e "  5. Access Alfheim Dashboard:"
  echo -e "     ${GREEN}${APP_URL}${RESET}"
  echo ""
fi
