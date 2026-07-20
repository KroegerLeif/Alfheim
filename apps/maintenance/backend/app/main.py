import importlib
import pathlib
from contextlib import asynccontextmanager
from fastapi import APIRouter, FastAPI

from app.core.config import settings


def discover_and_include_routers(app: FastAPI) -> None:
    """Scan the app/features directory for router.py files and include their APIRouters."""
    features_dir = pathlib.Path(__file__).parent / "features"
    if not features_dir.exists():
        return

    # Find all router.py files in the features directory
    for router_path in features_dir.rglob("router.py"):
        relative_path = router_path.relative_to(pathlib.Path(__file__).parent.parent)
        module_parts = relative_path.with_suffix("").parts
        module_name = ".".join(module_parts)

        try:
            module = importlib.import_module(module_name)
            router = getattr(module, "router", None)
            if isinstance(router, APIRouter):
                app.include_router(router)
            else:
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if isinstance(attr, APIRouter):
                        app.include_router(attr)
                        break
        except Exception as e:
            print(f"Failed to import router from {module_name}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables and seed data on startup
    from app.core.database import init_db
    await init_db()

    try:
        yield
    finally:
        # Gracefully flush and shutdown OpenTelemetry providers on shutdown
        from app.core.telemetry import shutdown_telemetry
        shutdown_telemetry()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

# Initialize OpenTelemetry telemetry at startup to correctly build ASGI middleware chain
from app.core.telemetry import setup_telemetry
setup_telemetry(app)

# Discover and register router configurations dynamically
discover_and_include_routers(app)

# Mount the MCP SSE transport at /api/v1/mcp
# This exposes /api/v1/mcp/sse (stream) and /api/v1/mcp/messages (post) endpoints
from app.core.mcp import mcp_server
app.mount("/api/v1/mcp", mcp_server.sse_app())


@app.get("/api/v1/health")
async def health_check():
    """Simple health check endpoint returning 200 OK status."""
    return {"status": "ok", "project": settings.PROJECT_NAME}
