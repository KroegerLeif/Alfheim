#!/usr/bin/env bash
# ==============================================================================
# alfheim: Gateway Hardening Test (rate limits and Content-Security-Policy)
# ==============================================================================
# Builds the Caddy image from infrastructure/caddy, starts it alone with the dev
# Caddyfile and checks against it, with no backend running:
#   - the enforced Content-Security-Policy header (and no report-only one),
#   - normal traffic below each rate limit passes without a 429,
#   - traffic above the limit gets 429 with Retry-After and the JSON or plain
#     text body, per zone: auth login posts, the auth host, the API host, the
#     external lookups and the /api/v1 routes on the app host,
#   - the ALFHEIM_RATE_LIMIT_* variables tune the limits.
#
# The limits are lowered through those variables so the test needs a few
# dozen requests instead of thousands. Requests the gateway would proxy fail
# with 5xx (no upstream); only the absence or presence of 429 matters.
#
# Usage:
#   ./scripts/test-gateway-hardening.sh               # build the image, run all checks
#   GATEWAY_TEST_IMAGE=name ./scripts/test-gateway-hardening.sh   # reuse a built image
#
# Exit codes: 0 every check passed, 1 one or more checks failed.
# ==============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${GATEWAY_TEST_IMAGE:-alfheim-caddy:gateway-test}"
CONTAINER="alfheim_gateway_test"
PORT="${GATEWAY_TEST_PORT:-18480}"
BASE="http://127.0.0.1:${PORT}"
APP_HOST="alfheim.loegien.localhost"
API_HOST="api.alfheim.loegien.localhost"
AUTH_HOST="auth.alfheim.loegien.localhost"

# Low limits so each zone overflows after a handful of requests.
LIMIT_LOGIN=3
LIMIT_AUTH=12
LIMIT_LOOKUP=2
LIMIT_API=6

FAILURES=0
pass() { printf '  \033[0;32m✔\033[0m %s\n' "$*"; }
fail() { printf '  \033[0;31m✘\033[0m %s\n' "$*"; FAILURES=$((FAILURES + 1)); }

