#!/usr/bin/env bash
# ==============================================================================
# alfheim: Local Quality Gate & Pre-Flight Verification Runner
# ==============================================================================
# Automates comprehensive static analysis, linting, formatting, type checking,
# test execution, and security scans across all monorepo stacks.
#
# Usage:
#   ./scripts/verify.sh          # Runs all verification gates (--all)
#   ./scripts/verify.sh --all    # Runs Python, Go, Frontend, and Security scans
#   ./scripts/verify.sh --python # Runs Ruff, Ty, and Pytest test matrix
#   ./scripts/verify.sh --go     # Runs Go tests and race detectors
#   ./scripts/verify.sh --frontend # Runs TSC typecheck and Vitest test suites
#   ./scripts/verify.sh --security # Runs secret leakage & hardcoding scans
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Terminal Colors & UI Utilities
# ------------------------------------------------------------------------------
BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
MAGENTA="\033[0;35m"
NC="\033[0m"

log_banner() {
    echo -e "\n${BOLD}${MAGENTA}==============================================================================${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${MAGENTA}==============================================================================${NC}\n"
}

log_section() {
    echo -e "\n${BOLD}${CYAN}==>${NC} ${BOLD}$1${NC}"
}

log_success() {
    echo -e "${GREEN}✔ $1${NC}"
}

log_fail() {
    echo -e "${RED}✖ $1${NC}" >&2
}

log_warn() {
    echo -e "${YELLOW}▲ $1${NC}"
}

# Resolve Workspace Root Directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Flags
RUN_PYTHON=false
RUN_GO=false
RUN_FRONTEND=false
RUN_SECURITY=false

# Argument Parsing
if [[ $# -eq 0 ]]; then
    RUN_PYTHON=true
    RUN_GO=true
    RUN_FRONTEND=true
    RUN_SECURITY=true
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        --all)
            RUN_PYTHON=true
            RUN_GO=true
            RUN_FRONTEND=true
            RUN_SECURITY=true
            shift
            ;;
        --python)
            RUN_PYTHON=true
            shift
            ;;
        --go)
            RUN_GO=true
            shift
            ;;
        --frontend)
            RUN_FRONTEND=true
            shift
            ;;
        --security)
            RUN_SECURITY=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./scripts/verify.sh [--all | --python | --go | --frontend | --security]"
            exit 0
            ;;
        *)
            log_fail "Unknown argument: $1"
            echo "Usage: ./scripts/verify.sh [--all | --python | --go | --frontend | --security]"
            exit 1
            ;;
    esac
done

ERRORS=0

# ------------------------------------------------------------------------------
# 1. Python Quality Gates
# ------------------------------------------------------------------------------
if [[ "$RUN_PYTHON" == true ]]; then
    log_banner "1. Python Verification (Ruff, Ty, Pytest Matrix)"

    log_section "Ruff Linter Check"
    if uv run ruff check .; then
        log_success "Ruff linter passed (0 diagnostics)"
    else
        log_fail "Ruff linter found issues"
        ERRORS=$((ERRORS + 1))
    fi

    log_section "Ruff Formatter Check"
    if uv run ruff format --check .; then
        log_success "Ruff formatter passed"
    else
        log_fail "Ruff format checks failed"
        ERRORS=$((ERRORS + 1))
    fi

    log_section "Ty Static Type Checker"
    if uv run ty check; then
        log_success "ty type checker passed (0 errors)"
    else
        log_fail "ty type checking failed"
        ERRORS=$((ERRORS + 1))
    fi

    log_section "Pytest Test Matrix Across Python Microservices"
    PYTHON_SERVICES=(
        "apps/pantry/backend"
        "apps/shopping/backend"
        "apps/maintenance/backend"
        "apps/chores/backend"
    )

    for service in "${PYTHON_SERVICES[@]}"; do
        echo -e "\n${BOLD}--> Running tests in ${service}...${NC}"
        if (cd "$ROOT_DIR/$service" && uv run pytest --cov --cov-report=term-missing); then
            log_success "Pytest suite for $service passed"
        else
            log_fail "Pytest suite for $service failed"
            ERRORS=$((ERRORS + 1))
        fi
    done
fi

