# ==============================================================================
# alfheim: Caddy Ingress Gateway with ACME DNS-01 Providers
# ==============================================================================
# The upstream caddy image ships no DNS provider modules, so the ACME DNS-01
# challenge is unavailable there. The installer offers Hetzner, Cloudflare and
# deSEC DNS-01 for wildcard issuance without inbound port 80, which requires the
# providers to be compiled in with xcaddy.
#
# See docs/decisions/0004-standalone-go-tui-installer.md.
# ==============================================================================

FROM --platform=$BUILDPLATFORM caddy:2.11.6-builder-alpine AS builder

# Cross-compile natively on the build host instead of emulating the target.
ARG TARGETOS
ARG TARGETARCH

# The builder image ships Go 1.27.1, whose stdlib has fixed HIGH CVEs (fixed in
# 1.26.10 and 1.27.3). Pin the patched 1.26 toolchain until the base image catches up.
ENV GOTOOLCHAIN=go1.26.10

# --replace forces patched versions of transitive dependencies that the pinned
# caddy and plugin releases still resolve to vulnerable versions.
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH xcaddy build \
    --replace github.com/go-jose/go-jose/v4=github.com/go-jose/go-jose/v4@v4.1.6 \
    --replace golang.org/x/net=golang.org/x/net@v0.60.0 \
    --with github.com/caddy-dns/hetzner@v1.0.0 \
    --with github.com/caddy-dns/cloudflare@v0.2.4 \
    --with github.com/caddy-dns/desec@v1.1.0

FROM caddy:2.11.6-alpine

# The base image lags behind Alpine security fixes (brotli, curl).
RUN apk upgrade --no-cache

# Replace the stock binary with the module-enabled build.
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

# Fail the build early if the DNS modules did not make it into the binary.
RUN caddy list-modules | grep -q '^dns.providers.hetzner$' \
 && caddy list-modules | grep -q '^dns.providers.cloudflare$' \
 && caddy list-modules | grep -q '^dns.providers.desec$'
