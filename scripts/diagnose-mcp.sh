#!/usr/bin/env bash
# ==============================================================================
# alfheim: FastMCP Server Diagnostic & Connectivity Runner
# ==============================================================================
# Pings registered FastMCP endpoints across microservices and verifies JSON-RPC
# Streamable HTTP initialization and tool discovery.
#
# Usage:
#   ./scripts/diagnose-mcp.sh                     # Check default local endpoints
#   ./scripts/diagnose-mcp.sh --api-url <url>      # Query chat backend diagnostic endpoint
# ==============================================================================

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
MAGENTA="\033[0;35m"
NC="\033[0m"

echo -e "\n${BOLD}${MAGENTA}==============================================================================${NC}"
echo -e "${BOLD}${CYAN}  ALFI FastMCP Server Diagnostic Check${NC}"
echo -e "${BOLD}${MAGENTA}==============================================================================${NC}\n"

# Default local MCP endpoint targets (app_slug=url)
DEFAULT_ENDPOINTS=(
  "pantry=http://localhost:8000/mcp"
  "chores=http://localhost:8001/mcp"
  "maintenance=http://localhost:8002/mcp"
  "budget=http://localhost:8003/mcp"
  "workout=http://localhost:8004/mcp"
)

ENDPOINTS=("${DEFAULT_ENDPOINTS[@]}")

# If CHAT_MCP_SERVERS is in environment, use it
if [[ -n "${CHAT_MCP_SERVERS:-}" ]]; then
  IFS=',' read -ra ADDR <<< "$CHAT_MCP_SERVERS"
  ENDPOINTS=()
  for item in "${ADDR[@]}"; do
    ENDPOINTS+=("$(echo "$item" | xargs)")
  done
fi

check_mcp_endpoint() {
  local slug="$1"
  local url="$2"

  printf "%-15s %-40s " "[$slug]" "$url"

  # Step 1: Send MCP initialize JSON-RPC payload
  local init_payload='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"alfi-diag","version":"1.0.0"}}}'
  local start_time
  start_time=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')

  local http_response
  if ! http_response=$(curl -s -m 3 -X POST "$url" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -d "$init_payload" 2>&1); then
    echo -e "${RED}✖ OFFLINE${NC} (Connection refused/timeout)"
    return 0
  fi

  local end_time
  end_time=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
  local latency=$((end_time - start_time))

  if echo "$http_response" | grep -q '"protocolVersion"'; then
    # Step 2: Query tools/list
    local tools_payload='{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
    local tools_response
    tools_response=$(curl -s -m 3 -X POST "$url" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "$tools_payload" 2>/dev/null || echo "")

    local tools_count=0
    if [[ -n "$tools_response" ]]; then
      tools_count=$(echo "$tools_response" | grep -o '"name":' | wc -l | xargs || echo 0)
    fi

    echo -e "${GREEN}✔ ONLINE${NC} (${latency}ms, ${tools_count} tools registered)"
  else
    echo -e "${YELLOW}▲ DEGRADED${NC} (Unexpected payload or non-MCP HTTP status)"
  fi
}

for item in "${ENDPOINTS[@]}"; do
  if [[ -z "$item" ]]; then continue; fi
  slug="${item%%=*}"
  url="${item#*=}"
  check_mcp_endpoint "$slug" "$url"
done

echo -e "\n${BOLD}${CYAN}Diagnostic complete.${NC}\n"