# ------------------------------------------------------------------------------
# 2. Go Quality Gates
# ------------------------------------------------------------------------------
if [[ "$RUN_GO" == true ]]; then
    log_banner "2. Go Verification (Tests, Race Detector & Coverage)"

    if command -v go >/dev/null 2>&1; then
        log_section "Go Backend Unit & Integration Tests (core/dashboard/backend)"
        if (cd "$ROOT_DIR/core/dashboard/backend" && go test -race -cover ./...); then
            log_success "Go test suite passed with race detector enabled"
        else
            log_fail "Go tests failed"
            ERRORS=$((ERRORS + 1))
        fi

        if command -v golangci-lint >/dev/null 2>&1; then
            log_section "Go Linter (golangci-lint)"
            if (cd "$ROOT_DIR/core/dashboard/backend" && golangci-lint run); then
                log_success "golangci-lint passed"
            else
                log_fail "golangci-lint found issues"
                ERRORS=$((ERRORS + 1))
            fi
        fi
    else
        log_warn "Go is not installed on this environment; skipping Go checks."
    fi
fi

# ------------------------------------------------------------------------------
# 3. Frontend Quality Gates
# ------------------------------------------------------------------------------
if [[ "$RUN_FRONTEND" == true ]]; then
    log_banner "3. Frontend Verification (TypeScript & Vitest)"

    if command -v pnpm >/dev/null 2>&1; then
        log_section "TypeScript Type Checking (tsc --noEmit across workspace)"
        if pnpm -r exec tsc --noEmit; then
            log_success "TypeScript type checking passed across all frontends & packages"
        else
            log_fail "TypeScript type checking failed"
            ERRORS=$((ERRORS + 1))
        fi

        log_section "Vitest Test Suites"
        if pnpm -r test; then
            log_success "Vitest suites passed"
        else
            log_fail "Vitest suites failed"
            ERRORS=$((ERRORS + 1))
        fi
    else
        log_warn "pnpm is not installed on this environment; skipping frontend checks."
    fi
fi

# ------------------------------------------------------------------------------
# 4. Security & Secret Leakage Scans
# ------------------------------------------------------------------------------
if [[ "$RUN_SECURITY" == true ]]; then
    log_banner "4. Security & Hardcoding Guardrails"

    log_section "Checking for Private Keys, Certificates, and Tokens"
    # Search for accidental private keys or live tokens
    LEAKED_KEYS=$(git grep -inE -- '-----BEGIN (RSA|OPENSSH|EC|DSA|PGP|PRIVATE) KEY-----' ':!*.example' ':!*.md' ':!scripts/verify.sh' || true)
    if [[ -n "$LEAKED_KEYS" ]]; then
        log_fail "Found potential private key files:"
        echo "$LEAKED_KEYS"
        ERRORS=$((ERRORS + 1))
    else
        log_success "No private keys detected"
    fi

    log_section "Checking for Tracked Sensitive .env Files"
    TRACKED_ENVS=$(git ls-files | grep -E '(^|/)\.env(\.[^/]+)?$' | grep -v '\.example' || true)
    if [[ -n "$TRACKED_ENVS" ]]; then
        log_fail "Found uncommitted or tracked live .env files in Git index:"
        echo "$TRACKED_ENVS"
        ERRORS=$((ERRORS + 1))
    else
        log_success "No live .env files are tracked in Git"
    fi

    log_section "Pre-commit Hook Validation"
    if uv run pre-commit run --all-files; then
        log_success "Pre-commit hooks validation passed"
    else
        log_fail "Pre-commit hooks failed"
        ERRORS=$((ERRORS + 1))
    fi
fi

# ------------------------------------------------------------------------------
# Final Verification Summary
# ------------------------------------------------------------------------------
echo ""
log_banner "Quality Gate Summary"

if [[ $ERRORS -eq 0 ]]; then
    echo -e "${BOLD}${GREEN}✔ ALL QUALITY GATES PASSED! Workspace is clean and ready to commit/push.${NC}\n"
    exit 0
else
    echo -e "${BOLD}${RED}✖ QUALITY GATES FAILED ($ERRORS errors detected). Fix issues before committing.${NC}\n"
    exit 1
fi
