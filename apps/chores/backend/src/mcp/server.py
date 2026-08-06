import importlib
import pathlib
from fastmcp import FastMCP

# Initialize the FastMCP server instance
mcp = FastMCP("Chores Tracker")


@mcp.tool()
def get_chores_status() -> str:
    """Get the current status of the chores tracker."""
    return "Chores Tracker backend is running."


def discover_and_import_mcp_tools() -> None:
    """Scan the src/features directory for mcp_tools.py files and import them.

    This triggers the `@mcp.tool()` decorator on the modules to register
    them dynamically onto the central mcp server instance.
    """
    features_dir = pathlib.Path(__file__).parent.parent / "features"
    if not features_dir.exists():
        return

    # Find all mcp_tools.py files in features subdirectories
    for tools_path in features_dir.rglob("mcp_tools.py"):
        # Calculate module name relative to src, e.g., "src.features.chore_management.mcp_tools"
        relative_path = tools_path.relative_to(pathlib.Path(__file__).parent.parent.parent)
        module_parts = relative_path.with_suffix("").parts
        module_name = ".".join(module_parts)

        try:
            importlib.import_module(module_name)
        except Exception as e:
            print(f"Failed to import MCP tools from {module_name}: {e}")
