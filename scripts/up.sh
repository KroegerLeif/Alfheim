#!/usr/bin/env bash
# =============================================================================
# scripts/up.sh — Loeger-OS staged stack boot orchestrator
#
# Starts the full loeger-os monorepo stack in a controlled sequential pipeline
# instead of the default brute-force parallel build that takes 250 s+.
#
# Pipeline stages:
#   1. Pre-flight    — validate .env files and Docker network prerequisites
#   2. IAM Core      — postgres-iam  →  keycloak  →  traefik
#   3. Logging       — signoz-clickhouse  →  schema-migrator  →  otel-collector
#                      →  signoz  →  vector
#   4. Backends      — dashboard-backend  pantry-backend
#                      shopping-backend  maintenance-backend
#   5. Frontends     — dashboard-frontend  pantry-frontend
#                      shopping-frontend  maintenance-frontend
#   6. Summary       — print accessible URLs with green checkmarks
#
# Usage:
#   ./scripts/up.sh [--no-build] [--skip-logging]
#
#   --no-build      Skip image rebuilds (use cached images). Useful for restarts.
#   --skip-logging  Skip the SigNoz / Vector logging stack.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
info() { echo -e "${CYAN}▶${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "${RED}✖${RESET}  $*" >&2; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${RESET}"; }

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
BUILD_FLAG="--build"
SKIP_LOGGING=false

for arg in "$@"; do
  case "$arg" in
    --no-build)     BUILD_FLAG="" ;;
    --skip-logging) SKIP_LOGGING=true ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

# ---------------------------------------------------------------------------
# Paths — resolve script location so the script works from any CWD
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/compose.yaml"

cd "${REPO_ROOT}"

# ---------------------------------------------------------------------------
# Spinner — overwrites the current line in a loop until the caller exits
# Usage: spin_start "label"; ... ; spin_stop
# ---------------------------------------------------------------------------
_SPINNER_PID=""

spin_start() {
  local label="$1"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  (
    local i=0
    while true; do
      printf "\r  ${CYAN}%s${RESET}  %s " "${frames[$((i % ${#frames[@]}))]]}" "$label"
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
    printf "\r\033[K"   # clear spinner line
  fi
}

# ---------------------------------------------------------------------------
# Health-wait loop
# Waits until `docker inspect` reports "healthy" for the given container name.
# Arguments:
#   $1 — container name
#   $2 — human-readable label for the spinner
#   $3 — timeout in seconds (default: 120)
# ---------------------------------------------------------------------------
wait_healthy() {
  local container="$1"
  local label="$2"
  local timeout="${3:-120}"
  local elapsed=0
  local status=""

  spin_start "Waiting for ${label} …"

  while [[ "$elapsed" -lt "$timeout" ]]; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "${container}" 2>/dev/null || echo "missing")

    case "$status" in
      healthy)
        spin_stop
        ok "${label} is healthy"
        return 0
        ;;
      unhealthy)
        spin_stop
        fail "${label} reported unhealthy — check logs: docker logs ${container}"
        ;;
      missing)
        spin_stop
        fail "Container '${container}' not found — is the compose project running?"
        ;;
    esac

    sleep 3
    elapsed=$((elapsed + 3))
  done

  spin_stop
  fail "Timed out after ${timeout}s waiting for ${label} to become healthy."
}

# ---------------------------------------------------------------------------
# Compose helper — run docker compose scoped to the root compose file
# ---------------------------------------------------------------------------
dc() {
  docker compose -f "${COMPOSE_FILE}" "$@"
}

# =============================================================================
# STAGE 0 — Pre-flight checks
# =============================================================================
step "STAGE 0 · Pre-flight"

# Validate Docker daemon is reachable
docker info > /dev/null 2>&1 || fail "Docker daemon is not running. Start Docker Desktop and retry."
ok "Docker daemon is reachable"

# Pre-create only the networks declared `external: true` in every sub-compose file
# (i.e. networks that have no Compose owner and must exist before any `dc up` call).
#
# Network ownership map (verified against all compose files):
#   observability-internal → external: true in ALL stacks (no owner) → must pre-create here
#   public-ingress         → owned by infrastructure/compose.yml    → created in STAGE 1
#   pantry-internal        → owned by apps/pantry/compose.yml       → created by Compose in STAGE 3
#   shopping-internal      → owned by apps/shopping/compose.yml     → created by Compose in STAGE 3
#   dashboard-internal     → owned by apps/dashboard/compose.yml    → created by Compose in STAGE 3
#   maintenance-internal   → owned by apps/maintenance/compose.yml  → created by Compose in STAGE 4
#   iam_network            → owned by infrastructure/compose.yml    → created in STAGE 1
#
# Rationale: pre-creating a Compose-owned network with bare `docker network create` omits
# the required project labels (com.docker.compose.network, com.docker.compose.project).
# Docker Compose detects this on `dc up` and throws a label-mismatch error, crashing STAGE 3.
if ! docker network inspect observability-internal > /dev/null 2>&1; then
  info "Creating external Docker network: observability-internal"
  docker network create observability-internal
fi
ok "Docker networks are ready"


# =============================================================================
# STAGE 1 — IAM Core (postgres-iam → keycloak → traefik)
# =============================================================================
step "STAGE 1 · IAM Core (postgres-iam · keycloak · traefik)"

