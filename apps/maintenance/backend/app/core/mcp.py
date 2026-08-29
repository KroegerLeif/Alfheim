"""
MCP (Model Context Protocol) server for the Maintenance OS backend.

Exposes AI tools registered dynamically from app/features/*/mcp_tools.py.
Mounted into the main FastAPI app under /api/v1/mcp via SSE transport.
"""

import importlib
import logging
import pathlib

from fastmcp import FastMCP

logger = logging.getLogger(__name__)

# Initialize the central FastMCP server instance
mcp_server = FastMCP("Maintenance OS Ingress")


def discover_and_import_mcp_tools() -> None:
    """Scan the app/features directory for mcp_tools.py files and import them to register FastMCP tools."""
    features_dir = pathlib.Path(__file__).parent.parent / "features"
    if not features_dir.exists():
        return

    for mcp_tools_path in features_dir.rglob("mcp_tools.py"):
        relative_path = mcp_tools_path.relative_to(pathlib.Path(__file__).parent.parent.parent)
        module_parts = relative_path.with_suffix("").parts
        module_name = ".".join(module_parts)

        try:
            importlib.import_module(module_name)
            logger.info("Successfully imported FastMCP tools from %s", module_name)
        except Exception as e:
            logger.error("Failed to import FastMCP tools from %s: %s", module_name, e)
