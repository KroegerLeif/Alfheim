#!/usr/bin/env bash
# Fails when a TODO or FIXME marker in a tracked file lacks an issue reference.
# Allowed form: TODO(#123): what is left to do. Convention:
# docs/en/reference/conventions/code-comments.md
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Markdown is excluded because docs quote the markers when describing the rule;
# lockfiles and this script contain the words without being code comments.
# Only comment lines count (// # /* * --), so string data such as "app=TODO" is ignored.
bare=$(git grep -nwE 'TODO|FIXME' -- . \
    ':!*.md' ':!*.mdx' ':!pnpm-lock.yaml' ':!uv.lock' ':!*.sum' \
    ':!scripts/check-todo-refs.sh' ':!scripts/verify.sh' \
    | grep -E '(//|#|/\*|[0-9]+:[[:space:]]*\*|--)' \
    | grep -vE '(TODO|FIXME)\(#[0-9]+\)' || true)

if [[ -n "$bare" ]]; then
    echo "TODO/FIXME without an issue reference (use TODO(#123): ...):" >&2
    echo "$bare" >&2
    exit 1
fi
echo "No bare TODO/FIXME markers"
