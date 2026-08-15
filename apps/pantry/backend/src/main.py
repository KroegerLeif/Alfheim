import importlib
import logging
import pathlib
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.core.config import settings
from src.core.telemetry import setup_telemetry
from src.mcp.server import discover_and_import_mcp_tools, mcp

logger = logging.getLogger(__name__)


def discover_and_include_routers(app: FastAPI) -> None:
    """Scan the src/features directory for router.py files and include their APIRouters."""
    features_dir = pathlib.Path(__file__).parent / "features"
    if not features_dir.exists():
        return

    # Find all router.py files in the features directory
    for router_path in features_dir.rglob("router.py"):
        # Calculate module path relative to the root directory
        relative_path = router_path.relative_to(pathlib.Path(__file__).parent.parent)
        module_parts = relative_path.with_suffix("").parts
        module_name = ".".join(module_parts)

        try:
            module = importlib.import_module(module_name)
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if isinstance(attr, APIRouter):
                    app.include_router(attr)
        except Exception as e:
            logger.error(f"Failed to import router from {module_name}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    from src.core.database import init_db

    await init_db()

    try:
        # Initialize FastMCP lifespan
        async with mcp.lifespan():
            yield
    finally:
        # Gracefully flush and shutdown OpenTelemetry providers
        from src.core.telemetry import shutdown_telemetry

        shutdown_telemetry()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenTelemetry telemetry at startup to correctly build ASGI middleware chain
setup_telemetry(app)


@app.exception_handler(ValueError)
async def value_error_exception_handler(request: Request, exc: ValueError):
    """Globally catch ValueError exceptions and convert them into 400 Bad Request responses."""
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )


# Discover and register router configurations dynamically
discover_and_include_routers(app)

# Discover and register FastMCP tools dynamically
discover_and_import_mcp_tools()

# Mount the FastMCP server
app.mount("/mcp", mcp.http_app())


@app.get("/api/v1/health")
async def health_check():
    """Simple health check endpoint."""
    logger.info("Pantry health check endpoint hit!")
    return {"status": "ok", "project": settings.PROJECT_NAME}
