#!/usr/bin/env bash
# =============================================================================
# scripts/up.sh — Loeger-OS staged stack boot orchestrator
#
# Starts the full loeger-os monorepo stack in a controlled, strictly sequential
# pipeline instead of a brute-force parallel bring-up that saturates the CPU.
#
# Pipeline stages:
#   0. Pre-flight    — validate .env files and Docker network prerequisites
#   1. IAM Core      — postgres-iam  →  keycloak  →  traefik
#   2. Dashboard     — dashboard-db  →  dashboard-backend  →  dashboard-frontend
#                      [accessible at http://loeger-os/ after this stage]
#   3. Applications  — (shopping-db + pantry-db + maintenance-db)
#                      → (shopping-backend + pantry-backend + maintenance-backend)
#                      → (shopping-frontend + pantry-frontend + maintenance-frontend)
#   4. Observability — signoz-clickhouse  →  schema-migrator
#                      →  signoz-otel-collector  →  signoz  →  vector
#   5. Summary       — print accessible URLs with green checkmarks
#
# Usage:
#   ./scripts/up.sh              # start stack (use cached images — no build)
#   ./scripts/up.sh -b           # start stack AND rebuild images first
#   ./scripts/up.sh --build      # same as -b
#   ./scripts/up.sh --skip-obs   # skip the SigNoz/Vector observability stack
#
# Tip: run ./scripts/build.sh first to pre-compile images, then use up.sh
#      without -b for a fast restart.
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
hr()   { echo -e "${DIM}──────────────────────────────────────────────────${RESET}"; }

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
BUILD=false       # by default, do NOT rebuild images
SKIP_OBS=false    # by default, start the observability stack

for arg in "$@"; do
  case "$arg" in
    -b|--build)     BUILD=true ;;
    --skip-obs)     SKIP_OBS=true ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

BUILD_FLAG=""
[[ "${BUILD}" == "true" ]] && BUILD_FLAG="--build"

# ---------------------------------------------------------------------------
# Paths — resolve relative to script location so the script works from any CWD
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/compose.yaml"

cd "${REPO_ROOT}"

# ---------------------------------------------------------------------------
# Spinner — overwrites the current line until the caller calls spin_stop
# ---------------------------------------------------------------------------
_SPINNER_PID=""

spin_start() {
  local label="$1"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  (
    local i=0
    while true; do
      printf "\r  ${CYAN}%s${RESET}  %s " "${frames[$((i % ${#frames[@]}))]}" "$label"
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
    printf "\r\033[K"  # clear spinner line
  fi
}

# ---------------------------------------------------------------------------
# wait_healthy — blocks until a container reports "healthy" via docker inspect
#
# Arguments:
#   $1 — container name (as declared in compose, or container_name override)
#   $2 — human-readable label for progress output
#   $3 — timeout in seconds (default: 120)
# ---------------------------------------------------------------------------
wait_healthy() {
  local container="$1"
  local label="$2"
  local timeout="${3:-120}"
  local elapsed=0
  local status=""

  spin_start "Waiting for ${label} …"

  while [[ "${elapsed}" -lt "${timeout}" ]]; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "${container}" 2>/dev/null || echo "missing")

    case "${status}" in
      healthy)
        spin_stop
        ok "${label} is healthy"
        return 0
        ;;
      unhealthy)
        spin_stop
        fail "${label} reported UNHEALTHY — check logs: docker logs ${container}"
        ;;
      missing)
        spin_stop
        fail "Container '${container}' not found. Is the compose project running?"
        ;;
    esac

    sleep 3
    elapsed=$(( elapsed + 3 ))
  done

  spin_stop
  fail "Timed out after ${timeout}s waiting for ${label} to become healthy."
}

# ---------------------------------------------------------------------------
# wait_running — blocks until a container's state is "running"
# Used for services without a HEALTHCHECK (e.g. traefik, vector)
#
# Arguments:
#   $1 — container name
#   $2 — human-readable label
#   $3 — timeout in seconds (default: 60)
# ---------------------------------------------------------------------------
wait_running() {
  local container="$1"
  local label="$2"
  local timeout="${3:-60}"
  local elapsed=0
  local state=""

  spin_start "Waiting for ${label} to start …"

  while [[ "${elapsed}" -lt "${timeout}" ]]; do
    state=$(docker inspect --format='{{.State.Status}}' "${container}" 2>/dev/null || echo "missing")

    case "${state}" in
      running)
        spin_stop
        ok "${label} is running"
        return 0
        ;;
      exited|dead)
        spin_stop
        fail "${label} exited unexpectedly — check logs: docker logs ${container}"
        ;;
      missing)
        # Container may not be created yet; keep waiting
        ;;
    esac

    sleep 2
    elapsed=$(( elapsed + 2 ))
  done

  spin_stop
  fail "Timed out after ${timeout}s waiting for ${label} to start."
}

