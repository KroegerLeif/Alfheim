"""FastMCP server initialization for Library backend."""

import importlib
import pathlib

from fastmcp import FastMCP

# Initialize the FastMCP server instance for Library
mcp = FastMCP("Library")


@mcp.tool()
def get_library_status() -> str:
    """Get the current status of the library backend service."""
    return "Library backend is running."


def discover_and_import_mcp_tools() -> None:
    """Scan src/mcp directory for additional MCP tool modules.

    This allows dynamically registering tools onto the central mcp server instance.
    """
    src_dir = pathlib.Path(__file__).parent.parent

    # Attempt to import src.mcp.tools if available
    try:
        importlib.import_module("src.mcp.tools")
    except Exception as e:
        # Tools module is optional; silently skip if not present
        pass
