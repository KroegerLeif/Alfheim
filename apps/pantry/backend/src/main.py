import importlib
import pathlib
from contextlib import asynccontextmanager
from fastapi import APIRouter, FastAPI
from src.core.config import settings
from src.mcp.server import mcp


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
            # Check for standard 'router' variable
            router = getattr(module, "router", None)
            if isinstance(router, APIRouter):
                app.include_router(router)
            else:
                # Fallback: scan all module attributes for an APIRouter
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if isinstance(attr, APIRouter):
                        app.include_router(attr)
                        break
        except Exception as e:
            print(f"Failed to import router from {module_name}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    from src.core.database import init_db, async_session_factory
    await init_db()

    # Seed default locations and categories
    from src.features.locations.router import seed_default_locations
    from src.features.categories.router import seed_default_categories
    async with async_session_factory() as session:
        await seed_default_locations(session)
        await seed_default_categories(session)

    # Initialize FastMCP lifespan
    async with mcp.lifespan():
        yield



app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

# Discover and register router configurations dynamically
discover_and_include_routers(app)

# Mount the FastMCP server
app.mount("/mcp", mcp.http_app())


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "project": settings.PROJECT_NAME}
