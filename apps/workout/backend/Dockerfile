# Multi-stage production build using uv with monorepo root context, so the uv
# workspace (root pyproject.toml, uv.lock, packages/backend-shared) is visible.
FROM ghcr.io/astral-sh/uv:python3.14-alpine AS builder

# Enable Python bytecode compilation
ENV UV_COMPILE_BYTECODE=1

WORKDIR /app

# Copy workspace-level configuration and the lockfile first to maximize layer
# caching and to install exactly the locked versions (without uv.lock, uv
# re-resolves on every build and can pull newer, untested releases).
COPY pyproject.toml uv.lock ./
COPY packages/backend-shared ./packages/backend-shared
COPY apps/workout/backend/pyproject.toml ./apps/workout/backend/pyproject.toml

WORKDIR /app/apps/workout/backend

# Sync dependencies (excluding development libraries and the project itself)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --package workout-backend --no-install-project --no-editable

# Copy application source files
COPY apps/workout/backend/. .

# Run project sync to register the package
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --package workout-backend --no-editable

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
COPY --from=builder --chown=appuser:appgroup /app/apps/workout/backend/src /app/src
COPY --from=builder --chown=appuser:appgroup /app/apps/workout/backend/main.py /app/main.py
# Startup migrations (src/core/migrations.py) read these relative to /app.
COPY --from=builder --chown=appuser:appgroup /app/apps/workout/backend/alembic.ini /app/alembic.ini
COPY --from=builder --chown=appuser:appgroup /app/apps/workout/backend/alembic /app/alembic

# Inject virtualenv into system PATH
ENV PATH="/app/.venv/bin:$PATH"

USER appuser

# Expose FastAPI application port
EXPOSE 8000

# Execute FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
