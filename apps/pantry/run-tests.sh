#!/bin/bash
# Shell runner for Pantry Backend Test Suite with coverage

# Navigate to backend directory where pyproject.toml is located
cd "$(dirname "$0")/backend"

# Run tests using uv
uv run pytest --cov=src src/ "$@"
