# Multi-stage production build using uv.
#
# NOTE: unlike pantry/chores (which build with `context: ./backend` and fail to
# resolve their `backend-shared = { workspace = true }` dependency — verified during
# workout's Phase 0 scaffolding), this Dockerfile is built with the repo root as the
# build context so the uv workspace (root pyproject.toml + packages/backend-shared)
# is visible. See apps/workout/compose.yml for the corresponding build block.
FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder

# Enable Python bytecode compilation
ENV UV_COMPILE_BYTECODE=1

WORKDIR /app

# Copy workspace-level configuration first to maximize layer caching
COPY pyproject.toml ./
COPY packages/backend-shared ./packages/backend-shared
COPY apps/workout/backend/pyproject.toml ./apps/workout/backend/pyproject.toml

WORKDIR /app/apps/workout/backend

# Sync dependencies (excluding development libraries and the project itself)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --no-install-project --no-editable

# Copy application source files
COPY apps/workout/backend/. .

# Run project sync to register the package
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --no-editable

# Final slim runtime container
FROM python:3.12-alpine

WORKDIR /app

RUN addgroup -S -g 10001 appgroup \
    && adduser -S -u 10001 -G appgroup appuser

# Copy virtualenv and executable files from builder
COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appgroup /app/apps/workout/backend/src /app/src
COPY --from=builder --chown=appuser:appgroup /app/apps/workout/backend/main.py /app/main.py

# Inject virtualenv into system PATH
ENV PATH="/app/.venv/bin:$PATH"

USER appuser

# Expose FastAPI application port
EXPOSE 8000

# Execute FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
