#!/usr/bin/env bash
# ==============================================================================
# alfheim: Production Stack Preflight & Startup Smoke-Test Runner
# ==============================================================================
# Validates compose.prod.yaml configuration, host volume mount parity,
# launches core infrastructure (postgres-core, zitadel, caddy, storage, telemetry),
# polls healthcheck states, asserts DNS resolution, and performs clean teardown.
#
# Usage:
#   ./scripts/test-prod-startup.sh               # Run smoke test and tear down
#   ./scripts/test-prod-startup.sh --keep        # Keep test containers running
#   ./scripts/test-prod-startup.sh --timeout 120 # Custom timeout in seconds
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Terminal Formatting
# ------------------------------------------------------------------------------
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RED="\033[0;31m"
DIM="\033[2m"
RESET="\033[0m"

log_info()    { echo -e "${CYAN}▶${RESET}  $*"; }
log_success() { echo -e "${GREEN}✔${RESET}  $*"; }
log_warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
log_error()   { echo -e "${RED}✖${RESET}  $*" >&2; }
stage_step()  { echo -e "\n${BOLD}${CYAN}━━━ Stage $1: $2 ━━━${RESET}"; }

# ------------------------------------------------------------------------------
# Paths & Flags
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/compose.prod.yaml"

KEEP_CONTAINERS=false
TIMEOUT=180

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep|-k)
      KEEP_CONTAINERS=true
      shift
      ;;
    --timeout|-t)
      TIMEOUT="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --keep, -k       Keep containers running after successful test"
      echo "  --timeout, -t    Maximum wait timeout in seconds (default: 180)"
      echo "  -h, --help       Show this help message"
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

cd "${REPO_ROOT}"

# ------------------------------------------------------------------------------
# Signal & Cleanup Trap
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
    if [[ ! -t 1 ]]; then
      echo ""
    else
      printf "\r\033[K"
    fi
  fi
}

TEST_SERVICES=(caddy zitadel otel-collector victorialogs victoriametrics rustfs mailpit postgres-core)

cleanup() {
  local exit_code=$?
  spin_stop
  if [[ "${KEEP_CONTAINERS}" == "false" ]]; then
    log_info "Tearing down core smoke-test containers..."
    docker compose -f "${COMPOSE_FILE}" down -v >/dev/null 2>&1 || true
    log_success "Cleaned up test containers and networks"
  else
    log_warn "Containers left running (--keep specified)"
  fi
  exit "${exit_code}"
}

trap cleanup EXIT INT TERM

# ------------------------------------------------------------------------------
# Polling Helper
# ------------------------------------------------------------------------------
wait_for_health() {
  local container="$1"
  local label="$2"
  local max_wait="${3:-120}"
  local elapsed=0
  local status=""

  spin_start "Waiting for ${label} to become healthy …"

  while [[ "${elapsed}" -lt "${max_wait}" ]]; do
    status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container}" 2>/dev/null || echo "missing")

    case "${status}" in
      healthy)
        spin_stop
        log_success "${label} is HEALTHY (${elapsed}s)"
        return 0
        ;;
      running)
        # If the container has no healthcheck defined, 'running' is our success condition
        if ! docker inspect --format='{{json .State.Health}}' "${container}" 2>/dev/null | grep -q 'Status'; then
          spin_stop
          log_success "${label} is RUNNING (${elapsed}s)"
          return 0
        fi
        ;;
      unhealthy)
        spin_stop
        log_error "${label} failed healthcheck (UNHEALTHY)!"
        echo -e "${RED}Container logs for ${container}:${RESET}"
        docker logs --tail 40 "${container}" || true
        return 1
        ;;
      exited|dead)
        spin_stop
        log_error "${label} crashed unexpectedly (Status: ${status})!"
        echo -e "${RED}Container logs for ${container}:${RESET}"
        docker logs --tail 40 "${container}" || true
        return 1
        ;;
    esac

    sleep 2
    elapsed=$(( elapsed + 2 ))
  done

  spin_stop
  log_error "Timed out after ${max_wait}s waiting for ${label}."
  docker logs --tail 40 "${container}" || true
  return 1
}

# ==============================================================================
# Execution Stages
# ==============================================================================
echo -e "\n${BOLD}${CYAN}==============================================================================${RESET}"
echo -e "${BOLD}${CYAN}  Alfheim: Production Startup Smoke-Test & Verification Harness${RESET}"
echo -e "${BOLD}${CYAN}==============================================================================${RESET}\n"

# ------------------------------------------------------------------------------
# Stage 1: Static Configuration & Environment Verification
# ------------------------------------------------------------------------------
stage_step "1/4" "Preflight Configuration & Mount Path Verification"

log_info "Ensuring environment file exists and legacy variables are migrated..."
"${REPO_ROOT}/scripts/init-env.sh" --auto

log_info "Validating compose syntax with 'docker compose config'..."
docker compose -f "${COMPOSE_FILE}" config --quiet
log_success "compose.prod.yaml syntax is valid"

log_info "Verifying host-mounted config files exist..."
# Zitadel is configured entirely through environment variables and needs no
# host-mounted realm export or provider directory (unlike the former Keycloak IAM).
REQUIRED_FILES=(
  "infrastructure/caddy/Caddyfile"
  "infrastructure/postgres/init-multiple-dbs.sh"
  "infrastructure/telemetry/collector/config.yaml"
)