# ---------------------------------------------------------------------------
# wait_one_shot — waits for a container to exit 0 (for migrator-type jobs)
#
# Arguments:
#   $1 — container name
#   $2 — human-readable label
#   $3 — timeout in seconds (default: 120)
# ---------------------------------------------------------------------------
wait_one_shot() {
  local container="$1"
  local label="$2"
  local timeout="${3:-120}"
  local elapsed=0
  local state="" exit_code=""

  spin_start "Waiting for ${label} to complete …"

  while [[ "${elapsed}" -lt "${timeout}" ]]; do
    state=$(docker inspect --format='{{.State.Status}}' "${container}" 2>/dev/null || echo "missing")

    if [[ "${state}" == "exited" ]]; then
      spin_stop
      exit_code=$(docker inspect --format='{{.State.ExitCode}}' "${container}" 2>/dev/null || echo "1")
      if [[ "${exit_code}" == "0" ]]; then
        ok "${label} completed successfully"
        return 0
      else
        fail "${label} exited with code ${exit_code} — check logs: docker logs ${container}"
      fi
    fi

    sleep 3
    elapsed=$(( elapsed + 3 ))
  done

  spin_stop
  fail "Timed out after ${timeout}s waiting for ${label} to complete."
}

# ---------------------------------------------------------------------------
# dc — run docker compose scoped to the root compose file
# ---------------------------------------------------------------------------
dc() {
  docker compose -f "${COMPOSE_FILE}" "$@"
}

# =============================================================================
# Banner
# =============================================================================
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ██╗      ██████╗ ███████╗ ██████╗ ███████╗██████╗        ██████╗ ███████╗"
echo "  ██║     ██╔═══██╗██╔════╝██╔════╝ ██╔════╝██╔══██╗      ██╔═══██╗██╔════╝"
echo "  ██║     ██║   ██║█████╗  ██║  ███╗█████╗  ██████╔╝█████╗██║   ██║███████╗"
echo "  ██║     ██║   ██║██╔══╝  ██║   ██║██╔══╝  ██╔══██╗╚════╝██║   ██║╚════██║"
echo "  ███████╗╚██████╔╝███████╗╚██████╔╝███████╗██║  ██║      ╚██████╔╝███████║"
echo "  ╚══════╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝       ╚═════╝ ╚══════╝"
echo -e "${RESET}"
hr
echo -e "  ${DIM}Staged boot orchestrator — $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
if [[ "${BUILD}" == "true" ]]; then
  echo -e "  ${YELLOW}⚠${RESET}  Build mode: images will be (re)compiled before startup"
else
  echo -e "  ${DIM}Build mode: OFF — using cached images  (pass -b to rebuild)${RESET}"
fi
[[ "${SKIP_OBS}" == "true" ]] && echo -e "  ${YELLOW}⚠${RESET}  Observability stack will be skipped (--skip-obs)"
hr

# =============================================================================
# STAGE 0 — Pre-flight checks
# =============================================================================
step "STAGE 0 · Pre-flight"

docker info > /dev/null 2>&1 || fail "Docker daemon is not running. Start Docker Desktop and retry."
ok "Docker daemon is reachable"

# The observability-internal network is declared external: true across ALL
# sub-compose files, so no Compose project owns it — we must create it manually
# before any 'dc up' call.  All other networks are owned by a Compose file and
# will be created automatically with the correct project labels.
if ! docker network inspect observability-internal > /dev/null 2>&1; then
  info "Creating external Docker network: observability-internal"
  docker network create observability-internal
fi
ok "Docker networks are ready"

# =============================================================================
# STAGE 1 — IAM Core  (postgres-iam → keycloak → traefik)
# =============================================================================
step "STAGE 1 · IAM Core  (postgres-iam · keycloak · traefik)"

info "Starting postgres-iam and traefik …"
dc up ${BUILD_FLAG} -d postgres-iam traefik

# postgres-iam must reach healthy state before Keycloak tries to connect
wait_healthy "loeger_postgres_iam" "postgres-iam" 60
wait_running "loeger_traefik"       "traefik"      30

info "Starting Keycloak (realm import may take up to 90 s on first boot) …"
dc up ${BUILD_FLAG} -d keycloak
wait_healthy "loeger_keycloak" "keycloak" 180

ok "IAM Core is fully operational"

# =============================================================================
# STAGE 2 — Dashboard  (dashboard-db → dashboard-backend → dashboard-frontend)
# =============================================================================
step "STAGE 2 · Dashboard  (database · backend · frontend)"

info "Starting dashboard-db …"
dc up ${BUILD_FLAG} -d dashboard-db
wait_healthy "dashboard-db" "dashboard-db" 60

info "Starting dashboard-backend …"
dc up ${BUILD_FLAG} -d dashboard-backend
wait_healthy "dashboard-backend" "dashboard-backend" 120

