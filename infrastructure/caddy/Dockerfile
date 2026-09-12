# ==============================================================================
# alfheim: Caddy Ingress Gateway with ACME DNS-01 Providers
# ==============================================================================
# The upstream caddy image ships no DNS provider modules, so the ACME DNS-01
# challenge is unavailable there. The installer offers Hetzner and Cloudflare
# DNS-01 for wildcard issuance without inbound port 80, which requires the
# providers to be compiled in with xcaddy.
#
# See docs/decisions/0004-standalone-go-tui-installer.md.
# ==============================================================================

FROM caddy:2.10-builder-alpine AS builder

RUN xcaddy build \
    --with github.com/caddy-dns/hetzner \
    --with github.com/caddy-dns/cloudflare

FROM caddy:2.10-alpine

# Replace the stock binary with the module-enabled build.
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

# Fail the build early if the DNS modules did not make it into the binary.
RUN caddy list-modules | grep -q '^dns.providers.hetzner$' \
 && caddy list-modules | grep -q '^dns.providers.cloudflare$'
