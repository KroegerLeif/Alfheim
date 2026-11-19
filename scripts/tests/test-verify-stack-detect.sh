#!/usr/bin/env bash
# =============================================================================
# scripts/tests/test-verify-stack-detect.sh — checks which compose file
# verify-stack.sh picks when none is given
#
# Runs scripts/verify-stack.sh against a temporary directory with stub `docker`
# and `curl` binaries on PATH, so no stack has to run. The stub reports
# containers only for the compose files listed in STUB_RUNNING. Each case
# asserts the file named in the script's "Verifying the Alfheim stack" line:
#   - only compose.prod.yaml present            -> compose.prod.yaml
#   - only compose.yaml present                 -> compose.yaml
#   - both present, only the dev project runs   -> compose.yaml
#   - both present, only the prod project runs  -> compose.prod.yaml
#   - both present, nothing runs                -> compose.prod.yaml
#   - both present, --compose-file compose.yaml -> compose.yaml
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERIFY_STACK="${REPO_ROOT}/scripts/verify-stack.sh"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

BIN_DIR="${WORK_DIR}/bin"
mkdir -p "${BIN_DIR}"

# The docker stub answers `docker compose -f FILE ps -q` with a container id
# when FILE's basename is in STUB_RUNNING and stays silent for everything else.
cat > "${BIN_DIR}/docker" <<'EOF'
#!/usr/bin/env bash
file=""
quiet=0
prev=""
for arg in "$@"; do
  [[ "${prev}" == "-f" ]] && file="$(basename "${arg}")"
  [[ "${arg}" == "-q" ]] && quiet=1
  prev="${arg}"
done
if [[ "${1:-}" == "compose" && "${quiet}" == "1" && -n "${file}" ]]; then
  case ",${STUB_RUNNING:-}," in
    *",${file},"*) echo "stub-container-id" ;;
  esac
fi
exit 0
EOF
# The curl stub fails like an unreachable host, so the HTTP checks end fast.
printf '#!/usr/bin/env bash\nexit 7\n' > "${BIN_DIR}/curl"
chmod +x "${BIN_DIR}/docker" "${BIN_DIR}/curl"

failures=0

# run_case NAME FILES RUNNING WANT [ARGS...] creates a stack directory holding
# FILES, runs verify-stack.sh there and expects it to pick WANT.
run_case() {
  local name="$1" files="$2" running="$3" want="$4"
  shift 4
  local dir="${WORK_DIR}/${name}"
  mkdir -p "${dir}"
  local f
  for f in ${files}; do
    touch "${dir}/${f}"
  done
  printf 'ALFHEIM_BASE_URL=http://alfheim.test\nOIDC_ISSUER_URL=http://auth.alfheim.test\n' > "${dir}/.env"

  local out
  out="$(PATH="${BIN_DIR}:${PATH}" STUB_RUNNING="${running}" VERIFY_STACK_WAIT_SECONDS=0 \
    "${VERIFY_STACK}" --dir "${dir}" "$@" 2>&1 || true)"
  if grep -qF "Verifying the Alfheim stack in ${dir} (${want})" <<<"${out}"; then
    echo "ok   ${name}: picked ${want}"
  else
    echo "FAIL ${name}: wanted ${want}, got:"
    grep -F "Verifying the Alfheim stack" <<<"${out}" || echo "${out}" | tail -n 5
    failures=$((failures + 1))
  fi
}

run_case prod-only "compose.prod.yaml" "" compose.prod.yaml
run_case dev-only "compose.yaml" "" compose.yaml
run_case both-dev-running "compose.yaml compose.prod.yaml" "compose.yaml" compose.yaml
run_case both-prod-running "compose.yaml compose.prod.yaml" "compose.prod.yaml" compose.prod.yaml
run_case both-idle "compose.yaml compose.prod.yaml" "" compose.prod.yaml
run_case both-forced "compose.yaml compose.prod.yaml" "compose.prod.yaml" compose.yaml \
  --compose-file compose.yaml

if [[ "${failures}" -gt 0 ]]; then
  echo "${failures} case(s) failed"
  exit 1
fi
echo "All compose-file detection cases passed"