info "Starting dashboard-frontend …"
dc up ${BUILD_FLAG} -d dashboard-frontend
wait_healthy "dashboard-frontend" "dashboard-frontend" 240

ok "Dashboard is operational"
echo ""
echo -e "  ${BOLD}${GREEN}  ➜  http://loeger-os/ is now accessible!${RESET}"
echo ""

# =============================================================================
# STAGE 3 — Application stacks
#   3a. Databases      — shopping-db · pantry-db · maintenance-db  (parallel)
#   3b. Backends       — shopping-backend · pantry-backend · maintenance-backend (parallel)
#   3c. Frontends      — shopping-frontend · pantry-frontend · maintenance-frontend (parallel)
# =============================================================================
step "STAGE 3 · Application stacks  (shopping · pantry · maintenance)"

# --- 3a: Databases ---
info "Starting application databases …"
dc up ${BUILD_FLAG} -d shopping-db pantry-db maintenance-db

wait_healthy "shopping-db"     "shopping-db"     60
wait_healthy "pantry-db"       "pantry-db"       60
wait_healthy "maintenance-db"  "maintenance-db"  60

ok "All application databases are healthy"

# --- 3b: Backends ---
info "Starting application backends …"
dc up ${BUILD_FLAG} -d shopping-backend pantry-backend maintenance-backend

wait_healthy "shopping-backend"     "shopping-backend"     180
wait_healthy "pantry-backend"       "pantry-backend"       180
wait_healthy "maintenance-backend"  "maintenance-backend"  180

ok "All application backends are healthy"

# --- 3c: Frontends ---
info "Starting application frontends (Next.js builds may take 60–120 s each) …"
dc up ${BUILD_FLAG} -d shopping-frontend pantry-frontend maintenance-frontend

wait_healthy "shopping-frontend"     "shopping-frontend"     240
wait_healthy "pantry-frontend"       "pantry-frontend"       240
wait_healthy "maintenance-frontend"  "maintenance-frontend"  240

ok "All application frontends are healthy"

# =============================================================================
# STAGE 4 — Observability  (SigNoz · Vector)
# =============================================================================
if [[ "${SKIP_OBS}" == "true" ]]; then
  warn "Skipping observability stack (--skip-obs flag set)"
else
  step "STAGE 4 · Observability  (ClickHouse · SigNoz · Vector)"

  info "Starting ClickHouse …"
  dc up ${BUILD_FLAG} -d signoz-clickhouse
  wait_healthy "signoz-clickhouse" "ClickHouse" 120

  info "Running SigNoz schema migrator (one-shot job) …"
  dc up ${BUILD_FLAG} -d signoz-schema-migrator
  wait_one_shot "signoz-schema-migrator" "schema-migrator" 120

  info "Starting SigNoz UI, OTEL collector, and Vector log shipper …"
  dc up ${BUILD_FLAG} -d signoz-otel-collector signoz vector

  wait_running "signoz-otel-collector" "otel-collector" 30
  wait_running "signoz-ui"             "SigNoz UI"      30
  wait_running "vector-shipper"        "Vector"         30

  ok "Observability stack is operational"
fi

# =============================================================================
# STAGE 5 — Summary
# =============================================================================
step "STAGE 5 · Stack fully operational 🚀"

echo ""
echo -e "  ${BOLD}${GREEN}✔  Loeger-OS is running!${RESET}"
echo ""
echo -e "  ${DIM}Applications:${RESET}"
echo -e "  ${GREEN}✔${RESET}  Dashboard    →  ${BOLD}http://loeger-os/${RESET}"
echo -e "  ${GREEN}✔${RESET}  Shopping     →  ${BOLD}http://loeger-os/shopping${RESET}"
echo -e "  ${GREEN}✔${RESET}  Pantry       →  ${BOLD}http://loeger-os/pantry${RESET}"
echo -e "  ${GREEN}✔${RESET}  Maintenance  →  ${BOLD}http://loeger-os/maintenance${RESET}"
echo ""
echo -e "  ${DIM}Infrastructure:${RESET}"
echo -e "  ${GREEN}✔${RESET}  Keycloak IAM       →  ${BOLD}http://loeger-os/auth${RESET}"
echo -e "  ${GREEN}✔${RESET}  Traefik dashboard  →  ${BOLD}http://localhost:8080${RESET}"
if [[ "${SKIP_OBS}" != "true" ]]; then
  echo -e "  ${GREEN}✔${RESET}  SigNoz             →  ${BOLD}http://loeger-os/signoz${RESET}"
fi
echo ""
echo -e "  ${DIM}Useful commands:${RESET}"
echo -e "  ${DIM}  docker compose logs -f <service>   tail a service${RESET}"
echo -e "  ${DIM}  docker compose ps                  show container health${RESET}"
echo -e "  ${DIM}  ./scripts/down.sh                  stop the full stack${RESET}"
echo -e "  ${DIM}  ./scripts/seed.sh                  populate demo data${RESET}"
echo ""
