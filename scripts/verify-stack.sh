#!/usr/bin/env bash
# ==============================================================================
# alfheim: Running Stack Verification
# ==============================================================================
# Checks a *running* Alfheim stack end to end: every Compose service reports
# healthy (or, absent a healthcheck, running), every backend's healthcheck is
# its database-aware /readyz probe, Caddy answers its healthcheck,
# the OIDC discovery document names the configured issuer, the route of every
# running app resolves through the ingress gateway without a 5xx (apps that are
# not running, such as optional apps left out of a Lean Core install, are
# skipped and listed), the /internal/* surface
# is unreachable from the outside, the household API rejects a request
# with no bearer token, the Home Assistant webhook answers 429 above its rate
# limit, and, when Zitadel sends e-mail through Mailpit, a
# password reset for a throwaway user arrives there.
#
# It works unmodified against either compose file this repository ships:
#   - compose.prod.yaml (a production install, run from the install root)
#   - compose.yaml      (the local dev stack scripts/up.sh starts)
# and reads its target URLs from the .env sitting next to whichever compose
# file it finds, so it needs no flags for the common case. In a repository
# checkout, where both files exist, it picks the one whose project is running.
#
# Usage:
#   ./scripts/verify-stack.sh                       # auto-detect compose file & .env
#   ./scripts/verify-stack.sh --dir /srv/alfheim     # verify an install elsewhere
#   ./scripts/verify-stack.sh --compose-file NAME    # force compose.yaml or compose.prod.yaml
#
# Services still in their healthcheck start period are waited for, up to
# VERIFY_STACK_WAIT_SECONDS (default 300), before the health check judges them.
#
# The password-reset e-mail check runs only when ALFHEIM_SMTP_HOST=mailpit or
# VERIFY_STACK_MAILPIT_URL names a Mailpit (default http://127.0.0.1:8025). It
# gets a Zitadel API token from VERIFY_STACK_ZITADEL_TOKEN, `alfheim-setup
# zitadel-token`, or the installer source of a repository checkout.
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
                         when omitted: if both exist, compose.yaml wins
                         when only its project is running, otherwise
                         compose.prod.yaml.
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

# compose_running FILE succeeds when the Compose project of FILE has running
# containers. A file whose interpolation fails (compose.prod.yaml against a dev
# .env) counts as not running.
compose_running() {
  [[ -n "$(docker compose -f "$1" ps -q 2>/dev/null || true)" ]]
}

if [[ -z "${COMPOSE_FILE_NAME}" ]]; then
  # A repository checkout holds both files under different project names
  # (alfheim and alfheim-prod). Preferring compose.prod.yaml blindly would
  # check an empty project there while scripts/up.sh runs the dev stack, so
  # compose.yaml wins when only its project is running. An install root ships
  # compose.prod.yaml alone and is unaffected.
  if [[ -f compose.prod.yaml && -f compose.yaml ]] \
    && compose_running compose.yaml && ! compose_running compose.prod.yaml; then
    COMPOSE_FILE_NAME="compose.yaml"
  elif [[ -f compose.prod.yaml ]]; then
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

# Expanded as ${CURL_TLS[@]+...} below: bash 3.2 (macOS) treats an empty
# array as unbound under `set -u`.
CURL_TLS=()
# The installer's --tls internal strategy signs with a root CA it generates
# into infrastructure/ca. The host's trust store does not hold it, so verify
# against that file; `alfheim-setup update` and `restore` run this script on
# the server itself and would otherwise fail every HTTPS check below.
INTERNAL_CA_FILE="${DIR}/infrastructure/ca/alfheim-root-ca.crt"
if [[ "${VERIFY_STACK_INSECURE:-0}" == "1" ]]; then
  # A caller can still skip certificate verification altogether.
  CURL_TLS=(--insecure)
elif [[ "$(env_value ALFHEIM_TLS_STRATEGY)" == "internal" && -f "${INTERNAL_CA_FILE}" ]]; then
  CURL_TLS=(--cacert "${INTERNAL_CA_FILE}")
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
compose_services() {
  docker compose -f "${COMPOSE_FILE}" ps --format '{{.Service}}\t{{.State}}\t{{.Health}}' 2>/dev/null || true
}
# Right after `alfheim-setup update` or `restore` restarts the stack, services
# are still inside their healthcheck start period (up to 180s for the app
# frontends) and report "starting". Wait for them to settle before judging,
# so a stack that is about to be healthy is not reported as failed.
WAIT_SECONDS="${VERIFY_STACK_WAIT_SECONDS:-300}"
waited=0
services="$(compose_services)"
while grep -q $'\tstarting$' <<< "${services}" && (( waited < WAIT_SECONDS )); do
  if (( waited == 0 )); then
    log_info "Waiting up to ${WAIT_SECONDS}s for services still starting: $(awk -F'\t' '$3 == "starting" {printf "%s ", $1}' <<< "${services}")"
  fi
  sleep 5
  waited=$((waited + 5))
  services="$(compose_services)"
