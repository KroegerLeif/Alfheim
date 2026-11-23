# Multi-stage production build using uv with monorepo root context
FROM ghcr.io/astral-sh/uv:python3.14-alpine AS builder

# Enable Python bytecode compilation
ENV UV_COMPILE_BYTECODE=1

WORKDIR /app

# Copy root workspace and package configuration files to cache dependencies
COPY pyproject.toml uv.lock ./
COPY packages/backend-shared ./packages/backend-shared
COPY apps/library/backend/pyproject.toml ./apps/library/backend/

# Sync dependencies for library-backend workspace package
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --package library-backend --no-install-project --no-editable

# Copy application source files
COPY apps/library/backend ./apps/library/backend

# Run project sync to register the package
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --package library-backend --no-editable

# Final slim runtime container
FROM python:3.15-alpine

WORKDIR /app

# The base image lags behind Alpine security fixes (krb5-libs); upgrade its
# packages so the release Trivy gate sees the patched versions. The app runs
# from the uv-built /app/.venv, so the image's own pip (and the packages it
# vendors, which Trivy flags) is removed.
RUN apk upgrade --no-cache \
    && python -m pip uninstall --yes --no-cache-dir pip

RUN addgroup -S -g 10001 appgroup \
    && adduser -S -u 10001 -G appgroup appuser

# Copy virtualenv and executable files from builder
COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appgroup /app/apps/library/backend /app/apps/library/backend

# Inject virtualenv into system PATH
ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app/apps/library/backend

USER appuser

# Expose FastAPI application port
EXPOSE 8000

# Execute FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
