#!/usr/bin/env bash
# ==============================================================================
# alfheim: Running Stack Verification
# ==============================================================================
# Checks a *running* Alfheim stack end to end: every Compose service reports
# healthy (or, absent a healthcheck, running), Caddy answers its healthcheck,
# the OIDC discovery document names the configured issuer, every app route
# resolves through the ingress gateway without a 5xx, the /internal/* surface
# is unreachable from the outside, and the household API rejects a request
# with no bearer token.
#
# It works unmodified against either compose file this repository ships:
#   - compose.prod.yaml (a production install, run from the install root)
#   - compose.yaml      (the local dev stack scripts/up.sh starts)
# and reads its target URLs from the .env sitting next to whichever compose
# file it finds, so it needs no flags for the common case.
#
# Usage:
#   ./scripts/verify-stack.sh                       # auto-detect compose file & .env
#   ./scripts/verify-stack.sh --dir /srv/alfheim     # verify an install elsewhere
#   ./scripts/verify-stack.sh --compose-file NAME    # force compose.yaml or compose.prod.yaml
#
# Exit codes: 0 every check passed, 1 one or more checks failed, 2 usage error.
# ==============================================================================

set -euo pipefail

BOLD="\033[1m"; GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[0;33m"; CYAN="\033[0;36m"; RESET="\033[0m"
log_info()    { printf "${CYAN}▶${RESET}  %s\n" "$*"; }
log_success() { printf "${GREEN}✔${RESET}  %s\n" "$*"; }
log_warn()    { printf "${YELLOW}▲${RESET}  %s\n" "$*"; }
log_fail()    { printf "${RED}✖${RESET}  %s\n" "$*" >&2; }

# ------------------------------------------------------------------------------
# Arguments
# ------------------------------------------------------------------------------
DIR="$(pwd)"
COMPOSE_FILE_NAME=""

usage() {
  cat <<'EOF'
Usage: verify-stack.sh [--dir DIR] [--compose-file NAME]

  --dir DIR             Directory holding the compose file and .env
                         (default: the current directory).
  --compose-file NAME    compose.prod.yaml or compose.yaml. Auto-detected
                         when omitted: compose.prod.yaml wins if both exist.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --compose-file) COMPOSE_FILE_NAME="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) log_fail "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

cd "${DIR}"

if [[ -z "${COMPOSE_FILE_NAME}" ]]; then
  if [[ -f compose.prod.yaml ]]; then
    COMPOSE_FILE_NAME="compose.prod.yaml"
  elif [[ -f compose.yaml ]]; then
    COMPOSE_FILE_NAME="compose.yaml"
  else
    log_fail "Neither compose.prod.yaml nor compose.yaml was found in ${DIR}."
    exit 2
  fi
fi
COMPOSE_FILE="${DIR}/${COMPOSE_FILE_NAME}"
ENV_FILE="${DIR}/.env"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  log_fail "Compose file not found: ${COMPOSE_FILE}"
  exit 2
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  log_fail ".env not found next to ${COMPOSE_FILE_NAME}: ${ENV_FILE}"
  exit 2
fi

# ------------------------------------------------------------------------------
# Read the base URLs from .env, the same values the installer rendered them
# from (see tools/installer/internal/features/templating/embedded/env.tmpl).
# ------------------------------------------------------------------------------
env_value() {
  local key="$1"
  # Last assignment wins, matching how a shell would source this file; a
  # value may be quoted, which is stripped here the same way envfile.Parse
  # does on the Go side.
  local raw
  raw="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d= -f2-)"
  raw="${raw%\"}"; raw="${raw#\"}"
  raw="${raw%\'}"; raw="${raw#\'}"
  printf '%s' "${raw}"
}

BASE_URL="$(env_value ALFHEIM_BASE_URL)"
ISSUER_URL="$(env_value OIDC_ISSUER_URL)"
if [[ -z "${BASE_URL}" ]]; then
  log_fail "ALFHEIM_BASE_URL is not set in ${ENV_FILE}"
  exit 2
fi
if [[ -z "${ISSUER_URL}" ]]; then
  log_fail "OIDC_ISSUER_URL is not set in ${ENV_FILE}"
  exit 2
fi

CURL_INSECURE=()
if [[ "${VERIFY_STACK_INSECURE:-0}" == "1" ]]; then
  # The installer's --tls internal strategy signs with a locally generated
  # root CA; a caller that has not imported it can set this to skip
  # certificate verification rather than fail every HTTPS check below.
  CURL_INSECURE=(--insecure)
fi

ERRORS=0
fail() { log_fail "$1"; ERRORS=$((ERRORS + 1)); }

echo -e "${BOLD}Verifying the Alfheim stack in ${DIR} (${COMPOSE_FILE_NAME})${RESET}"
echo "  Base URL:   ${BASE_URL}"
echo "  Issuer URL: ${ISSUER_URL}"
echo ""

# ------------------------------------------------------------------------------
# 1. Every Compose service is healthy, or running with no healthcheck.
# ------------------------------------------------------------------------------
log_info "Checking Compose service health..."
services="$(docker compose -f "${COMPOSE_FILE}" ps --format '{{.Service}}\t{{.State}}\t{{.Health}}' 2>/dev/null || true)"
if [[ -z "${services}" ]]; then
  fail "docker compose ps returned no services; is the stack running?"
else
  while IFS=$'\t' read -r service state health; do
    [[ -z "${service}" ]] && continue
    case "${state}" in
      running)
        if [[ -z "${health}" || "${health}" == "healthy" ]]; then
          log_success "${service}: running (${health:-no healthcheck})"
        else
          fail "${service}: running but ${health}"
        fi
        ;;
      *)
        fail "${service}: ${state}"
        ;;
    esac
  done <<< "${services}"
fi
echo ""

# ------------------------------------------------------------------------------
# 2. Caddy's own healthcheck.
# ------------------------------------------------------------------------------
log_info "Checking Caddy /livez..."
livez="$(curl -fsSL "${CURL_INSECURE[@]}" "${BASE_URL}/livez" 2>/dev/null || echo "FAILED")"
if [[ "${livez}" == "OK" ]]; then
  log_success "/livez responded OK"
else
  fail "/livez responded: ${livez}"
fi
echo ""

# ------------------------------------------------------------------------------
# 3. OIDC discovery names the configured issuer.
# ------------------------------------------------------------------------------
log_info "Checking OIDC discovery..."
discovery="$(curl -fsSL "${CURL_INSECURE[@]}" "${ISSUER_URL}/.well-known/openid-configuration" 2>/dev/null || echo "")"
if [[ -z "${discovery}" ]]; then
  fail "could not fetch ${ISSUER_URL}/.well-known/openid-configuration"
else
  discovered_issuer="$(printf '%s' "${discovery}" | sed -n 's/.*"issuer"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  # Zitadel may report the issuer without a trailing slash even when it was
  # requested with one, so compare with both stripped.
  if [[ "${discovered_issuer%/}" == "${ISSUER_URL%/}" ]]; then
    log_success "issuer matches: ${discovered_issuer}"
  else
    fail "issuer mismatch: discovery says ${discovered_issuer:-<empty>}, .env says ${ISSUER_URL}"
  fi
fi
echo ""

# ------------------------------------------------------------------------------
# 4. Every app route resolves through the gateway without a 5xx.
# ------------------------------------------------------------------------------
log_info "Checking app routes..."
ROUTES=(
  "/"
  "/household"
  "/pantry"
  "/shopping"
  "/maintenance"
  "/chores"
  "/budget"
  "/workout"
  "/chat"
  "/library"
  "/grafana"
)
for route in "${ROUTES[@]}"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "${CURL_INSECURE[@]}" "${BASE_URL}${route}" 2>/dev/null || echo "000")"
  if [[ "${code}" =~ ^[0-9]+$ ]] && [[ "${code}" -ge 200 ]] && [[ "${code}" -lt 500 ]]; then
    log_success "${route} -> ${code}"
  else
    fail "${route} -> ${code}"
  fi
