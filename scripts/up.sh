#!/usr/bin/env bash
# =============================================================================
# scripts/up.sh — Alfheim staged stack boot orchestrator
#
# Starts the full alfheim monorepo stack in a controlled, strictly sequential
# pipeline instead of a brute-force parallel bring-up that saturates the CPU.
#
# Pipeline stages:
#   0. Pre-flight    — validate Docker network prerequisites
#   1. IAM Core      — postgres-iam  →  keycloak  →  traefik
#   2. Dashboard     — dashboard-db  →  dashboard-backend  →  dashboard-frontend
#                      [live at http://alfheim/ after this stage]
#   3. Shopping      — shopping-db  →  shopping-backend  →  shopping-frontend
#                      [live at http://alfheim/shopping after this stage]
#   4. Pantry        — pantry-db  →  pantry-backend  →  pantry-frontend
#                      [live at http://alfheim/pantry after this stage]
#   5. Maintenance   — maintenance-db  →  maintenance-backend  →  maintenance-frontend
#                      [live at http://alfheim/maintenance after this stage]
#   6. Chores        — chores-db  →  chores-backend
#                      [live at http://alfheim/api/v1/chores after this stage]
#   7. Observability — victoriametrics  →  victorialogs  →  otel-collector  →  vector-shipper  →  alfheim_grafana
#   8. Summary       — print accessible URLs with green checkmarks
#
# Usage:
#   ./scripts/up.sh              # start stack (use cached images — no build)
#   ./scripts/up.sh -b           # start stack AND rebuild images first
#   ./scripts/up.sh --build      # same as -b
#   ./scripts/up.sh --skip-obs   # skip the VictoriaStack observability stack
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

ok()     { echo -e "${GREEN}✔${RESET}  $*"; }
info()   { echo -e "${CYAN}▶${RESET}  $*"; }
warn()   { echo -e "${YELLOW}⚠${RESET}  $*"; }
fail()   { echo -e "${RED}✖${RESET}  $*" >&2; exit 1; }
step()   { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${RESET}"; }
hr()     { echo -e "${DIM}──────────────────────────────────────────────────${RESET}"; }
notice() { echo -e "\n  ${BOLD}${GREEN}$*${RESET}\n"; }

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
# wait_healthy_soft — soft version of wait_healthy that logs warnings instead of exiting
# ---------------------------------------------------------------------------
wait_healthy_soft() {
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
        warn "${label} reported UNHEALTHY"
        return 1
        ;;
      missing)
        spin_stop
        warn "Container '${container}' not found."
        return 1
        ;;
    esac

    sleep 3
    elapsed=$(( elapsed + 3 ))
  done

  spin_stop
  warn "Timed out after ${timeout}s waiting for ${label} to become healthy."
  return 1
}

# ---------------------------------------------------------------------------
# wait_running_soft — soft version of wait_running
# ---------------------------------------------------------------------------
wait_running_soft() {
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
        warn "${label} exited unexpectedly"
        return 1
        ;;
      missing)
        # Container may not be created yet; keep waiting
        ;;
    esac

    sleep 2
    elapsed=$(( elapsed + 2 ))
  done

  spin_stop
  warn "Timed out after ${timeout}s waiting for ${label} to start."
  return 1
}

