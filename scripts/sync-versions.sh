#!/usr/bin/env bash
# =============================================================================
# scripts/sync-versions.sh — keep stack version pins in line with versions.json
#
# versions.json is the single source of truth for the core stack versions (Go,
# Python, Node.js, Next.js, PostgreSQL, Zitadel, Caddy, RustFS). The rules for
# where each one is pinned live in scripts/lib/sync_versions.py.
#
# Usage:
#   ./scripts/sync-versions.sh --check   # fail on any pin or VERSIONS.md drift
#   ./scripts/sync-versions.sh --write   # rewrite the pins and VERSIONS.md
#
# Exit codes: 0 in sync (or written), 1 drift found, 2 usage error.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "${SCRIPT_DIR}/lib/sync_versions.py" "$@"
