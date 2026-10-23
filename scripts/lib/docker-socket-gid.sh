#!/usr/bin/env bash
# =============================================================================
# scripts/lib/docker-socket-gid.sh — DOCKER_SOCKET_GID detection (sourced)
#
# compose.prod.yaml runs the Docker socket proxy as user 65534 with the host
# docker group id, so the non-root proxy can open /var/run/docker.sock. The
# id is host specific and is stored as DOCKER_SOCKET_GID in .env.
#
# Functions:
#   detect_docker_socket_gid            print the group id, or return 1
#   ensure_docker_socket_gid <env-file> write DOCKER_SOCKET_GID if missing
# =============================================================================

# detect_docker_socket_gid prints the group id that can open the docker socket.
detect_docker_socket_gid() {
  local socket="/var/run/docker.sock"
  local gid=""

  if [[ "$(uname -s)" == "Darwin" ]]; then
    # Docker Desktop runs the daemon in a VM whose socket is root:root 0660.
    # `stat -f %g` on the host symlink reports the symlink's group, which is
    # not the group the daemon checks, so the VM socket's group (0) is used.
    if [[ -e "$socket" ]]; then
      gid="0"
    fi
  elif [[ -S "$socket" ]]; then
    gid="$(stat -c %g "$socket" 2>/dev/null || true)"
  fi

  if [[ -z "$gid" ]]; then
    gid="$(getent group docker 2>/dev/null | cut -d: -f3 || true)"
  fi

  if [[ ! "$gid" =~ ^[0-9]+$ ]]; then
    return 1
  fi
  printf '%s\n' "$gid"
}

# ensure_docker_socket_gid writes DOCKER_SOCKET_GID into the given env file
# unless it already holds a numeric value. It returns 1 with a message on
# stderr when no group id can be determined.
ensure_docker_socket_gid() {
  local env_file="$1"
  local gid

  if grep -qE '^DOCKER_SOCKET_GID=[0-9]+[[:space:]]*$' "$env_file"; then
    return 0
  fi

  if ! gid="$(detect_docker_socket_gid)"; then
    echo "Cannot determine the docker group id for DOCKER_SOCKET_GID. Set DOCKER_SOCKET_GID in ${env_file} manually (Linux: getent group docker | cut -d: -f3)." >&2
    return 1
  fi

  if grep -q '^DOCKER_SOCKET_GID=' "$env_file"; then
    sed -i.bak -e "s|^DOCKER_SOCKET_GID=.*|DOCKER_SOCKET_GID=${gid}|" "$env_file" && rm -f "${env_file}.bak"
  else
    printf 'DOCKER_SOCKET_GID=%s\n' "$gid" >> "$env_file"
  fi
  return 0
}
