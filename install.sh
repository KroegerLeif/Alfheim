#!/usr/bin/env bash
# ==============================================================================
# alfheim: Bootstrap Installer
# ==============================================================================
# Downloads the alfheim-setup binary matching this host's architecture,
# verifies its checksum and hands over to it.
#
#   curl -fsSL https://raw.githubusercontent.com/KroegerLeif/Alfheim/main/install.sh | bash
#
# Every argument is forwarded to alfheim-setup, so a headless install reads:
#
#   curl -fsSL .../install.sh | bash -s -- --non-interactive --domain example.com --tls internal
# ==============================================================================

set -euo pipefail

REPO="${ALFHEIM_REPO:-KroegerLeif/Alfheim}"
VERSION="${ALFHEIM_VERSION:-latest}"
BINARY="alfheim-setup"

BOLD="\033[1m"; GREEN="\033[0;32m"; CYAN="\033[0;36m"; RED="\033[0;31m"; RESET="\033[0m"
log_info()    { printf "${CYAN}▶${RESET}  %s\n" "$*"; }
log_success() { printf "${GREEN}✔${RESET}  %s\n" "$*"; }
log_error()   { printf "${RED}✖${RESET}  %s\n" "$*" >&2; }

# ------------------------------------------------------------------------------
# Cleanup
# ------------------------------------------------------------------------------
WORKDIR=""
cleanup() { [[ -n "${WORKDIR}" && -d "${WORKDIR}" ]] && rm -rf "${WORKDIR}"; }
trap cleanup EXIT

# ------------------------------------------------------------------------------
# 1. Prerequisites
# ------------------------------------------------------------------------------
for tool in curl uname mktemp; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    log_error "${tool} is required but was not found."
    exit 1
  fi
done

# ------------------------------------------------------------------------------
# 2. Detect platform
# ------------------------------------------------------------------------------
os="$(uname -s | tr '[:upper:]' '[:lower:]')"
if [[ "${os}" != "linux" ]]; then
  log_error "Alfheim installs onto Linux hosts; this system reports '${os}'."
  exit 1
fi

case "$(uname -m)" in
  x86_64|amd64)  arch="amd64" ;;
  aarch64|arm64) arch="arm64" ;;
  *)
    log_error "Unsupported architecture: $(uname -m). Only amd64 and arm64 are released."
    exit 1
    ;;
esac
log_success "Detected linux/${arch}"

# ------------------------------------------------------------------------------
# 3. Resolve the release
# ------------------------------------------------------------------------------
if [[ "${VERSION}" == "latest" ]]; then
  log_info "Resolving the latest release of ${REPO}..."
  VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -n 1)"
  if [[ -z "${VERSION}" ]]; then
    log_error "Could not resolve the latest release. Set ALFHEIM_VERSION to pin one."
    exit 1
  fi
fi
log_success "Installing ${BINARY} ${VERSION}"

ASSET="${BINARY}_linux_${arch}"
BASE_URL="https://github.com/${REPO}/releases/download/${VERSION}"

# ------------------------------------------------------------------------------
# 4. Download and verify
# ------------------------------------------------------------------------------
WORKDIR="$(mktemp -d)"
log_info "Downloading ${ASSET}..."
if ! curl -fsSL "${BASE_URL}/${ASSET}" -o "${WORKDIR}/${BINARY}"; then
  log_error "Download failed: ${BASE_URL}/${ASSET}"
  exit 1
fi

log_info "Verifying checksum..."
if curl -fsSL "${BASE_URL}/SHA256SUMS" -o "${WORKDIR}/SHA256SUMS" 2>/dev/null; then
  expected="$(grep " ${ASSET}\$" "${WORKDIR}/SHA256SUMS" | awk '{print $1}' | head -n 1)"
  if [[ -z "${expected}" ]]; then
    log_error "SHA256SUMS does not list ${ASSET}. Refusing to run an unverified binary."
    exit 1
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "${WORKDIR}/${BINARY}" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "${WORKDIR}/${BINARY}" | awk '{print $1}')"
  else
    log_error "Neither sha256sum nor shasum is available. Refusing to run an unverified binary."
    exit 1
  fi

  if [[ "${expected}" != "${actual}" ]]; then
    log_error "Checksum mismatch for ${ASSET}."
    log_error "  expected ${expected}"
    log_error "  actual   ${actual}"
    exit 1
  fi
  log_success "Checksum verified"
else
  log_error "SHA256SUMS could not be downloaded. Refusing to run an unverified binary."
  exit 1
fi

chmod +x "${WORKDIR}/${BINARY}"

# ------------------------------------------------------------------------------
# 5. Hand over
# ------------------------------------------------------------------------------
printf "\n${BOLD}Starting the Alfheim setup wizard...${RESET}\n\n"

# When this script is piped into bash, stdin is the pipe rather than the
# terminal, and the interactive wizard would see no TTY and exit immediately.
# Reattaching stdin to the controlling terminal is what makes
# "curl ... | bash" work with a full-screen TUI.
if [[ ! -t 0 && -e /dev/tty ]]; then
  exec < /dev/tty
fi

# exec replaces this shell, so the EXIT trap never fires and WORKDIR survives
# for the binary to run from. The directory lives under /tmp and is reclaimed
# by the system; cleaning it here would delete the binary we are about to run.
exec "${WORKDIR}/${BINARY}" "$@"
