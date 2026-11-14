#!/usr/bin/env bash
# =============================================================================
# scripts/up.sh — Alfheim staged stack boot orchestrator
#
# Starts the full alfheim monorepo stack in a controlled, strictly sequential
# pipeline instead of a brute-force parallel bring-up that saturates the CPU.
#
# Pipeline stages:
#   0. Pre-flight    — validate Docker network prerequisites
#   1. IAM Core      — postgres-core  →  zitadel  →  rustfs  →  caddy
#   2. Core apps     — dashboard-backend  →  dashboard-frontend
#                      →  household-backend  →  household-frontend
#                      [live at ${ALFHEIM_BASE_URL}/ and /household after this stage]
#   3+. Apps         — one stage per enabled optional app, in OPTIONAL_APPS
#                      order: <app>-backend  →  <app>-frontend
#                      [live at ${ALFHEIM_BASE_URL}/<app> after its stage]
#   then Observability — victoriametrics  →  victorialogs  →  otel-collector  →  vector-shipper  →  alfheim_grafana
#   then Summary     — print accessible URLs with green checkmarks
#
# Usage:
#   ./scripts/up.sh              # start stack (use cached images — no build)
#   ./scripts/up.sh -b           # start stack AND rebuild images first
#   ./scripts/up.sh --build      # same as -b
#   ./scripts/up.sh --skip-obs   # skip the VictoriaStack observability stack
#   ./scripts/up.sh --lean       # Lean Core only: no optional app, no telemetry
#   ./scripts/up.sh --apps=pantry,shopping,telemetry
#                                # Lean Core plus the listed modules
#
# --lean and --apps set COMPOSE_PROFILES for every compose call and skip the
# stages of the modules that are off (docs/en/explanation/decisions/
# 0007-lean-core-app-set.md). Without them every app and telemetry starts.
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
HOUSEHOLD_STARTED=false
SKIP_OBS=false    # by default, start the observability stack

# Optional apps in boot order, each a compose profile of the same name with
# <app>-backend and <app>-frontend services. The stage list below is derived
# from this one array.
OPTIONAL_APPS=(shopping pantry maintenance chores budget chat workout library)
# Selected modules; "all" keeps the previous behaviour of starting everything.
SELECTED="all"

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo "Options:"
  echo "  -b, --build      Build images before starting"
  echo "  --skip-obs       Skip observability stack"
  echo "  --lean           Start the Lean Core only (no optional app, no telemetry)"
  echo "  --apps=LIST      Start the Lean Core plus LIST, comma-separated, e.g."
  echo "                   pantry,shopping,telemetry (telemetry only when listed)"
  echo "  -h, --help       Show this help message"
}

for arg in "$@"; do
  case "$arg" in
    -b|--build)     BUILD=true ;;
    --skip-obs)     SKIP_OBS=true ;;
    --lean)         SELECTED="" ;;
    --apps=*)       SELECTED="${arg#--apps=}" ;;
    -h|--help)      usage; exit 0 ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

# has_module reports whether a module is in the comma-separated SELECTED list.
has_module() {
  [[ "${SELECTED}" == "all" || ",${SELECTED}," == *",$1,"* ]]
}

ENABLED_APPS=()
if [[ "${SELECTED}" != "all" ]]; then
  IFS=',' read -r -a requested <<< "${SELECTED}"
  for module in ${requested[@]+"${requested[@]}"}; do
    case " ${OPTIONAL_APPS[*]} telemetry " in
      *" ${module} "*) ;;
      *) fail "Unknown module '${module}' in --apps (known: ${OPTIONAL_APPS[*]} telemetry)" ;;
    esac
  done
  if has_module shopping && ! has_module pantry; then
    fail "shopping requires pantry; add pantry to --apps"
  fi
  has_module telemetry || SKIP_OBS=true
fi
for app in "${OPTIONAL_APPS[@]}"; do
  if has_module "${app}"; then
    ENABLED_APPS+=("${app}")
  fi
