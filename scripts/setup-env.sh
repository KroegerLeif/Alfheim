#!/usr/bin/env bash
# ==============================================================================
# alfheim: Automated Environment (.env) Setup Script
# ==============================================================================
# Discovers all .env.example files across the monorepo (root, apps, core,
# packages, infrastructure) and scaffolds corresponding .env files.
#
# Usage:
#   ./scripts/setup-env.sh           # Safe mode: creates missing .env files, skips existing
#   ./scripts/setup-env.sh --force   # Force mode: backs up (.env.bak.<timestamp>) & overwrites
#   ./scripts/setup-env.sh -f        # Short flag for --force
#   ./scripts/setup-env.sh --help    # Displays usage instructions
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Terminal Colors & UI Utilities
# ------------------------------------------------------------------------------
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
MAGENTA="\033[0;35m"
NC="\033[0m"

log_banner() {
    echo -e "\n${BOLD}${MAGENTA}==============================================================================${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${MAGENTA}==============================================================================${NC}\n"
}

log_created() {
    echo -e "${GREEN}[CREATED]${NC} $1 -> $2"
}

log_skipped() {
    echo -e "${YELLOW}[SKIP]${NC}    $1 already exists (use --force to overwrite)"
}

log_overwritten() {
    echo -e "${GREEN}[UPDATED]${NC} $1 (backed up to $2)"
}

# Resolve Workspace Root Directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Parse CLI Arguments
FORCE=false

show_help() {
    echo "Usage: ./scripts/setup-env.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -f, --force    Overwrite existing .env files with backup (.env.bak.<timestamp>)"
    echo "  -h, --help     Show this help message"
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Use --help for usage information." >&2
            exit 1
            ;;
    esac
done

log_banner "alfheim: Environment Configuration Scaffolding"

if [ "$FORCE" = true ]; then
    echo -e "${YELLOW}Mode: FORCE (Existing .env files will be backed up and overwritten)${NC}\n"
else
    echo -e "${CYAN}Mode: SAFE (Only missing .env files will be created)${NC}\n"
fi

# Find all .env.example files ignoring build/cache/dependency directories
EXAMPLE_FILES=()
while IFS= read -r file; do
    EXAMPLE_FILES+=("$file")
done < <(find . -type f -name ".env.example" \
    -not -path "*/node_modules/*" \
    -not -path "*/.venv/*" \
    -not -path "*/.git/*" \
    -not -path "*/.idea/*" \
    -not -path "*/dist/*" \
    -not -path "*/.next/*" \
    | sort)

if [ ${#EXAMPLE_FILES[@]} -eq 0 ]; then
    echo "No .env.example files found in monorepo."
    exit 0
fi

TIMESTAMP=$(date +"%Y%m%d%H%M%S")
CREATED_COUNT=0
SKIPPED_COUNT=0
UPDATED_COUNT=0

for example_file in "${EXAMPLE_FILES[@]}"; do
    target_dir="$(dirname "$example_file")"
    target_env="${target_dir}/.env"

    # Relative path display for clean output
    rel_example="${example_file#./}"
    rel_env="${target_env#./}"

    if [ -f "$target_env" ]; then
        if [ "$FORCE" = true ]; then
            backup_file="${target_env}.bak.${TIMESTAMP}"
            rel_backup="${backup_file#./}"
            cp "$target_env" "$backup_file"
            cp "$example_file" "$target_env"
            log_overwritten "$rel_env" "$rel_backup"
            UPDATED_COUNT=$((UPDATED_COUNT + 1))
        else
            log_skipped "$rel_env"
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        fi
    else
        cp "$example_file" "$target_env"
        log_created "$rel_example" "$rel_env"
        CREATED_COUNT=$((CREATED_COUNT + 1))
    fi
done

echo ""
echo -e "${BOLD}Summary:${NC} ${GREEN}${CREATED_COUNT} created${NC}, ${YELLOW}${SKIPPED_COUNT} skipped${NC}, ${GREEN}${UPDATED_COUNT} updated${NC} (Total: ${#EXAMPLE_FILES[@]})"
echo -e "${GREEN}✔ Environment setup completed successfully.${NC}\n"
