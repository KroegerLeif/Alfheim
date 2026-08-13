#!/usr/bin/env bash
# =============================================================================
# scripts/down.sh — Alfheim stack teardown orchestrator
#
# Stops the full alfheim monorepo stack cleanly.
#
# Usage:
#   ./scripts/down.sh [--volumes|-v]
#
#   --volumes, -v   Remove named volumes declared in the compose files and
#                   clean up external networks (e.g. observability-internal).
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
docker compose -f "${COMPOSE_FILE}" stop chores-frontend maintenance-frontend pantry-frontend shopping-frontend dashboard-frontend chores-backend maintenance-backend pantry-backend shopping-backend dashboard-backend || true

info "Gracefully stopping Keycloak IAM & RustFS Storage …"
docker compose -f "${COMPOSE_FILE}" stop keycloak postgres-iam rustfs || true

info "Gracefully stopping databases …"
docker compose -f "${COMPOSE_FILE}" stop chores-db maintenance-db pantry-db shopping-db dashboard-db || true

info "Tearing down container stack and cleaning resources …"
docker compose -f "${COMPOSE_FILE}" down ${REMOVE_VOLUMES} --remove-orphans

if [[ "${PURGE_NETWORKS}" == "true" ]]; then
  info "Cleaning up external docker networks …"
  for net in gateway-net infra-net core-net app-pantry-net app-shopping-net app-chores-net app-maintenance-net observability-internal; do
    if docker network inspect "$net" >/dev/null 2>&1; then
      docker network rm "$net" 2>/dev/null || true
      ok "Removed external network: $net"
    fi
  done
fi

ok "Alfheim stack teardown complete."