done
if [[ "${SELECTED}" != "all" ]]; then
  # Every compose call below sees only the selected profiles.
  profiles=""
  for app in ${ENABLED_APPS[@]+"${ENABLED_APPS[@]}"}; do
    profiles="${profiles:+${profiles},}${app}"
  done
  [[ "${SKIP_OBS}" == "true" ]] || profiles="${profiles:+${profiles},}telemetry"
  export COMPOSE_PROFILES="${profiles}"
fi

BUILD_FLAG=""
[[ "${BUILD}" == "true" ]] && BUILD_FLAG="--build"

# ---------------------------------------------------------------------------
# Paths — resolve relative to script location so the script works from any CWD
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=lib/docker-socket-gid.sh
source "${SCRIPT_DIR}/lib/docker-socket-gid.sh"
COMPOSE_FILE="${REPO_ROOT}/compose.yaml"

cd "${REPO_ROOT}"

# ---------------------------------------------------------------------------
# Spinner & Cleanup Trap
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

cleanup() {
  local exit_code=$?
  spin_stop
  if [[ -n "${PAT_DIR:-}" ]]; then rm -rf "${PAT_DIR}"; fi
  if [[ ${exit_code} -ne 0 ]]; then
    echo -e "\n${RED}✖  Boot process encountered an error and aborted (exit code: ${exit_code}).${RESET}" >&2
  fi
}
trap cleanup ERR EXIT INT TERM

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

# Zitadel's bootstrap PAT lives in the zitadel_machinekey named volume
# (infrastructure/compose.yml), which the one-shot zitadel-machinekey-init
# service chowns to the image's uid 1000 before Zitadel starts. No host
# directory is involved, so neither sudo nor a world-writable directory is
# needed — on macOS (Docker Desktop) and Linux alike.
#
# fetch_zitadel_pat writes the PAT to ${PAT_FILE}, a private temp file that
# `alfheim-setup provision` (which only takes a file) reads and the exit trap
# removes. Sources, in order:
#   1. /machinekey/pat.txt in the volume (written on Zitadel's first init;
#      it may land a moment after the healthcheck turns green, hence the retry)
#   2. ZITADEL_BOOTSTRAP_PAT in .env (the volume was removed by `down -v`
#      while Postgres kept Zitadel's data, so the PAT is never written again)
#   3. infrastructure/zitadel/machinekey/pat.txt, the bind-mount location
#      used before the named volume, so an existing dev database keeps working
# Whatever was found is stored back into .env for the next run.
PAT_DIR=""
PAT_FILE=""
fetch_zitadel_pat() {
  PAT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/alfheim-pat.XXXXXX")"
  chmod 700 "${PAT_DIR}"
  PAT_FILE="${PAT_DIR}/pat.txt"
  local pat="" i tries=20

  # Only a cold first init needs to wait for the file to appear.
  grep -qE '^ZITADEL_BOOTSTRAP_PAT=.+' .env && tries=1
  for i in $(seq 1 "${tries}"); do
    if dc cp zitadel:/machinekey/pat.txt "${PAT_FILE}" >/dev/null 2>&1 && [[ -s "${PAT_FILE}" ]]; then
      pat="$(tr -d '[:space:]' < "${PAT_FILE}")"
      break
    fi
    sleep 1
  done

  if [[ -z "${pat}" ]]; then
    pat="$(grep -E '^ZITADEL_BOOTSTRAP_PAT=' .env | tail -n 1 | sed -e 's|^[^=]*=||' | tr -d '[:space:]"' || true)"
  fi
  local legacy="${REPO_ROOT}/infrastructure/zitadel/machinekey/pat.txt"
  if [[ -z "${pat}" && -r "${legacy}" ]]; then
    pat="$(tr -d '[:space:]' < "${legacy}")"
  fi
  [[ -n "${pat}" ]] || return 1

  printf '%s\n' "${pat}" > "${PAT_FILE}"
  chmod 600 "${PAT_FILE}"

  # Persist into .env (kept 0600) so a lost volume does not strand the next run.
  if ! grep -qxF "ZITADEL_BOOTSTRAP_PAT=${pat}" .env; then
    local tmp_env
    tmp_env="$(mktemp "${REPO_ROOT}/.env.XXXXXX")"
    grep -v '^ZITADEL_BOOTSTRAP_PAT=' .env > "${tmp_env}" || true
    printf 'ZITADEL_BOOTSTRAP_PAT=%s\n' "${pat}" >> "${tmp_env}"
    chmod 600 "${tmp_env}"
    mv "${tmp_env}" .env
  fi
}

