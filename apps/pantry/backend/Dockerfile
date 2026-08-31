# Multi-stage production build using uv with monorepo root context
FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder

# Enable Python bytecode compilation
ENV UV_COMPILE_BYTECODE=1

WORKDIR /app

# Copy root workspace and package configuration files to cache dependencies
COPY pyproject.toml uv.lock ./
COPY packages/backend-shared ./packages/backend-shared
COPY apps/pantry/backend/pyproject.toml ./apps/pantry/backend/

# Sync dependencies for pantry-backend workspace package
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --package pantry-backend --no-install-project --no-editable

# Copy application source files
COPY apps/pantry/backend ./apps/pantry/backend

# Run project sync to register the package
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --package pantry-backend --no-editable

# Final slim runtime container
FROM python:3.12-alpine

WORKDIR /app

RUN addgroup -S -g 10001 appgroup \
    && adduser -S -u 10001 -G appgroup appuser

# Copy virtualenv and executable files from builder
COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appgroup /app/apps/pantry/backend /app/apps/pantry/backend

# Inject virtualenv into system PATH
ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app/apps/pantry/backend

USER appuser

# Expose FastAPI application port
EXPOSE 8000

# Execute FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
