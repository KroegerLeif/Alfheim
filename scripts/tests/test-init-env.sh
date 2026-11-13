#!/usr/bin/env bash
# =============================================================================
# scripts/tests/test-init-env.sh — checks that init-env.sh leaves no secret on
# its public .env.example value (issue #870)
#
# Runs scripts/init-env.sh against a .env copied from .env.example in a
# temporary directory and asserts that
#   - every secret-like key with a concrete example value was regenerated,
#   - mirrored keys (S3_SECRET_KEY, the Zitadel first-instance password) follow
#     their source,
#   - a value the user changed and the CHAT_ENCRYPTION_KEY_ID label are kept,
#   - no generated value is printed,
#   - a second run changes nothing.
# When the host docker group id can be detected, a fresh --force generation is
# checked the same way.
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INIT_ENV="${REPO_ROOT}/scripts/init-env.sh"
TEMPLATE="${REPO_ROOT}/.env.example"
SECRET_KEY_RE='^[A-Z0-9_]*(PASSWORD|SECRET|MASTERKEY|ENCRYPTION_KEY|TOKEN)[A-Z0-9_]*$'
USER_KEY="GRAFANA_ADMIN_PASSWORD"
USER_VALUE="changed-by-the-user-0123456789abcdef"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

failures=0
fail() {
  echo "FAIL: $*" >&2
  failures=$((failures + 1))
}

value_of() {
  grep -E "^$2=" "$1" | tail -n 1 | cut -d= -f2-
}

# check_no_example_secrets asserts that no secret-like key in <env-file> still
# holds its concrete .env.example value, and that no value appears in <log>.
check_no_example_secrets() {
  local env_file="$1" log="$2" key example current
  while IFS= read -r line; do
    [[ "$line" =~ ^([A-Z0-9_]+)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    example="${BASH_REMATCH[2]}"
    [[ "$key" =~ $SECRET_KEY_RE ]] || continue
    [[ "$key" == "CHAT_ENCRYPTION_KEY_ID" ]] && continue
    case "$example" in
      ""|'${'*|__PROVISIONED__) continue ;;
    esac
    current="$(value_of "$env_file" "$key")"
    if [[ "$current" == "$example" ]]; then
      fail "$key still holds its .env.example value"
    elif [[ -n "$current" && "$key" != "$USER_KEY" ]] && grep -qF -- "$current" "$log"; then
      fail "the value of $key was printed"
    fi
  done < "$TEMPLATE"

  if [[ "$(value_of "$env_file" CHAT_ENCRYPTION_KEY_ID)" != "$(value_of "$TEMPLATE" CHAT_ENCRYPTION_KEY_ID)" ]]; then
    fail "CHAT_ENCRYPTION_KEY_ID is a key version label and must keep its example value"
  fi
  if [[ "$(value_of "$env_file" S3_SECRET_KEY)" != "$(value_of "$env_file" S3_ROOT_PASSWORD)" ]]; then
    fail "S3_SECRET_KEY does not mirror S3_ROOT_PASSWORD"
  fi
  if [[ "$(value_of "$env_file" ZITADEL_MASTERKEY | tr -d '\n' | wc -c | tr -d ' ')" != "32" ]]; then
    fail "ZITADEL_MASTERKEY is not 32 characters long"
  fi
}

# Existing .env copied from the template, with one value the user changed.
mkdir -p "${WORK_DIR}/existing"
cp "$TEMPLATE" "${WORK_DIR}/existing/.env.example"
sed -e "s|^${USER_KEY}=.*|${USER_KEY}=${USER_VALUE}|" \
  -e 's|^DOCKER_SOCKET_GID=.*|DOCKER_SOCKET_GID=999|' \
  "$TEMPLATE" > "${WORK_DIR}/existing/.env"
grep -q '^DOCKER_SOCKET_GID=' "${WORK_DIR}/existing/.env" \
  || echo 'DOCKER_SOCKET_GID=999' >> "${WORK_DIR}/existing/.env"

(cd "${WORK_DIR}/existing" && ALFHEIM_INSTALL_DIR="${WORK_DIR}/existing" "$INIT_ENV" --auto) \
  > "${WORK_DIR}/existing.log" 2>&1 || fail "init-env.sh --auto on an existing .env exited non-zero"
check_no_example_secrets "${WORK_DIR}/existing/.env" "${WORK_DIR}/existing.log"
if [[ "$(value_of "${WORK_DIR}/existing/.env" "$USER_KEY")" != "$USER_VALUE" ]]; then
  fail "a value the user changed ($USER_KEY) was overwritten"
fi
if ! grep -q 'POSTGRES_PASSWORD' "${WORK_DIR}/existing.log"; then
  fail "the replaced key names were not reported"
fi

before="$(cksum < "${WORK_DIR}/existing/.env")"
(cd "${WORK_DIR}/existing" && ALFHEIM_INSTALL_DIR="${WORK_DIR}/existing" "$INIT_ENV" --auto) \
  > "${WORK_DIR}/second.log" 2>&1 || fail "the second init-env.sh run exited non-zero"
if [[ "$(cksum < "${WORK_DIR}/existing/.env")" != "$before" ]]; then
  fail "a second run changed .env"
fi

# Fresh generation needs the host docker group id for DOCKER_SOCKET_GID.
# shellcheck source=../lib/docker-socket-gid.sh
source "${REPO_ROOT}/scripts/lib/docker-socket-gid.sh"
if detect_docker_socket_gid > /dev/null; then
  mkdir -p "${WORK_DIR}/fresh"
  cp "$TEMPLATE" "${WORK_DIR}/fresh/.env.example"
  (cd "${WORK_DIR}/fresh" && ALFHEIM_INSTALL_DIR="${WORK_DIR}/fresh" "$INIT_ENV" --auto --force) \
    > "${WORK_DIR}/fresh.log" 2>&1 || fail "init-env.sh --auto --force exited non-zero"
  check_no_example_secrets "${WORK_DIR}/fresh/.env" "${WORK_DIR}/fresh.log"
else
  echo "SKIP: fresh generation (no docker group id on this host)"
fi

if (( failures > 0 )); then
  echo "init-env.sh secret check: ${failures} failure(s)" >&2
  exit 1
fi
echo "init-env.sh secret check passed"