# ---------------------------------------------------------------------------
# wait_running — blocks until a container's state is "running"
# Used for services without a HEALTHCHECK
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
[[ "${SKIP_OBS}" == "true" ]] && echo -e "  ${YELLOW}⚠${RESET}  Observability stack will be skipped"
if [[ "${SELECTED}" != "all" ]]; then
  echo -e "  ${YELLOW}⚠${RESET}  Optional apps: ${ENABLED_APPS[*]:-none (Lean Core)}  (COMPOSE_PROFILES=${COMPOSE_PROFILES})"
fi
hr

# =============================================================================
# STAGE 0 — Pre-flight checks
# =============================================================================
step "STAGE 0 · Pre-flight"

docker info > /dev/null 2>&1 || fail "Docker daemon is not running. Start Docker Desktop and retry."
ok "Docker daemon is reachable"

# Pre-create all multi-zone external networks if not already present
for net in gateway-net infra-net core-net app-pantry-net app-shopping-net app-chores-net app-maintenance-net app-budget-net app-chat-net app-workout-net app-library-net observability-internal; do
  if ! docker network inspect "$net" > /dev/null 2>&1; then
    info "Creating external Docker network: $net"
    docker network create "$net"
  fi
done
ok "Docker networks are ready"

# =============================================================================
# STAGE 1 — IAM Core, S3 Storage & Ingress Gateway  (postgres-core → zitadel → rustfs → caddy)
# =============================================================================
step "STAGE 1 · IAM Core, S3 Storage & Ingress Gateway  (postgres-core · zitadel · rustfs · caddy)"

if [[ ! -f ".env" ]]; then
  fail "No .env in ${REPO_ROOT}. Generate one first: ./scripts/init-env.sh --auto"
fi

# compose.prod.yaml needs the host docker group id for the socket proxy.
# .env written by an older init-env.sh may not have it yet.
if ! ensure_docker_socket_gid ".env"; then
  fail "DOCKER_SOCKET_GID is missing from .env and the host docker group id could not be detected."
fi

# Browser-facing base URL for the "live at" banners and the summary; follows
# ALFHEIM_BASE_URL in .env so a custom host is printed correctly.
BASE_URL="$(grep -E '^ALFHEIM_BASE_URL=' .env | tail -n 1 | sed -e 's|^[^=]*=||' -e 's|^"||' -e 's|"$||' -e 's|/*$||')"
BASE_URL="${BASE_URL:-http://alfheim.loegien.localhost}"
ISSUER_URL="$(grep -E '^OIDC_ISSUER_URL=' .env | tail -n 1 | sed -e 's|^[^=]*=||' -e 's|^"||' -e 's|"$||' -e 's|/*$||')"
ISSUER_URL="${ISSUER_URL:-http://auth.alfheim.loegien.localhost}"

info "Starting postgres-core …"
dc up ${BUILD_FLAG} -d postgres-core
wait_healthy "alfheim_postgres_core" "postgres-core" 60

# A cold Zitadel runs its first-instance migration here, which is the slowest
# step of the whole boot; the installer allows 300 s for the same wait.
# `up zitadel` first runs the zitadel-machinekey-init one-shot (depends_on).
info "Starting zitadel (first-instance setup may take up to 5 min on a cold database) …"
dc up ${BUILD_FLAG} -d zitadel
wait_healthy "alfheim_zitadel" "zitadel" 300

