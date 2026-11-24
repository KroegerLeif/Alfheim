#!/usr/bin/env bash
# =============================================================================
# scripts/down.sh — Alfheim stack teardown orchestrator
#
# Stops the full alfheim monorepo stack cleanly.
#
# Usage:
#   ./scripts/down.sh [--volumes|-v]
#
#   --volumes, -v   Remove named volumes declared in the compose files, clean
#                   up external networks (e.g. observability-internal) and
#                   delete the postgres-core bind mount infrastructure/postgres/data.
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
# Paths — resolve script location so it works from any CWD
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/compose.yaml"
PG_PARENT_REL="infrastructure/postgres"
PG_DATA_REL="${PG_PARENT_REL}/data"

cd "${REPO_ROOT}"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
REMOVE_VOLUMES=""
PURGE_NETWORKS=false

for arg in "$@"; do
  case "$arg" in
    --volumes|-v)
      REMOVE_VOLUMES="--volumes"
      PURGE_NETWORKS=true
      ;;
    *)
      warn "Unknown argument: $arg"
      ;;
  esac
done

step "Tearing down Alfheim Stack"

info "Gracefully stopping frontends & backends …"
docker compose -f "${COMPOSE_FILE}" stop chat-frontend chores-frontend maintenance-frontend pantry-frontend shopping-frontend dashboard-frontend household-frontend workout-frontend library-frontend budget-frontend chat-backend chores-backend maintenance-backend pantry-backend shopping-backend dashboard-backend household-backend workout-backend library-backend budget-backend || true

info "Gracefully stopping Zitadel IAM & RustFS Storage …"
docker compose -f "${COMPOSE_FILE}" stop zitadel rustfs || true

info "Gracefully stopping postgres-core database …"
docker compose -f "${COMPOSE_FILE}" stop postgres-core || true

info "Tearing down container stack and cleaning resources …"
docker compose -f "${COMPOSE_FILE}" down ${REMOVE_VOLUMES} --remove-orphans

if [[ "${PURGE_NETWORKS}" == "true" ]]; then
  info "Cleaning up external docker networks …"
  for net in gateway-net infra-net core-net app-pantry-net app-shopping-net app-chores-net app-maintenance-net app-budget-net app-chat-net app-workout-net app-library-net observability-internal; do
    if docker network inspect "$net" >/dev/null 2>&1; then
      docker network rm "$net" 2>/dev/null || true
      ok "Removed external network: $net"
    fi
  done
fi

# postgres_image prints the image postgres-core runs, read from the compose
# file that pins it, so the helper container never pulls an unpinned image.
postgres_image() {
  awk '
    /^  postgres-core:[[:space:]]*$/ { in_svc = 1; next }
    in_svc && /^  [^[:space:]]/ { exit }
    in_svc && /^    image:/ { print $2; exit }
  ' "${REPO_ROOT}/infrastructure/compose.yml"
}

# remove_postgres_data deletes the postgres-core bind mount. The files belong
# to the container's postgres user, so a host `rm` may need root; a throwaway
# container of the pinned postgres image removes them instead. Only the exact
# directory inside this repository is ever removed.
remove_postgres_data() {
  local target="${REPO_ROOT}/${PG_DATA_REL}"
  if [[ ! -e "${target}" && ! -L "${target}" ]]; then
    info "No ${PG_DATA_REL} directory to remove."
    return
  fi

  local root_real expected resolved
  root_real="$(cd -P "${REPO_ROOT}" && pwd -P)"
  expected="${root_real}/${PG_DATA_REL}"
  if [[ ! -d "${target}" ]]; then
    fail "Refusing to remove ${target}: it is not a directory."
  fi
  resolved="$(cd -P "${target}" && pwd -P)"
  if [[ "${resolved}" != "${expected}" ]]; then
    fail "Refusing to remove ${target}: it resolves to ${resolved}, not ${expected}."
  fi

  local image
  image="$(postgres_image)"
  if [[ -z "${image}" ]]; then
    fail "Could not read the postgres-core image from infrastructure/compose.yml."
  fi

  info "Removing ${PG_DATA_REL} through a ${image} container …"
  docker run --rm --entrypoint rm \
    -v "${root_real}/${PG_PARENT_REL}:/pg" \
    "${image}" -rf /pg/data
  ok "Removed ${PG_DATA_REL}"
}

if [[ "${PURGE_NETWORKS}" == "true" ]]; then
  # Compose reads ALFHEIM_DB_DATA_PATH from the shell or .env; a custom data
  # location is the operator's to delete, never this script's.
  if [[ -n "${ALFHEIM_DB_DATA_PATH:-}" ]] \
    || { [[ -f "${REPO_ROOT}/.env" ]] && grep -qE '^ALFHEIM_DB_DATA_PATH=.+' "${REPO_ROOT}/.env"; }; then
    warn "ALFHEIM_DB_DATA_PATH is set; data outside ${PG_DATA_REL} is never removed by this script."
  fi
  remove_postgres_data
fi

ok "Alfheim stack teardown complete."
