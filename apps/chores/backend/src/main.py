import asyncio
import importlib
import logging
import pathlib
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse

from src.core.config import settings
from src.mcp.server import mcp

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
            print(f"Failed to import router from {module_name}: {e}")


async def schedule_nightly_reset():
    """Runs a background loop that executes the daily reset for all households at 00:00:05 local time."""
    from src.core.database import async_session_factory
    from src.features.chore_management.service import ChoreService

    logger.info("Nightly reset scheduler started.")

    while True:
        try:
            now = datetime.now()
            # Calculate next midnight (00:00:05 to avoid boundary issues)
            next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=5, microsecond=0)
            sleep_sec = (next_midnight - now).total_seconds()

            logger.info(f"Nightly reset scheduled. Sleeping for {sleep_sec:.2f} seconds until {next_midnight}")
            await asyncio.sleep(sleep_sec)

            # Trigger reset
            target_date = date.today()
            async with async_session_factory() as session:
                await ChoreService.run_nightly_reset_for_all(session, target_date)
            logger.info(f"Nightly reset completed successfully for date {target_date}")

        except asyncio.CancelledError:
            logger.info("Nightly reset scheduler cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in nightly reset scheduler loop: {e}", exc_info=True)
            # Sleep 1 minute before retrying to prevent hot loop
            await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    from src.core.database import init_db
    await init_db()

    # Start background scheduler
    reset_task = asyncio.create_task(schedule_nightly_reset())

    try:
        # Initialize FastMCP lifespan
        async with mcp.lifespan():
            yield
    finally:
        # Cancel background scheduler
        reset_task.cancel()
        try:
            await reset_task
        except asyncio.CancelledError:
            pass
        # Gracefully flush and shutdown OpenTelemetry providers
        from src.core.telemetry import shutdown_telemetry
        shutdown_telemetry()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenTelemetry telemetry at startup to correctly build ASGI middleware chain
from src.core.telemetry import setup_telemetry

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
from src.mcp.server import discover_and_import_mcp_tools

discover_and_import_mcp_tools()

# Mount the FastMCP server
app.mount("/mcp", mcp.http_app())


@app.get("/api/v1/health")
async def health_check():
    """Simple health check endpoint."""
    logging.info("Chores health check endpoint hit!")
    return {"status": "ok", "project": settings.PROJECT_NAME}