info "Starting postgres-iam and traefik …"
dc up -d postgres-iam traefik

# postgres-iam must be healthy before Keycloak attempts to connect
wait_healthy "loeger_postgres_iam" "postgres-iam" 60

info "Starting Keycloak (may take up to 90 s on first boot) …"
dc up -d keycloak

# Keycloak performs realm import on first start — allow generous timeout
wait_healthy "loeger_keycloak" "keycloak" 180

ok "IAM Core is ready"

# =============================================================================
# STAGE 2 — Logging / Observability (SigNoz stack)
# =============================================================================
if [[ "${SKIP_LOGGING}" == "true" ]]; then
  warn "Skipping logging stack (--skip-logging flag set)"
else
  step "STAGE 2 · Logging / Observability (SigNoz · Vector)"

  info "Starting ClickHouse …"
  dc up -d signoz-clickhouse

  wait_healthy "signoz-clickhouse" "ClickHouse" 120

  info "Running SigNoz schema migrator …"
  # schema-migrator is a one-shot job; wait for it to exit successfully
  dc up -d signoz-schema-migrator
  spin_start "Waiting for schema-migrator to complete …"

  _migrator_timeout=120
  _migrator_elapsed=0
  while [[ "${_migrator_elapsed}" -lt "${_migrator_timeout}" ]]; do
    _migrator_state=$(docker inspect --format='{{.State.Status}}' "signoz-schema-migrator" 2>/dev/null || echo "missing")
    if [[ "${_migrator_state}" == "exited" ]]; then
      _migrator_exit=$(docker inspect --format='{{.State.ExitCode}}' "signoz-schema-migrator" 2>/dev/null || echo "1")
      spin_stop
      if [[ "${_migrator_exit}" == "0" ]]; then
        ok "SigNoz schema migrator completed"
        break
      else
        fail "SigNoz schema migrator exited with code ${_migrator_exit}"
      fi
    fi
    sleep 3
    _migrator_elapsed=$((_migrator_elapsed + 3))
  done

  info "Starting SigNoz UI, OTEL collector, and Vector shipper …"
  dc up -d signoz-otel-collector signoz vector

  ok "Logging stack is ready"
fi

# =============================================================================
# STAGE 3 — Backend microservices (build + start)
# =============================================================================
step "STAGE 3 · Backend microservices (build + start)"

info "Building and starting backend services …"
dc up ${BUILD_FLAG} -d \
  dashboard-backend \
  pantry-backend \
  shopping-backend \
  maintenance-backend

for svc in \
  "dashboard-backend:dashboard-backend" \
  "pantry-backend:pantry-backend" \
  "shopping-backend:shopping-backend" \
  "maintenance-backend:maintenance-backend"; do
  wait_healthy "${svc%%:*}" "${svc##*:}" 180
done

ok "All backend services are healthy"

# =============================================================================
# STAGE 4 — Frontend microservices (build + start)
# =============================================================================
step "STAGE 4 · Frontend microservices (build + start)"

info "Building and starting frontend services (Next.js builds may take 60–120 s each) …"
dc up ${BUILD_FLAG} -d \
  dashboard-frontend \
  pantry-frontend \
  shopping-frontend \
  maintenance-frontend

for svc in \
  "dashboard-frontend:dashboard-frontend" \
  "pantry-frontend:pantry-frontend" \
  "shopping-frontend:shopping-frontend" \
  "maintenance-frontend:maintenance-frontend"; do
  wait_healthy "${svc%%:*}" "${svc##*:}" 240
done

ok "All frontend services are healthy"

# =============================================================================
# STAGE 5 — Summary
# =============================================================================
step "STAGE 5 · Stack is fully operational"

echo ""
echo -e "  ${BOLD}${GREEN}✔  Loeger-OS is running!${RESET}"
echo ""
echo -e "  ${DIM}Application URLs:${RESET}"
echo -e "  ${GREEN}✔${RESET}  Dashboard    →  ${BOLD}http://loeger-os/${RESET}"
echo -e "  ${GREEN}✔${RESET}  Pantry       →  ${BOLD}http://loeger-os/pantry${RESET}"
echo -e "  ${GREEN}✔${RESET}  Shopping     →  ${BOLD}http://loeger-os/shopping${RESET}"
echo -e "  ${GREEN}✔${RESET}  Maintenance  →  ${BOLD}http://loeger-os/maintenance${RESET}"
echo ""
echo -e "  ${DIM}Infrastructure:${RESET}"
echo -e "  ${GREEN}✔${RESET}  Traefik dashboard  →  ${BOLD}http://localhost:8080${RESET}"
echo -e "  ${GREEN}✔${RESET}  Keycloak           →  ${BOLD}http://loeger-os/auth${RESET}"
echo -e "  ${GREEN}✔${RESET}  SigNoz             →  ${BOLD}http://loeger-os/signoz${RESET}"
echo ""
echo -e "  ${DIM}Run ${BOLD}docker compose logs -f <service>${DIM} to tail any service.${RESET}"
echo -e "  ${DIM}Run ${BOLD}docker compose down${DIM} to stop the full stack.${RESET}"
echo ""
