# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o dashboard-backend ./cmd/server

# Production stage
FROM alpine:3.20 AS runner

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 appgroup \
    && adduser -S -u 10001 -G appgroup appuser

COPY --from=builder --chown=appuser:appgroup /app/dashboard-backend /app/dashboard-backend
COPY --from=builder --chown=appuser:appgroup /app/migrations /app/migrations

USER appuser

EXPOSE 8080

ENTRYPOINT ["/app/dashboard-backend"]
