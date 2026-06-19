from fastmcp import FastMCP

# Initialize the FastMCP server instance
mcp = FastMCP("Digital Pantry")


@mcp.tool()
def get_pantry_status() -> str:
    """Get the current status of the digital pantry."""
    return "Digital Pantry backend is running."
