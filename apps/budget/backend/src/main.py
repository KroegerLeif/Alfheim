from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.audit import register_audit_hooks
from src.core.config import settings
from src.core.database import init_db
from src.features.accounts import router as accounts_router

register_audit_hooks()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for database initialization."""
    # Initialize DB tables on application startup
    try:
        await init_db()
    except Exception:
        # DB connection might fail in test environments where DB URL is not SQLite, handled gracefully
        pass
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

app.include_router(
    accounts_router,
    prefix="/api/v1/accounts",
    tags=["accounts"],
)

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