for f in "${REQUIRED_FILES[@]}"; do
  full_path="${REPO_ROOT}/${f}"
  if [[ ! -f "$full_path" ]]; then
    log_error "Required config file missing or is directory: ${full_path}"
    exit 1
  fi
  log_success "Verified host mount file: ${f}"
done

# ------------------------------------------------------------------------------
# Stage 2: Staged Core Infrastructure Bring-Up
# ------------------------------------------------------------------------------
stage_step "2/4" "Staged Core Infrastructure Bring-Up"

# Clean up any pre-existing unlabelled networks that could conflict with Compose
ALL_PROD_NETWORKS=(gateway-net infra-net core-net app-chat-net app-pantry-net app-shopping-net app-maintenance-net app-chores-net app-budget-net app-workout-net app-library-net)
for net in "${ALL_PROD_NETWORKS[@]}"; do
  if docker network inspect "$net" >/dev/null 2>&1; then
    label=$(docker network inspect "$net" --format '{{index .Labels "com.docker.compose.network"}}' 2>/dev/null || true)
    if [[ -z "$label" ]]; then
      docker network rm "$net" >/dev/null 2>&1 || true
    fi
  fi
done

log_info "Launching postgres-core, rustfs, and mailpit..."
docker compose -f "${COMPOSE_FILE}" up -d postgres-core rustfs mailpit victoriametrics victorialogs otel-collector

wait_for_health "alfheim_postgres_core" "PostgreSQL Core Database" 60
wait_for_health "alfheim_rustfs" "RustFS Central Storage" 30
wait_for_health "victoriametrics" "VictoriaMetrics" 30
wait_for_health "victorialogs" "VictoriaLogs" 30
wait_for_health "otel-collector" "OpenTelemetry Collector" 30

log_info "Launching Zitadel Identity Provider (bootstraps first instance on cold start)..."
docker compose -f "${COMPOSE_FILE}" up -d zitadel

wait_for_health "alfheim_zitadel" "Zitadel Identity Provider" "${TIMEOUT}"

log_info "Launching Caddy Ingress Gateway..."
docker compose -f "${COMPOSE_FILE}" up -d caddy

wait_for_health "alfheim_caddy" "Caddy Ingress Gateway" 30

# ------------------------------------------------------------------------------
# Stage 3: Inter-Service DNS & Network Verification
# ------------------------------------------------------------------------------
stage_step "3/4" "Inter-Service DNS Resolution & Ingress Validation"

log_info "Verifying Zitadel readiness (confirms DB connectivity to postgres-core)..."
if docker exec alfheim_zitadel /app/zitadel ready; then
  log_success "Zitadel reports READY (connected to postgres-core)"
else
  log_error "Zitadel readiness probe failed"
  docker logs --tail 40 alfheim_zitadel || true
  exit 1
fi

log_info "Testing DNS resolution to 'postgres-core' and legacy alias 'postgres-iam' on infra-net..."
for host in postgres-core postgres-iam; do
  if docker run --rm --network infra-net postgres:16-alpine pg_isready -h "${host}" -p 5432 -t 5 >/dev/null 2>&1; then
    log_success "infra-net -> ${host}:5432 resolved and accepting connections"
  else
    log_error "Failed to resolve or reach ${host}:5432 on infra-net"
    exit 1
  fi
done

log_info "Testing Caddy Ingress Gateway /livez healthcheck endpoint..."
CADDY_LIVEZ=$(curl -fsSL http://127.0.0.1:80/livez || echo "FAILED")
if [[ "$CADDY_LIVEZ" == "OK" ]]; then
  log_success "Caddy /livez responded with HTTP 200 (Body: ${CADDY_LIVEZ})"
else
  log_error "Caddy /livez failed or returned: ${CADDY_LIVEZ}"
  exit 1
fi

log_info "Probing Zitadel readiness endpoint via internal service DNS (http://zitadel:8080/debug/ready)..."
if docker exec alfheim_caddy wget -q -T 5 -O /dev/null http://zitadel:8080/debug/ready; then
  log_success "Zitadel /debug/ready responded with HTTP 200 over the container network"
else
  log_error "Zitadel /debug/ready probe failed (expected HTTP 200 from zitadel:8080)"
  exit 1
fi

# ------------------------------------------------------------------------------
# Stage 4: Summary & Success Report
# ------------------------------------------------------------------------------
stage_step "4/4" "Production Readiness Smoke-Test Complete"

echo -e "\n${BOLD}${GREEN}==============================================================================${RESET}"
echo -e "${BOLD}${GREEN}  ✔ Production Infrastructure Core is 100% HEALTHY & READY${RESET}"
echo -e "${BOLD}${GREEN}==============================================================================${RESET}\n"

log_success "Verified: Volume mounts match canonical repository layout"
log_success "Verified: postgres-core and legacy postgres-iam DNS resolution"
log_success "Verified: otel-collector distroless runtime is stable"
log_success "Verified: Caddy ingress /livez health probe operates independently"
log_success "Verified: Zitadel bootstrapped cleanly and serves its readiness endpoint"
echo ""
