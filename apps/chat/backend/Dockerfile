# Build stage
FROM --platform=$BUILDPLATFORM golang:1.27.4-alpine AS builder

# Cross-compile natively on the build host instead of emulating the target.
ARG TARGETOS
ARG TARGETARCH

# Build context: the repository root, so the image sees packages/go-shared
# (wired in through the replace directive in go.mod). go.work is excluded by
# .dockerignore: the build runs in module mode, exactly as outside the workspace.
WORKDIR /src/apps/chat/backend

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Cache dependencies
COPY packages/go-shared/go.mod packages/go-shared/go.sum /src/packages/go-shared/
COPY apps/chat/backend/go.mod apps/chat/backend/go.sum ./
RUN go mod download

# Copy source code
COPY packages/go-shared/ /src/packages/go-shared/
COPY apps/chat/backend/ ./

# Build binary
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-w -s" -o /app/chat-backend ./cmd/server

# Production stage
FROM alpine:3.24 AS runner

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 appgroup \
    && adduser -S -u 10001 -G appgroup appuser

COPY --from=builder --chown=appuser:appgroup /app/chat-backend /app/chat-backend
COPY --from=builder --chown=appuser:appgroup /src/apps/chat/backend/migrations /app/migrations

USER appuser

EXPOSE 8080

ENTRYPOINT ["/app/chat-backend"]
