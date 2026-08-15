#!/bin/bash
# ==============================================================================
# Alfheim — All-in-One Python Backend Test & Quality Runner
# Runs Ruff formatting checks, Ruff linter, and Pytest with coverage across
# all 4 backend microservices in the monorepo.
# ==============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SERVICES=(
  "apps/pantry/backend:src"
  "apps/shopping/backend:src"
  "apps/maintenance/backend:app"
  "apps/chores/backend:src"
)

echo "======================================================================"
echo " Starting Alfheim Python Backend Quality & Test Suite"
echo "======================================================================"

FAILED=0

for item in "${SERVICES[@]}"; do
  IFS=":" read -r service_path cov_target <<< "$item"
  abs_path="${REPO_ROOT}/${service_path}"
  
  echo ""
  echo "----------------------------------------------------------------------"
  echo " Testing: ${service_path}"
  echo "----------------------------------------------------------------------"
  
  if [ ! -d "$abs_path" ]; then
    echo "❌ Error: Directory '${abs_path}' does not exist."
    FAILED=1
    continue
  fi

  cd "$abs_path"

  echo "🔍 [1/3] Checking Ruff formatting..."
  if ! uv run ruff format --check .; then
    echo "❌ Ruff format check failed in ${service_path}"
    FAILED=1
    continue
  fi

  echo "🔎 [2/3] Running Ruff linter..."
  if ! uv run ruff check .; then
    echo "❌ Ruff lint check failed in ${service_path}"
    FAILED=1
    continue
  fi

  echo "🧪 [3/3] Running Pytest suite with coverage..."
  if ! uv run pytest --cov="${cov_target}" --cov-report=term-missing; then
    echo "❌ Pytest suite failed in ${service_path}"
    FAILED=1
    continue
  fi

  echo "✅ ${service_path} passed all checks!"
done

echo ""
echo "======================================================================"
if [ "$FAILED" -eq 0 ]; then
  echo "🎉 All backend services passed linting, formatting, and test suites!"
  echo "======================================================================"
  exit 0
else
  echo "💥 One or more backend checks failed. Review the output above."
  echo "======================================================================"
  exit 1
fi
