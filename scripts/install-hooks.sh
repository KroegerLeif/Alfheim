#!/usr/bin/env bash
set -euo pipefail

echo "Configuring Git local hooks path..."
git config core.hooksPath scripts/hooks

echo "Checking for pre-commit tool installation..."
if command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit hooks using pre-commit..."
    pre-commit install --hook-type pre-commit --hook-type commit-msg
elif command -v prek &> /dev/null; then
    echo "Installing pre-commit hooks using prek..."
    prek install --hook-type pre-commit --hook-type commit-msg
else
    echo "Notice: Neither 'pre-commit' nor 'prek' command was found in PATH."
    echo "Git core.hooksPath has been set to 'scripts/hooks'."
    echo "To run automated pre-commit checks locally, please install pre-commit (e.g. via 'pip install pre-commit' or 'brew install pre-commit') and re-run this script."
fi

echo ""
echo "============================================================"
echo "Git hooks installation complete!"
echo "Custom hooks path set to: scripts/hooks"
echo "Commit message rules (Conventional Commits & AI trailer blocking) are active."
echo "============================================================"
