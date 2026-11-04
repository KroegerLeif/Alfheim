# Build stage
FROM --platform=$BUILDPLATFORM golang:1.27.3-alpine AS builder

# Cross-compile natively on the build host instead of emulating the target.
ARG TARGETOS
ARG TARGETARCH

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-w -s" -o dashboard-backend ./cmd/server

# Production stage
FROM alpine:3.24 AS runner

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 appgroup \
    && adduser -S -u 10001 -G appgroup appuser

COPY --from=builder --chown=appuser:appgroup /app/dashboard-backend /app/dashboard-backend
COPY --from=builder --chown=appuser:appgroup /app/migrations /app/migrations

USER appuser

EXPOSE 8080

ENTRYPOINT ["/app/dashboard-backend"]