done
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
# 1b. Every running backend's healthcheck is its database-aware readiness probe
#     (/readyz, #788), so "healthy" above means its database answers at the
#     current schema, not just that the process is up.
# ------------------------------------------------------------------------------
log_info "Checking that backend healthchecks probe /readyz..."
while IFS=$'\t' read -r service state _; do
  [[ "${service}" == *-backend && "${state}" == "running" ]] || continue
  container="$(docker compose -f "${COMPOSE_FILE}" ps -q "${service}" 2>/dev/null | head -n 1)"
  probe="$(docker inspect --format '{{json .Config.Healthcheck.Test}}' "${container}" 2>/dev/null || true)"
  if [[ "${probe}" == *"/readyz"* ]]; then
    log_success "${service}: healthcheck probes /readyz"
  else
    fail "${service}: healthcheck does not probe /readyz (${probe:-none})"
  fi
done <<< "${services}"
echo ""

# ------------------------------------------------------------------------------
# 2. Caddy's own healthcheck.
# ------------------------------------------------------------------------------
log_info "Checking Caddy /livez..."
livez="$(curl -fsSL ${CURL_TLS[@]+"${CURL_TLS[@]}"} "${BASE_URL}/livez" 2>/dev/null || echo "FAILED")"
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
discovery="$(curl -fsSL ${CURL_TLS[@]+"${CURL_TLS[@]}"} "${ISSUER_URL}/.well-known/openid-configuration" 2>/dev/null || echo "")"
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
# Core routes are always checked. An optional route is checked only when the
# container serving it runs: optional apps and telemetry are compose profiles
# (docs/en/explanation/decisions/0007-lean-core-app-set.md) and may be off.
ROUTES=("/" "/household")
OPTIONAL_ROUTES=(
  "/pantry:pantry-frontend"
  "/shopping:shopping-frontend"
  "/maintenance:maintenance-frontend"
  "/chores:chores-frontend"
  "/budget:budget-frontend"
  "/workout:workout-frontend"
  "/chat:chat-frontend"
  "/library:library-frontend"
  "/grafana:grafana"
)
SKIPPED=()
for entry in "${OPTIONAL_ROUTES[@]}"; do
  route="${entry%%:*}"
  service="${entry#*:}"
  if grep -q "^${service}"$'\trunning' <<< "${services}"; then
    ROUTES+=("${route}")
  else
    SKIPPED+=("${route}")
  fi
