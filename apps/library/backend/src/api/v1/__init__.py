"""API v1 router bundle for the Library microservice."""

from fastapi import APIRouter

from src.api.v1.items import router as items_router
from src.api.v1.lending import router as lending_router
from src.api.v1.locations import router as locations_router

router = APIRouter(prefix="/api/v1/library")
router.include_router(locations_router)
router.include_router(items_router)
router.include_router(lending_router)

__all__ = ["router"]