info "Starting rustfs S3 object storage …"
dc up ${BUILD_FLAG} -d rustfs
wait_healthy "alfheim_rustfs" "rustfs" 60

info "Starting caddy reverse proxy gateway …"
dc up ${BUILD_FLAG} -d caddy
wait_healthy "alfheim_caddy" "caddy" 60

# Zitadel has no admin CLI, so client provisioning goes through its Management
# API, reached through Caddy on 127.0.0.1:80 (Zitadel resolves the instance
# from the Host header, not from how it was dialled) — hence caddy must
# already be up. This shares the exact reconciliation logic
# (internal/features/provisioning) that alfheim-setup uses for a production
# install, via the installer's hidden `provision` subcommand — see
# tools/installer/internal/app/provision_cmd.go.
info "Provisioning Zitadel OIDC clients (dashboard, every app frontend, Grafana) …"
fetch_zitadel_pat || fail "No Zitadel bootstrap PAT: none in the zitadel_machinekey volume and ZITADEL_BOOTSTRAP_PAT in .env is empty. See the clean reset in docs/en/tutorials/local-getting-started.md."
(
  cd "${REPO_ROOT}/tools/installer" && \
  go run ./cmd/alfheim-setup provision \
    --env-file "${REPO_ROOT}/.env" \
    --pat-file "${PAT_FILE}" \
    --zitadel-url "http://127.0.0.1:80"
) || fail "Zitadel OIDC provisioning failed."

# Grafana's browser-facing OAuth endpoints come from OIDC_ISSUER_URL, which has
# to be the host Zitadel issues tokens for or the login redirect 404s.
issuer_host="$(grep -E '^OIDC_ISSUER_URL=' .env | tail -n 1 | sed -e 's|^[^=]*=||' -e 's|^https\{0,1\}://||' -e 's|/.*$||')"
external_domain="$(grep -E '^ZITADEL_EXTERNALDOMAIN=' .env | tail -n 1 | sed -e 's|^[^=]*=||')"
if [[ -n "${issuer_host}" && -n "${external_domain}" && "${issuer_host}" != "${external_domain}" ]]; then
  warn "OIDC_ISSUER_URL points at '${issuer_host}' but Zitadel issues for '${external_domain}'."
  warn "Browser logins will fail until they agree — re-run ./scripts/init-env.sh."
fi

notice "🟢 IAM Core, RustFS Storage & Caddy Ingress Gateway Ready"

# =============================================================================
# STAGE 2 — Dashboard App Slice  (dashboard-backend → dashboard-frontend)
# =============================================================================
step "STAGE 2 · Dashboard & Household Core Slice  (backend · frontend)"

info "Starting dashboard-backend …"
dc up ${BUILD_FLAG} -d dashboard-backend
wait_healthy "dashboard-backend" "dashboard-backend" 120

info "Starting dashboard-frontend …"
dc up ${BUILD_FLAG} -d dashboard-frontend
wait_healthy "dashboard-frontend" "dashboard-frontend" 240

notice "🟢 Dashboard is live at ${BASE_URL}/"

# Household (core/household): households, memberships and the user profile.
# Skipped with a warning until both service sources exist on this checkout.
if [[ -f core/household/backend/Dockerfile && -f core/household/frontend/Dockerfile ]]; then
  info "Starting household-backend (household-db-init creates alfheim_household first) …"
  dc up ${BUILD_FLAG} -d household-backend
  wait_healthy "household-backend" "household-backend" 180

  info "Starting household-frontend …"
  dc up ${BUILD_FLAG} -d household-frontend
  wait_healthy "household-frontend" "household-frontend" 240

  HOUSEHOLD_STARTED=true
  notice "🟢 Household is live at ${BASE_URL}/household/"
else
  warn "Skipping household: core/household/{backend,frontend}/Dockerfile not found on this checkout."
fi