cleanup() { docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [[ -z "${GATEWAY_TEST_IMAGE:-}" ]]; then
	echo "▶ Building ${IMAGE} from infrastructure/caddy"
	docker build -q -t "${IMAGE}" "${ROOT}/infrastructure/caddy" >/dev/null
fi

cleanup
echo "▶ Starting ${CONTAINER} on ${BASE}"
docker run -d --name "${CONTAINER}" -p "127.0.0.1:${PORT}:80" \
	-e ALFHEIM_RATE_LIMIT_LOGIN="${LIMIT_LOGIN}" \
	-e ALFHEIM_RATE_LIMIT_AUTH="${LIMIT_AUTH}" \
	-e ALFHEIM_RATE_LIMIT_LOOKUP="${LIMIT_LOOKUP}" \
	-e ALFHEIM_RATE_LIMIT_API="${LIMIT_API}" \
	-v "${ROOT}/infrastructure/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
	-v "${ROOT}/infrastructure/caddy/errors:/srv/alfheim-errors:ro" \
	"${IMAGE}" >/dev/null

for _ in $(seq 1 30); do
	curl -fs -o /dev/null "${BASE}/livez" -H "Host: ${APP_HOST}" && break
	sleep 1
done
if ! curl -fs -o /dev/null "${BASE}/livez" -H "Host: ${APP_HOST}"; then
	docker logs "${CONTAINER}" || true
	echo "Caddy did not become ready" >&2
	exit 1
fi

# status HOST PATH [curl args...] prints the HTTP status of one request.
status() {
	local host="$1" path="$2"
	shift 2
	curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: ${host}" "$@" "${BASE}${path}"
}

# expect_burst NAME COUNT HOST PATH [curl args...] sends COUNT requests in
# parallel and fails when any of them was throttled. Parallel requests keep
# the run short where the gateway waits for a missing backend.
expect_burst() {
	local name="$1" count="$2" host="$3" path="$4"
	shift 4
	local codes
	codes="$(for _ in $(seq 1 "${count}"); do status "${host}" "${path}" "$@" & done; wait)"
	if grep -q 429 <<<"${codes}"; then
		fail "${name}: ${count} requests within the limit were throttled (${codes//$'\n'/ })"
	else
		pass "${name}: ${count} requests within the limit pass"
	fi
}

# expect_throttled NAME HOST PATH [curl args...] checks that the next request
# is answered with 429, Retry-After and a JSON body.
expect_throttled() {
	local name="$1" host="$2" path="$3"
	shift 3
	local headers body
	headers="$(mktemp)"
	body="$(curl -s -D "${headers}" --max-time 10 -H "Host: ${host}" "$@" "${BASE}${path}")"
	if ! head -n1 "${headers}" | grep -q ' 429'; then
		fail "${name}: request above the limit got $(head -n1 "${headers}" | tr -d '\r'), want 429"
	elif ! grep -qi '^Retry-After: [0-9]' "${headers}"; then
		fail "${name}: 429 lacks Retry-After"
	elif ! grep -q '"error":"rate_limited"' <<<"${body}"; then
		fail "${name}: 429 body is not the rate_limited JSON (${body})"
	else
		pass "${name}: request above the limit gets 429 with Retry-After"
	fi
	rm -f "${headers}"
}

echo "▶ Content-Security-Policy"
headers="$(curl -s -D - -o /dev/null -H "Host: ${APP_HOST}" "${BASE}/livez")"
csp="$(grep -i '^Content-Security-Policy:' <<<"${headers}" | tr -d '\r' || true)"
if grep -qi '^Content-Security-Policy-Report-Only:' <<<"${headers}"; then
	fail "a report-only CSP is still sent"
fi
for directive in "default-src 'self'" "frame-ancestors 'self'" "object-src 'none'" "base-uri 'self'" "form-action 'self'" "connect-src 'self' http://auth."; do
	if grep -qF "${directive}" <<<"${csp}"; then
		pass "enforced CSP has ${directive}"
	else
		fail "enforced CSP lacks ${directive} (${csp:-no header})"
	fi
done

echo "▶ App host: pages and /livez are never throttled"
expect_burst "/livez" 20 "${APP_HOST}" /livez
expect_burst "frontend page" 20 "${APP_HOST}" /household -H 'Accept: text/html'

echo "▶ API host (limit ${LIMIT_API}/min)"
expect_burst "API host" "${LIMIT_API}" "${API_HOST}" /internal
expect_throttled "API host" "${API_HOST}" /internal
page="$(mktemp)"
code="$(curl -s -o "${page}" -w '%{http_code}' -H "Host: ${API_HOST}" -H 'Accept: text/html' "${BASE}/internal")"
if [[ "${code}" == 429 ]] && grep -q 'Too many requests' "${page}"; then
	pass "API host: a browser gets the plain-text 429 page"
else
	fail "API host: browser request got ${code}, want the plain-text 429"
fi
rm -f "${page}"
if [[ "$(status "${API_HOST}" /storage/bucket/key)" != 429 ]]; then
	pass "API host: /storage is exempt"
else
	fail "API host: /storage was throttled"
fi

echo "▶ Auth host: login posts (limit ${LIMIT_LOGIN}/min) and all traffic (limit ${LIMIT_AUTH}/min)"
expect_burst "login posts" "${LIMIT_LOGIN}" "${AUTH_HOST}" /ui/login/password -X POST
expect_throttled "login posts" "${AUTH_HOST}" /ui/login/password -X POST
# The login posts counted against the auth zone too.
remaining=$((LIMIT_AUTH - LIMIT_LOGIN - 1))
expect_burst "auth host GET" "${remaining}" "${AUTH_HOST}" /.well-known/openid-configuration
expect_throttled "auth host" "${AUTH_HOST}" /.well-known/openid-configuration

echo "▶ App host: external lookups (limit ${LIMIT_LOOKUP}/min) and /api/v1 (limit ${LIMIT_API}/min)"
expect_burst "lookups" "${LIMIT_LOOKUP}" "${APP_HOST}" /api/v1/library/lookup/isbn/9780000000000
expect_throttled "lookups" "${APP_HOST}" /api/v1/pantry/products/barcode/4000000000000
# Lookups count against the API zone too: LIMIT_LOOKUP + 1 requests so far.
remaining=$((LIMIT_API - LIMIT_LOOKUP - 1))
expect_burst "/api/v1" "${remaining}" "${APP_HOST}" /api/v1/households
expect_throttled "/api/v1" "${APP_HOST}" /api/v1/households

echo
if ((FAILURES > 0)); then
	echo "${FAILURES} gateway hardening check(s) failed"
	docker logs --tail 20 "${CONTAINER}" || true
	exit 1
fi
echo "All gateway hardening checks passed"
