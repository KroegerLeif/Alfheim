#!/usr/bin/env bash
# =============================================================================
# scripts/build.sh — Loeger-OS image builder
#
# Compiles one or more Docker images using BuildKit WITHOUT starting any
# containers.  Use this script to pre-warm the image cache before running
# ./scripts/up.sh (which will then skip image compilation by default).
#
# Usage:
#   ./scripts/build.sh                     # build ALL services that have a
#                                          # Dockerfile-based build context
#   ./scripts/build.sh shopping-frontend   # build a single service
#   ./scripts/build.sh dashboard-frontend shopping-frontend
#                                          # build multiple specific services
#
# Options:
#   --no-cache    Force a clean build (passes --no-cache to docker compose build)
#   --progress    Override BuildKit progress output: auto | plain | tty (default: auto)
#
# Notes:
#   • Images are stored in the local Docker image cache.
#   • Subsequent `up.sh` calls will reuse cached layers automatically.
#   • Run this once after any code change to avoid rebuild latency in `up.sh`.
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
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/compose.yaml"

cd "${REPO_ROOT}"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
NO_CACHE_FLAG=""
PROGRESS="auto"
TARGETS=()

for arg in "$@"; do
  case "$arg" in
    --no-cache)           NO_CACHE_FLAG="--no-cache" ;;
    --progress=*)         PROGRESS="${arg#--progress=}" ;;
    --progress)           shift; PROGRESS="${1:-auto}" ;;
    --*)                  warn "Unknown option: $arg" ;;
    *)                    TARGETS+=("$arg") ;;
  esac
done

# ---------------------------------------------------------------------------
# Services that actually have a build context (image-only services are excluded)
# ---------------------------------------------------------------------------
BUILDABLE_SERVICES=(
  dashboard-backend
  dashboard-frontend
  shopping-backend
  shopping-frontend
  pantry-backend
  pantry-frontend
  maintenance-backend
  maintenance-frontend
)

# If no targets were supplied, build everything buildable
if [[ "${#TARGETS[@]}" -eq 0 ]]; then
  TARGETS=("${BUILDABLE_SERVICES[@]}")
fi

# Validate each requested target is a known buildable service
for t in "${TARGETS[@]}"; do
  found=false
  for b in "${BUILDABLE_SERVICES[@]}"; do
    [[ "$t" == "$b" ]] && found=true && break
  done
  if [[ "$found" == false ]]; then
    warn "Service '${t}' is not a buildable service or does not exist — skipping."
    TARGETS=("${TARGETS[@]/$t}")
  fi
done

# Remove empty entries left by the substitution above
VALID_TARGETS=()
for t in "${TARGETS[@]}"; do
  [[ -n "$t" ]] && VALID_TARGETS+=("$t")
done

if [[ "${#VALID_TARGETS[@]}" -eq 0 ]]; then
  fail "No valid build targets remaining. Aborting."
fi

# ---------------------------------------------------------------------------
# Pre-flight: Docker daemon
# ---------------------------------------------------------------------------
step "Pre-flight"
docker info > /dev/null 2>&1 || fail "Docker daemon is not running. Start Docker Desktop and retry."
ok "Docker daemon is reachable"

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
step "Building images (${#VALID_TARGETS[@]} service(s))"
info "Targets: ${VALID_TARGETS[*]}"
[[ -n "${NO_CACHE_FLAG}" ]] && warn "--no-cache: layer cache will be ignored"

START_TS=$(date +%s)

DOCKER_BUILDKIT=1 docker compose \
  -f "${COMPOSE_FILE}" \
  build \
  ${NO_CACHE_FLAG} \
  --progress="${PROGRESS}" \
  "${VALID_TARGETS[@]}"

END_TS=$(date +%s)
ELAPSED=$(( END_TS - START_TS ))

echo ""
ok "All images built successfully in ${ELAPSED}s"
echo ""
echo -e "  ${DIM}Run ${BOLD}./scripts/up.sh${DIM} to start the stack (images will not be rebuilt).${RESET}"
echo ""
