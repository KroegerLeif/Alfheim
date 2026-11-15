# ==============================================================================
# alfheim: Caddy Ingress Gateway with ACME DNS-01 Providers
# ==============================================================================
# The upstream caddy image ships no DNS provider modules, so the ACME DNS-01
# challenge is unavailable there. The installer offers Hetzner, Cloudflare and
# deSEC DNS-01 for wildcard issuance without inbound port 80, which requires the
# providers to be compiled in with xcaddy.
#
# See docs/en/explanation/decisions/0004-standalone-go-tui-installer.md.
# ==============================================================================

FROM --platform=$BUILDPLATFORM caddy:2.11.9-builder-alpine AS builder

# Cross-compile natively on the build host instead of emulating the target.
ARG TARGETOS
ARG TARGETARCH

# The builder image ships Go 1.27.1, whose stdlib has fixed HIGH CVEs (fixed in
# 1.27.4). Pin the patched toolchain, the same one the other Go images use,
# until the base image catches up.
ENV GOTOOLCHAIN=go1.27.4

# --replace forces patched versions of transitive dependencies that the pinned
# caddy and plugin releases still resolve to vulnerable versions.
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH xcaddy build \
    --replace github.com/go-jose/go-jose/v4=github.com/go-jose/go-jose/v4@v4.1.6 \
    --replace golang.org/x/net=golang.org/x/net@v0.60.0 \
    --with github.com/caddy-dns/hetzner@v1.0.0 \
    --with github.com/caddy-dns/cloudflare@v0.2.4 \
    --with github.com/caddy-dns/desec@v1.1.0

FROM caddy:2.11.8-alpine

# The base image lags behind Alpine security fixes (brotli, curl).
RUN apk upgrade --no-cache

# Replace the stock binary with the module-enabled build.
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

# Static page the Caddyfile's handle_errors serves for a stopped or missing
# app. Baked into the image so the installer-generated Caddyfile can rely on
# it without an extra bind mount.
COPY errors/ /srv/alfheim-errors/

# Fail the build early if the DNS modules did not make it into the binary.
RUN caddy list-modules | grep -q '^dns.providers.hetzner$' \
 && caddy list-modules | grep -q '^dns.providers.cloudflare$' \
 && caddy list-modules | grep -q '^dns.providers.desec$'
