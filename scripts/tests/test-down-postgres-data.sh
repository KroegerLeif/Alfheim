#!/usr/bin/env bash
# =============================================================================
# scripts/tests/test-down-postgres-data.sh — checks when down.sh removes the
# postgres-core bind mount infrastructure/postgres/data
#
# Copies scripts/down.sh and infrastructure/compose.yml into a temporary
# repository layout and runs it with a stub `docker` on PATH that only logs
# its arguments, so no stack has to run. Cases:
#   - down.sh               -> no helper container, data directory untouched
#   - down.sh -v            -> one `docker run --rm --entrypoint rm` with the
#                              pinned postgres-core image on <root>/infrastructure/postgres
#   - down.sh -v, data is a symlink out of the repository -> refuses, exit != 0,
#                              no helper container
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_IMAGE="$(awk '/^  postgres-core:/{s=1;next} s&&/^    image:/{print $2;exit}' \
  "${REPO_ROOT}/infrastructure/compose.yml")"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

BIN_DIR="${WORK_DIR}/bin"
mkdir -p "${BIN_DIR}"

# The docker stub logs every call; `network inspect` fails so no network is
# "removed", everything else succeeds.
cat > "${BIN_DIR}/docker" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${DOCKER_LOG}"
[[ "${1:-}" == "network" ]] && exit 1
exit 0
EOF
chmod +x "${BIN_DIR}/docker"

failures=0

# make_repo NAME creates a fake repository with down.sh, the infrastructure
# compose file and a populated postgres data directory, and prints its root.
make_repo() {
  local root="${WORK_DIR}/$1"
  mkdir -p "${root}/scripts" "${root}/infrastructure/postgres/data"
  cp "${REPO_ROOT}/scripts/down.sh" "${root}/scripts/down.sh"
  cp "${REPO_ROOT}/infrastructure/compose.yml" "${root}/infrastructure/compose.yml"
  touch "${root}/infrastructure/postgres/data/PG_VERSION"
  (cd -P "${root}" && pwd -P)
}

# run_down ROOT LOG [ARGS...] runs the copied down.sh and returns its status.
run_down() {
  local root="$1" log="$2"
  shift 2
  : > "${log}"
  env -u ALFHEIM_DB_DATA_PATH PATH="${BIN_DIR}:${PATH}" DOCKER_LOG="${log}" \
    "${root}/scripts/down.sh" "$@" > "${log}.out" 2>&1
}

check() {
  local name="$1" cond="$2"
  if eval "${cond}"; then
    echo "ok   ${name}"
  else
    echo "FAIL ${name}"
    failures=$((failures + 1))
  fi
}

# Case 1: plain down.sh keeps the data directory and starts no helper.
root="$(make_repo plain)"
log="${WORK_DIR}/plain.log"
run_down "${root}" "${log}"
check "plain: no helper container" "! grep -q '^run ' '${log}'"
check "plain: data directory untouched" "[[ -f '${root}/infrastructure/postgres/data/PG_VERSION' ]]"

# Case 2: -v removes the directory through the pinned postgres image.
root="$(make_repo volumes)"
log="${WORK_DIR}/volumes.log"
run_down "${root}" "${log}" -v
want="run --rm --entrypoint rm -v ${root}/infrastructure/postgres:/pg ${PG_IMAGE} -rf /pg/data"
check "-v: image read from compose (${PG_IMAGE})" "[[ -n '${PG_IMAGE}' ]]"
check "-v: helper container removes the data directory" "grep -qxF '${want}' '${log}'"
check "-v: helper runs after compose down" \
  "[[ \$(grep -n '^compose .* down' '${log}' | cut -d: -f1) -lt \$(grep -n '^run ' '${log}' | cut -d: -f1) ]]"

# Case 3: a data symlink that leaves the repository is refused.
root="$(make_repo symlink)"
outside="${WORK_DIR}/outside-data"
mkdir -p "${outside}"
rm -rf "${root}/infrastructure/postgres/data"
ln -s "${outside}" "${root}/infrastructure/postgres/data"
log="${WORK_DIR}/symlink.log"
status=0
run_down "${root}" "${log}" -v || status=$?
check "symlink: down.sh exits non-zero" "[[ ${status} -ne 0 ]]"
check "symlink: refusal is reported" "grep -q 'Refusing to remove' '${log}.out'"
check "symlink: no helper container" "! grep -q '^run ' '${log}'"

if [[ "${failures}" -ne 0 ]]; then
  echo "${failures} check(s) failed"
  exit 1
fi
echo "All down.sh postgres data checks passed"