done
if [[ ${#SKIPPED[@]} -gt 0 ]]; then
  log_warn "Skipped routes of apps that are not running: ${SKIPPED[*]}"
fi
for route in "${ROUTES[@]}"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' ${CURL_TLS[@]+"${CURL_TLS[@]}"} "${BASE_URL}${route}" 2>/dev/null || true)"
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
  code="$(curl -s -o /dev/null -w '%{http_code}' ${CURL_TLS[@]+"${CURL_TLS[@]}"} "${BASE_URL}${route}" 2>/dev/null || true)"
  if [[ "${code}" == "404" ]]; then
    log_success "${route} -> 404"
  else
    fail "${route} -> ${code}, want 404"
  fi
done
echo ""

# ------------------------------------------------------------------------------
# 6. The household API rejects a request with no bearer token. GET /me is used
# because /api/v1/households itself only accepts POST, so a GET there is
# answered 405 by the router before authentication runs.
# ------------------------------------------------------------------------------
log_info "Checking the household API requires authentication..."
code="$(curl -s -o /dev/null -w '%{http_code}' ${CURL_TLS[@]+"${CURL_TLS[@]}"} "${BASE_URL}/api/v1/households/me" 2>/dev/null || true)"
if [[ "${code}" == "401" ]]; then
  log_success "/api/v1/households/me -> 401 without a token"
else
  fail "/api/v1/households/me -> ${code}, want 401"
fi
echo ""

# ------------------------------------------------------------------------------
# 6b. The unauthenticated Home Assistant webhook is rate limited (#960): more
# unsigned posts than ALFHEIM_RATE_LIMIT_WEBHOOK per minute get 429 from Caddy.
# Unsigned posts never reach an action; the backend answers them 404.
# ------------------------------------------------------------------------------
log_info "Checking the Home Assistant webhook rate limit..."
webhook_limit="$(env_value ALFHEIM_RATE_LIMIT_WEBHOOK)"
webhook_limit="${webhook_limit:-30}"
throttled="no"
for _ in $(seq 1 $((webhook_limit + 5))); do
  code="$(curl -s -o /dev/null -w '%{http_code}' ${CURL_TLS[@]+"${CURL_TLS[@]}"} -X POST \
    -H 'Content-Type: application/json' -d '{}' \
    "${BASE_URL}/api/v1/integrations/home-assistant/events" 2>/dev/null || true)"
  if [[ "${code}" == "429" ]]; then
    throttled="yes"
    break
  fi
done
if [[ "${throttled}" == "yes" ]]; then
  log_success "webhook -> 429 above ${webhook_limit} requests per minute"
else
  fail "webhook was never rate limited above ${webhook_limit} requests per minute"
fi
echo ""

# ------------------------------------------------------------------------------
# 7. The gateway sets its baseline security headers and hides the server
# banner. /livez is answered by Caddy itself, so this checks the gateway's own
# response headers rather than an upstream's.
# ------------------------------------------------------------------------------
log_info "Checking gateway security headers..."
headers="$(curl -sI ${CURL_TLS[@]+"${CURL_TLS[@]}"} "${BASE_URL}/livez" 2>/dev/null | tr -d '\r' || true)"
for header in "X-Content-Type-Options: nosniff" "Referrer-Policy:" "X-Frame-Options:" "Permissions-Policy:"; do
  if grep -qi "^${header}" <<<"${headers}"; then
    log_success "${header%%:*} is set"
  else
    fail "${header%%:*} is missing from ${BASE_URL}/livez"
  fi
done
# The Content-Security-Policy is enforced (#786), not report-only.
if grep -qi "^Content-Security-Policy: .*default-src 'self'" <<<"${headers}"; then
  log_success "Content-Security-Policy is enforced"
else
  fail "the enforced Content-Security-Policy is missing from ${BASE_URL}/livez"
fi
if grep -qi '^Content-Security-Policy-Report-Only:' <<<"${headers}"; then
  fail "a report-only Content-Security-Policy is still sent on ${BASE_URL}/livez"
fi
if grep -qi '^Server:' <<<"${headers}"; then
  fail "the Server header is exposed on ${BASE_URL}/livez"
else
  log_success "Server header is removed"
fi
# Only the installer-generated Caddyfile (compose.prod.yaml) emits HSTS; the
# dev Caddyfile serves plain HTTP and deliberately leaves it out.
if [[ "${COMPOSE_FILE_NAME}" == "compose.prod.yaml" && "${BASE_URL}" == https://* ]]; then
  if grep -qi '^Strict-Transport-Security:' <<<"${headers}"; then
    log_success "Strict-Transport-Security is set"
  else
    fail "Strict-Transport-Security is missing on an HTTPS gateway"
  fi
fi
echo ""

# ------------------------------------------------------------------------------
# 8. postgres-core stores new TOAST values with lz4 (see compose command).
# ------------------------------------------------------------------------------
log_info "Checking postgres-core TOAST compression..."
toast="$(docker compose -f "${COMPOSE_FILE}" exec -T postgres-core \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SHOW default_toast_compression"' 2>/dev/null | tr -d '[:space:]' || true)"
if [[ "${toast}" == "lz4" ]]; then
  log_success "default_toast_compression is lz4"
else
  fail "default_toast_compression is '${toast:-<unreadable>}', want lz4"
fi
echo ""

# ------------------------------------------------------------------------------
# 9. Zitadel delivers a password-reset e-mail through SMTP into Mailpit.
# Runs only when Zitadel's SMTP server is Mailpit (ALFHEIM_SMTP_HOST=mailpit)
# or VERIFY_STACK_MAILPIT_URL is set, so a production install never sends a
# test e-mail through a real mail server. A throwaway human user with an
# @alfheim.test address is created, sent a reset link, and deleted again
# together with the captured message.
# ------------------------------------------------------------------------------
json_field() {
  # Prints the first string or number value of key $1 in the JSON on stdin.
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\{0,1\}\([^\",}]*\).*/\1/p" | head -n 1
}

# zitadel_token prints a short-lived API token of the provisioning machine
# user: VERIFY_STACK_ZITADEL_TOKEN, else `alfheim-setup zitadel-token` from
# PATH, else the installer source of a repository checkout (dev stack).
zitadel_token() {
  if [[ -n "${VERIFY_STACK_ZITADEL_TOKEN:-}" ]]; then
    printf '%s' "${VERIFY_STACK_ZITADEL_TOKEN}"
  elif command -v alfheim-setup >/dev/null 2>&1; then
    alfheim-setup zitadel-token --env-file "${ENV_FILE}" 2>/dev/null
  elif [[ -f "${DIR}/tools/installer/go.mod" ]] && command -v go >/dev/null 2>&1; then
    (cd "${DIR}/tools/installer" && go run ./cmd/alfheim-setup zitadel-token --env-file "${ENV_FILE}" 2>/dev/null)
  fi
}

SMTP_HOST="$(env_value ALFHEIM_SMTP_HOST)"
MAILPIT_URL="${VERIFY_STACK_MAILPIT_URL:-}"
if [[ -z "${MAILPIT_URL}" && "${SMTP_HOST}" == "mailpit" ]]; then
  MAILPIT_URL="http://127.0.0.1:8025"
fi
log_info "Checking password-reset e-mail delivery..."
if [[ -z "${MAILPIT_URL}" ]]; then
  log_warn "Skipped: Zitadel's SMTP server is ${SMTP_HOST:-not configured}, not Mailpit (set VERIFY_STACK_MAILPIT_URL to force)"
elif ! curl -fsS "${MAILPIT_URL%/}/api/v1/info" >/dev/null 2>&1; then
  fail "Mailpit API is not reachable at ${MAILPIT_URL}"
else
  token="$(zitadel_token || true)"
  if [[ -z "${token}" ]]; then
    fail "could not get a Zitadel API token (alfheim-setup zitadel-token or VERIFY_STACK_ZITADEL_TOKEN)"
  else
    zcurl() {
      curl -sS ${CURL_TLS[@]+"${CURL_TLS[@]}"} -H "Authorization: Bearer ${token}" \
        -H 'Content-Type: application/json' "$@"
    }
    reset_user="verify-stack-$(date +%s)-$RANDOM"
    reset_email="${reset_user}@alfheim.test"
    created="$(zcurl -X POST "${ISSUER_URL%/}/v2/users/human" -d "{
      \"username\": \"${reset_user}\",
      \"profile\": {\"givenName\": \"Verify\", \"familyName\": \"Stack\"},
      \"email\": {\"email\": \"${reset_email}\", \"isVerified\": true}
    }" 2>/dev/null || true)"
    user_id="$(json_field userId <<< "${created}")"
    if [[ -z "${user_id}" ]]; then
      fail "could not create the test user: ${created:-<no response>}"
    else
      reset="$(zcurl -X POST "${ISSUER_URL%/}/v2/users/${user_id}/password_reset" \
        -d '{"sendLink": {"notificationType": "NOTIFICATION_TYPE_Email"}}' 2>/dev/null || true)"
      if ! grep -q '"details"' <<< "${reset}"; then
        fail "Zitadel did not accept the password reset: ${reset:-<no response>}"
      else
        # Zitadel sends notifications asynchronously from its event queue.
        search="${MAILPIT_URL%/}/api/v1/search?query=to:${reset_email}"
        count=0
        for _ in $(seq 1 30); do
          count="$(curl -fsS "${search}" 2>/dev/null | json_field messages_count || true)"
          [[ "${count:-0}" -gt 0 ]] && break
          sleep 2
        done
        if [[ "${count:-0}" -gt 0 ]]; then
          log_success "password-reset e-mail for ${reset_email} arrived in Mailpit"
        else
          fail "no password-reset e-mail for ${reset_email} arrived in Mailpit within 60s"
        fi
        curl -fsS -X DELETE "${search}" >/dev/null 2>&1 || log_warn "could not delete the test e-mail from Mailpit"
      fi
      zcurl -X DELETE "${ISSUER_URL%/}/v2/users/${user_id}" >/dev/null 2>&1 \
        || log_warn "could not delete the test user ${reset_user} (${user_id})"
    fi
  fi
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