# ---------------------------------------------------------------------------
# wait_one_shot_soft — soft version of wait_one_shot
# ---------------------------------------------------------------------------
wait_one_shot_soft() {
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
        warn "${label} exited with code ${exit_code}"
        return 1
      fi
    fi

    sleep 3
    elapsed=$(( elapsed + 3 ))
  done

  spin_stop
  warn "Timed out after ${timeout}s waiting for ${label} to complete."
  return 1
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

# Pre-create all multi-zone external networks if not already present
for net in gateway-net infra-net core-net app-pantry-net app-shopping-net app-chores-net app-maintenance-net observability-internal; do
  if ! docker network inspect "$net" > /dev/null 2>&1; then
    info "Creating external Docker network: $net"
    docker network create "$net"
  fi
done
ok "Docker networks are ready"

# =============================================================================
# STAGE 1 — IAM Core, S3 Storage & Ingress Gateway  (postgres-iam → keycloak → rustfs → caddy)
# =============================================================================
step "STAGE 1 · IAM Core, S3 Storage & Ingress Gateway  (postgres-iam · keycloak · rustfs · caddy)"

info "Starting postgres-iam …"
dc up ${BUILD_FLAG} -d postgres-iam
wait_healthy "alfheim_postgres_iam" "postgres-iam" 60

info "Starting keycloak (realm import may take up to 90 s on first boot) …"
dc up ${BUILD_FLAG} -d keycloak
wait_healthy "alfheim_keycloak" "keycloak" 180

info "Synchronizing Keycloak clients (ensuring alfheim-grafana client exists) …"
docker exec alfheim_keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080/auth --realm master --user admin --password admin >/dev/null 2>&1 || true

if ! docker exec alfheim_keycloak /opt/keycloak/bin/kcadm.sh get clients -r alfheim -q clientId=alfheim-grafana --fields id 2>/dev/null | grep -q 'id'; then
  docker exec alfheim_keycloak /opt/keycloak/bin/kcadm.sh create clients -r alfheim \
    -s clientId=alfheim-grafana \
    -s name="Grafana Observability" \
    -s rootUrl="http://alfheim.loegien.localhost/grafana" \
    -s baseUrl="/" \
    -s enabled=true \
    -s publicClient=false \
    -s secret=alfheim-grafana-secret \
    -s standardFlowEnabled=true \
    -s directAccessGrantsEnabled=true \
    -s 'redirectUris=["http://alfheim.loegien.localhost/grafana/login/generic_oauth","http://api.alfheim.loegien.localhost/grafana/login/generic_oauth","http://localhost:3000/grafana/login/generic_oauth","http://alfheim.loegien.de/grafana/login/generic_oauth","http://api.alfheim.loegien.de/grafana/login/generic_oauth","http://localhost:3000/*"]' \
    -s 'webOrigins=["*"]' \
    -s 'attributes."post.logout.redirect.uris"="+"' >/dev/null 2>&1 || true
  ok "Keycloak alfheim-grafana client registered"
else
  ok "Keycloak alfheim-grafana client verified"
fi

info "Starting rustfs S3 object storage …"
dc up ${BUILD_FLAG} -d rustfs
wait_healthy "alfheim_rustfs" "rustfs" 60

info "Starting caddy reverse proxy gateway …"
dc up ${BUILD_FLAG} -d caddy
wait_running "alfheim_caddy" "caddy" 30

notice "🟢 IAM Core, RustFS Storage & Caddy Ingress Gateway Ready"

# =============================================================================
# STAGE 2 — Dashboard App Slice  (dashboard-db → dashboard-backend → dashboard-frontend)
# =============================================================================
step "STAGE 2 · Dashboard App Slice  (database · backend · frontend)"

info "Starting dashboard-db …"
dc up ${BUILD_FLAG} -d dashboard-db
wait_healthy "dashboard-db" "dashboard-db" 60

info "Starting dashboard-backend …"
dc up ${BUILD_FLAG} -d dashboard-backend
wait_healthy "dashboard-backend" "dashboard-backend" 120

info "Starting dashboard-frontend …"
dc up ${BUILD_FLAG} -d dashboard-frontend
wait_healthy "dashboard-frontend" "dashboard-frontend" 240

notice "🟢 Dashboard is live at http://alfheim/"

# =============================================================================
# STAGE 3 — Shopping App Slice  (shopping-db → shopping-backend → shopping-frontend)
# =============================================================================
step "STAGE 3 · Shopping App Slice  (database · backend · frontend)"

info "Starting shopping-db …"
dc up ${BUILD_FLAG} -d shopping-db
wait_healthy "shopping-db" "shopping-db" 60

info "Starting shopping-backend …"
dc up ${BUILD_FLAG} -d shopping-backend
wait_healthy "shopping-backend" "shopping-backend" 180

info "Starting shopping-frontend …"
dc up ${BUILD_FLAG} -d shopping-frontend
wait_healthy "shopping-frontend" "shopping-frontend" 240

notice "🟢 Shopping App is live at http://alfheim/shopping"

# =============================================================================
# STAGE 4 — Pantry App Slice  (pantry-db → pantry-backend → pantry-frontend)
# =============================================================================
step "STAGE 4 · Pantry App Slice  (database · backend · frontend)"

info "Starting pantry-db …"
dc up ${BUILD_FLAG} -d pantry-db
wait_healthy "pantry-db" "pantry-db" 60

info "Starting pantry-backend …"
dc up ${BUILD_FLAG} -d pantry-backend
wait_healthy "pantry-backend" "pantry-backend" 180

info "Starting pantry-frontend …"
dc up ${BUILD_FLAG} -d pantry-frontend
wait_healthy "pantry-frontend" "pantry-frontend" 240

notice "🟢 Pantry App is live at http://alfheim/pantry"

# =============================================================================
# STAGE 5 — Maintenance App Slice  (maintenance-db → maintenance-backend → maintenance-frontend)
# =============================================================================
step "STAGE 5 · Maintenance App Slice  (database · backend · frontend)"

info "Starting maintenance-db …"
dc up ${BUILD_FLAG} -d maintenance-db
wait_healthy "maintenance-db" "maintenance-db" 60

info "Starting maintenance-backend …"
dc up ${BUILD_FLAG} -d maintenance-backend
wait_healthy "maintenance-backend" "maintenance-backend" 180

info "Starting maintenance-frontend …"
dc up ${BUILD_FLAG} -d maintenance-frontend
wait_healthy "maintenance-frontend" "maintenance-frontend" 240

notice "🟢 Maintenance App is live at http://alfheim/maintenance"

# =============================================================================
# STAGE 6 — Chores App Slice  (chores-db → chores-backend → chores-frontend)
# =============================================================================
step "STAGE 6 · Chores App Slice  (database · backend · frontend)"

info "Starting chores-db …"
dc up ${BUILD_FLAG} -d chores-db
wait_healthy "chores-db" "chores-db" 60

info "Starting chores-backend …"
dc up ${BUILD_FLAG} -d chores-backend
wait_healthy "chores-backend" "chores-backend" 180

info "Starting chores-frontend …"
dc up ${BUILD_FLAG} -d chores-frontend
wait_healthy "chores-frontend" "chores-frontend" 240

notice "🟢 Chores App is live at http://alfheim.loegien.localhost/chores"

# =============================================================================
# STAGE 7 — Observability  (VictoriaMetrics · VictoriaLogs · OTel · Vector · Grafana)
# =============================================================================
if [[ "${SKIP_OBS}" == "true" ]]; then
  warn "Skipping observability stack (--skip-obs flag set)"
else
  step "STAGE 7 · Observability  (VictoriaMetrics · VictoriaLogs · OTel · Vector · Grafana)"

  info "Starting VictoriaMetrics & VictoriaLogs …"
  if dc up ${BUILD_FLAG} -d victoriametrics victorialogs; then
    wait_healthy_soft "victoriametrics" "VictoriaMetrics" 60
    wait_running_soft "victorialogs"     "VictoriaLogs"    60
  else
    warn "Failed to launch VictoriaMetrics or VictoriaLogs containers"
  fi

  info "Starting OTel Collector, Vector log shipper, and Grafana …"
  if dc up ${BUILD_FLAG} -d otel-collector vector grafana; then
    wait_running_soft "otel-collector"  "OTel Collector" 30 || true
    wait_running_soft "vector-shipper"   "Vector"         30 || true
    wait_running_soft "alfheim_grafana"  "Grafana"        30 || true
  else
    warn "Failed to launch OTel Collector, Vector, or Grafana containers"
  fi

  notice "🟢 Observability Stack (VictoriaStack Live)"
fi

# =============================================================================
# STAGE 8 — Summary
# =============================================================================
step "STAGE 8 · Stack fully operational 🚀"

echo ""
echo -e "  ${BOLD}${GREEN}✔  Alfheim is running!${RESET}"
echo ""
echo -e "  ${DIM}Applications (Frontend Domain):${RESET}"
echo -e "  ${GREEN}✔${RESET}  Dashboard    →  ${BOLD}http://alfheim.loegien.localhost/${RESET}"
echo -e "  ${GREEN}✔${RESET}  Shopping     →  ${BOLD}http://alfheim.loegien.localhost/shopping${RESET}"
echo -e "  ${GREEN}✔${RESET}  Pantry       →  ${BOLD}http://alfheim.loegien.localhost/pantry${RESET}"
echo -e "  ${GREEN}✔${RESET}  Maintenance  →  ${BOLD}http://alfheim.loegien.localhost/maintenance${RESET}"
echo -e "  ${GREEN}✔${RESET}  Chores       →  ${BOLD}http://alfheim.loegien.localhost/chores${RESET}"
if [[ "${SKIP_OBS}" != "true" ]]; then
  echo -e "  ${GREEN}✔${RESET}  Grafana UI   →  ${BOLD}http://alfheim.loegien.localhost/grafana${RESET}"
fi
echo ""
echo -e "  ${DIM}Infrastructure (API Gateway Domain):${RESET}"
echo -e "  ${GREEN}✔${RESET}  Keycloak IAM       →  ${BOLD}http://api.alfheim.loegien.localhost/auth${RESET}"
echo -e "  ${GREEN}✔${RESET}  Central API        →  ${BOLD}http://api.alfheim.loegien.localhost/api/v1${RESET}"
echo ""
echo -e "  ${DIM}Useful commands:${RESET}"
echo -e "  ${DIM}  docker compose logs -f <service>   tail a service${RESET}"
echo -e "  ${DIM}  docker compose ps                  show container health${RESET}"
echo -e "  ${DIM}  ./scripts/down.sh                  stop the full stack${RESET}"
echo -e "  ${DIM}  ./scripts/seed.sh                  populate demo data${RESET}"
echo ""
