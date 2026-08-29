import importlib
import pathlib

from fastmcp import FastMCP

# Initialize the FastMCP server instance for Budget & Treasury
mcp = FastMCP("Budget & Treasury")


@mcp.tool()
def get_budget_status() -> str:
    """Get the current status of the budget & treasury backend service."""
    return "Budget & Treasury backend is running."


def discover_and_import_mcp_tools() -> None:
    """Scan src/mcp and src/features directory for mcp_tools.py files or tools modules.

    This triggers the `@mcp.tool()` decorator on the modules to register
    them dynamically onto the central mcp server instance.
    """
    src_dir = pathlib.Path(__file__).parent.parent

    # Always attempt to import src.mcp.tools if available
    try:
        importlib.import_module("src.mcp.tools")
    except Exception as e:
        print(f"Failed to import src.mcp.tools: {e}")

    features_dir = src_dir / "features"
    if not features_dir.exists():
        return

    # Find all mcp_tools.py files in features subdirectories
    for tools_path in features_dir.rglob("mcp_tools.py"):
        relative_path = tools_path.relative_to(src_dir.parent)
        module_parts = relative_path.with_suffix("").parts
        module_name = ".".join(module_parts)

        try:
            importlib.import_module(module_name)
        except Exception as e:
            print(f"Failed to import MCP tools from {module_name}: {e}")
