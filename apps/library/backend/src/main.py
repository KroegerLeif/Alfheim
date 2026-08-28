import logging
from contextlib import asynccontextmanager

from backend_shared import configure_logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize structured application logging
configure_logging()
logger = logging.getLogger("library.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    logger.info("Starting up Library Backend service...")
    yield
    logger.info("Shutting down Library Backend service...")


app = FastAPI(
    title="Library Backend Service",
    description="Tier 1 Core Library service for managing media items, locations, and lending.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint returning service status."""
    logger.info("Library health check endpoint hit")
    return {"status": "ok"}


@app.get("/api/v1/health")
async def api_health_check():
    """API health check endpoint returning service status."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