done
echo ""

# ------------------------------------------------------------------------------
# 5. /internal/* is not reachable from outside the gateway.
# ------------------------------------------------------------------------------
log_info "Checking /internal/* is blocked at the edge..."
for route in "/internal" "/internal/whatever"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "${CURL_INSECURE[@]}" "${BASE_URL}${route}" 2>/dev/null || echo "000")"
  if [[ "${code}" == "404" ]]; then
    log_success "${route} -> 404"
  else
    fail "${route} -> ${code}, want 404"
  fi
done
echo ""

# ------------------------------------------------------------------------------
# 6. The household API rejects a request with no bearer token.
# ------------------------------------------------------------------------------
log_info "Checking the household API requires authentication..."
code="$(curl -s -o /dev/null -w '%{http_code}' "${CURL_INSECURE[@]}" "${BASE_URL}/api/v1/households" 2>/dev/null || echo "000")"
if [[ "${code}" == "401" ]]; then
  log_success "/api/v1/households -> 401 without a token"
else
  fail "/api/v1/households -> ${code}, want 401"
fi
echo ""

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------
if [[ "${ERRORS}" -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}✔ All checks passed.${RESET}"
  exit 0
else
  echo -e "${BOLD}${RED}✖ ${ERRORS} check(s) failed.${RESET}"
  exit 1
fi
