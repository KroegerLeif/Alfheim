#!/usr/bin/env bash
# Fails when a Next.js frontend build leaked runtime configuration into its
# prerendered HTML/JS: OIDC issuer and client id must only ever be delivered by
# the <basePath>/runtime-config.js route at request time, never baked into the
# static output produced by `next build` in CI (where no OIDC_* env vars are set).
#
# Usage: scripts/check-frontend-runtime-config.sh <frontend-dir>
#   e.g.  scripts/check-frontend-runtime-config.sh core/dashboard/frontend
#         scripts/check-frontend-runtime-config.sh apps/pantry/frontend
#
# Run this after `next build` with no build-time OIDC env vars set.

set -euo pipefail

FRONTEND_DIR="${1:-}"
if [[ -z "$FRONTEND_DIR" ]]; then
  echo "usage: $0 <frontend-dir>" >&2
  exit 1
fi

BUILD_DIR="${FRONTEND_DIR%/}/.next"
if [[ ! -d "$BUILD_DIR" ]]; then
  echo "error: no build output found at $BUILD_DIR (run 'next build' first)" >&2
  exit 1
fi

fail=0

if [[ -d "$BUILD_DIR/server/app" ]] && grep -rlq '__ALFHEIM_ENV__' "$BUILD_DIR/server/app" --include='*.html' 2>/dev/null; then
  echo "FAIL: prerendered HTML in $BUILD_DIR/server/app inlines __ALFHEIM_ENV__ (should be served at runtime only)" >&2
  grep -rl '__ALFHEIM_ENV__' "$BUILD_DIR/server/app" --include='*.html'
  fail=1
fi

if [[ -d "$BUILD_DIR/static" ]] && grep -rlq 'auth\.loegien' "$BUILD_DIR/static" 2>/dev/null; then
  echo "FAIL: client bundle in $BUILD_DIR/static contains a baked-in issuer hostname (auth.loegien...)" >&2
  grep -rl 'auth\.loegien' "$BUILD_DIR/static"
  fail=1
fi

# The AuthGuard must never leak its "identity provider not reachable" error page,
# or any protected content, into prerendered HTML: with no OIDC env at build
# time, useOidcAuth resolves loadOidcConfig() only after mount (a useEffect),
# so both the server render and the client's first paint must show nothing but
# its neutral loader (packages/shared/src/features/auth/AuthGuard.tsx). That
# loader (and any custom loadingFallback) carries the marker attribute
# data-alfheim-auth-guard="pending". Every prerendered app page must therefore
# contain that marker, and never the error page's copy.
if [[ -d "$BUILD_DIR/server/app" ]]; then
  while IFS= read -r -d '' html_file; do
    base_name="$(basename "$html_file")"
    # Next.js framework-internal pages (_not-found, _global-error, ...) are
    # rendered outside our root layout, so they never go through AuthGuard.
    if [[ "$base_name" == _*.html ]]; then
      continue
    fi

    if grep -q 'Identity provider not reachable' "$html_file"; then
      echo "FAIL: $html_file prerenders the AuthGuard error page (config must be resolved after mount, not during render)" >&2
      fail=1
    fi

    if ! grep -q 'data-alfheim-auth-guard="pending"' "$html_file"; then
      echo "FAIL: $html_file is missing the AuthGuard loading marker (data-alfheim-auth-guard=\"pending\") - it may be leaking protected content into prerendered HTML" >&2
      fail=1
    fi
  done < <(find "$BUILD_DIR/server/app" -name '*.html' -print0)
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "OK: $FRONTEND_DIR build output carries no baked-in runtime configuration"
