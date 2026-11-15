#!/usr/bin/env bash
# ==============================================================================
# alfheim: Go coverage gate (#813)
# ==============================================================================
# Runs one Go module's tests with the race detector and fails when its total
# statement coverage is below the module's gate. scripts/verify.sh --go and
# .github/workflows/go-ci.yml both call this script, so the gates live here
# only. Coverage counts every package of the module (-coverpkg), so code that
# only another package's tests exercise still counts.
#
# The service gates were set at the measured value, rounded down, when they
# were introduced (November 2026); raise them towards 90 % and beyond, never
# lower them to make a change pass.
#
# Usage: scripts/check-go-coverage.sh <module dir>   e.g. core/household/backend
# ==============================================================================

set -euo pipefail

gate_for() {
    case "$1" in
        apps/chat/backend)      echo 94 ;;
        core/dashboard/backend) echo 95 ;;
        core/household/backend) echo 97 ;;
        packages/go-shared)     echo 96 ;;
        tools/installer)        echo 80 ;;
        *)                      return 1 ;;
    esac
}

if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <module dir>" >&2
    exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
module="${1%/}"
if ! gate="$(gate_for "${module}")"; then
    echo "No coverage gate is defined for ${module}; add one to $0." >&2
    exit 2
fi

# The installer counts its internal packages only: cmd/ is a thin entry point.
coverpkg="./..."
if [[ "${module}" == "tools/installer" ]]; then
    coverpkg="./internal/..."
fi

profile="$(mktemp)"
trap 'rm -f "${profile}"' EXIT

cd "${ROOT_DIR}/${module}"
go test -race -covermode=atomic -coverpkg="${coverpkg}" -coverprofile="${profile}" ./...
pct="$(go tool cover -func="${profile}" | awk '/^total:/ {print $3}' | tr -d '%')"

echo "Total coverage of ${module}: ${pct}% (gate ${gate}%)"
if awk -v p="${pct}" -v g="${gate}" 'BEGIN { exit (p + 0 >= g + 0) ? 0 : 1 }'; then
    exit 0
fi
msg="Coverage of ${module} is ${pct}%, below its ${gate}% gate."
if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::error::${msg}"
else
    echo "${msg}" >&2
fi
exit 1