# =============================================================================
# STAGE 3+ — One slice per enabled optional app  (<app>-backend → <app>-frontend)
# =============================================================================
stage=3
for app in ${ENABLED_APPS[@]+"${ENABLED_APPS[@]}"}; do
  step "STAGE ${stage} · ${app} app slice  (backend · frontend)"

  info "Starting ${app}-backend …"
  dc up ${BUILD_FLAG} -d "${app}-backend"
  wait_healthy "${app}-backend" "${app}-backend" 180

  info "Starting ${app}-frontend …"
  dc up ${BUILD_FLAG} -d "${app}-frontend"
  wait_healthy "${app}-frontend" "${app}-frontend" 240

  notice "🟢 ${app} is live at ${BASE_URL}/${app}"
  stage=$((stage + 1))
done
for app in "${OPTIONAL_APPS[@]}"; do
  has_module "${app}" || warn "Skipping ${app} (not selected)"
done

# =============================================================================
# Observability stage  (VictoriaMetrics · VictoriaLogs · OTel · Vector · Grafana)
# =============================================================================
if [[ "${SKIP_OBS}" == "true" ]]; then
  warn "Skipping observability stack (--skip-obs flag set)"
else
  step "STAGE ${stage} · Observability  (VictoriaMetrics · VictoriaLogs · OTel · Vector · Grafana)"
  stage=$((stage + 1))

  info "Starting VictoriaMetrics & VictoriaLogs …"
  dc up ${BUILD_FLAG} -d victoriametrics victorialogs
  wait_healthy "victoriametrics" "VictoriaMetrics" 60
  wait_healthy "victorialogs"     "VictoriaLogs"    60

  info "Starting OTel Collector, Vector log shipper, and Grafana …"
  dc up ${BUILD_FLAG} -d otel-collector vector grafana
  wait_running "otel-collector"  "OTel Collector" 60
  wait_healthy "vector-shipper"   "Vector"         60
  wait_healthy "alfheim_grafana"  "Grafana"        120

  notice "🟢 Observability Stack (VictoriaStack Live)"
fi

# =============================================================================
# Summary stage
# =============================================================================
step "STAGE ${stage} · Stack fully operational 🚀"

echo ""
echo -e "  ${BOLD}${GREEN}✔  Alfheim is running!${RESET}"
echo ""
echo -e "  ${DIM}Applications (Frontend Domain):${RESET}"
echo -e "  ${GREEN}✔${RESET}  Dashboard    →  ${BOLD}${BASE_URL}/${RESET}"
if [[ "${HOUSEHOLD_STARTED}" == "true" ]]; then
  echo -e "  ${GREEN}✔${RESET}  Household    →  ${BOLD}${BASE_URL}/household/${RESET}"
fi
for app in ${ENABLED_APPS[@]+"${ENABLED_APPS[@]}"}; do
  echo -e "  ${GREEN}✔${RESET}  $(printf '%-12s' "${app}") →  ${BOLD}${BASE_URL}/${app}${RESET}"
done
if [[ "${SKIP_OBS}" != "true" ]]; then
  echo -e "  ${GREEN}✔${RESET}  Grafana UI   →  ${BOLD}${BASE_URL}/grafana${RESET}"
fi
echo ""
echo -e "  ${DIM}Infrastructure (API Gateway Domain):${RESET}"
echo -e "  ${GREEN}✔${RESET}  Zitadel IAM        →  ${BOLD}${ISSUER_URL}/${RESET}"
echo -e "  ${GREEN}✔${RESET}  Central API        →  ${BOLD}http://api.alfheim.loegien.localhost/api/v1${RESET}"
echo ""
echo -e "  ${DIM}Useful commands:${RESET}"
echo -e "  ${DIM}  docker compose logs -f <service>   tail a service${RESET}"
echo -e "  ${DIM}  docker compose ps                  show container health${RESET}"
echo -e "  ${DIM}  ./scripts/down.sh                  stop the full stack${RESET}"
echo -e "  ${DIM}  ./scripts/seed.sh                  populate demo data${RESET}"
echo ""
