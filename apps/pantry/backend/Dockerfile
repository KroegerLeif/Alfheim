# Multi-stage production build using uv
FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder

# Enable Python bytecode compilation
ENV UV_COMPILE_BYTECODE=1

WORKDIR /app

# Copy dependency configuration and workspace sources
COPY pyproject.toml uv.lock ./
COPY packages/backend-shared ./packages/backend-shared
COPY apps/pantry/backend ./apps/pantry/backend

WORKDIR /app/apps/pantry/backend

# Sync dependencies (excluding development libraries)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --no-editable

# Final slim runtime container
FROM python:3.12-alpine

WORKDIR /app

# Copy virtualenv and executable files from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/apps/pantry/backend/src /app/src
COPY --from=builder /app/apps/pantry/backend/main.py /app/main.py

# Inject virtualenv into system PATH
ENV PATH="/app/.venv/bin:$PATH"

# Expose FastAPI application port
EXPOSE 8000

# Execute FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
