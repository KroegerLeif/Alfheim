from contextlib import asynccontextmanager

from backend_shared import setup_telemetry, shutdown_telemetry
from backend_shared.household import close_membership_client, configure_household_auth
from backend_shared.mcp_middleware import mount_mcp
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.audit import AuditRepository  # noqa: F401 - imported to trigger register_audit_hooks at module load
from src.core.config import settings
from src.core.database import engine, init_db
from src.features.accounts import router as accounts_router
from src.features.plans import router as plans_router
from src.features.pots import router as pots_router
from src.features.transactions import router as transactions_router
from src.mcp.server import discover_and_import_mcp_tools, mcp

# Discover and register FastMCP tools
discover_and_import_mcp_tools()


# Household membership is authorized by the household app; register OIDC settings and validate env.
configure_household_auth(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for database initialization, FastMCP server, and telemetry cleanup."""
    # Initialize DB tables on application startup
    await init_db()

    try:
        # Run the MCP app's own lifespan: it starts the Streamable HTTP session manager.
        async with mcp_app.router.lifespan_context(mcp_app):
            yield
    finally:
        await close_membership_client()
        shutdown_telemetry()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

# Initialize OpenTelemetry and structured logging
setup_telemetry(app, settings=settings, engine=engine)

app.include_router(
    accounts_router,
    prefix="/api/v1/accounts",
    tags=["accounts"],
)

app.include_router(
    pots_router,
    prefix="/api/v1/pots",
    tags=["pots"],
)

app.include_router(
    plans_router,
    prefix="/api/v1/plans",
    tags=["plans"],
)

app.include_router(
    transactions_router,
    prefix="/api/v1/transactions",
    tags=["transactions"],
)

# Serve the FastMCP Streamable HTTP endpoint at exactly /mcp, guarded by the household auth middleware
mcp_app = mount_mcp(app, mcp, settings=settings)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz():
    """Health check endpoint required by TASK-101."""
    return {"status": "ok", "service": settings.PROJECT_NAME}


@app.get("/metrics")
async def metrics():
    """Metrics endpoint required by TASK-101."""
    return {"metrics": "ok"}
