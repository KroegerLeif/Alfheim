# Multi-stage production build using uv with monorepo root context
FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder

# Enable Python bytecode compilation
ENV UV_COMPILE_BYTECODE=1

WORKDIR /app

# Copy root workspace and package configuration files to cache dependencies
COPY pyproject.toml uv.lock ./
COPY packages/backend-shared ./packages/backend-shared
COPY apps/shopping/backend/pyproject.toml ./apps/shopping/backend/

# Sync dependencies for shopping-backend workspace package
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --package shopping-backend --no-install-project --no-editable

# Copy application source files
COPY apps/shopping/backend ./apps/shopping/backend

# Run project sync to register the package
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --package shopping-backend --no-editable

# Final slim runtime container
FROM python:3.12-alpine

WORKDIR /app

# Copy virtualenv and executable files from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/apps/shopping/backend /app/apps/shopping/backend

# Inject virtualenv into system PATH
ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app/apps/shopping/backend

# Expose FastAPI application port
EXPOSE 8000

# Execute FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
