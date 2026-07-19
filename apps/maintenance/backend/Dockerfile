# Multi-stage production build using uv
FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder

# Enable Python bytecode compilation
ENV UV_COMPILE_BYTECODE=1

WORKDIR /app

# Copy dependency configuration files first to cache layers
COPY pyproject.toml uv.lock ./

# Sync dependencies using the frozen lockfile (excluding development libraries)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Copy application source files
COPY . .

# Run project sync to register workspace packages
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Final slim runtime container
FROM python:3.12-alpine

WORKDIR /app

# Copy virtualenv and executable files from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/app /app/app

# Inject virtualenv into system PATH
ENV PATH="/app/.venv/bin:$PATH"

# Expose FastAPI application port
EXPOSE 8000

# Execute FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
