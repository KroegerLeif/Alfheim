"""API v1 router bundle for the Library microservice."""

from fastapi import APIRouter

from src.api.v1.items import router as items_router
from src.api.v1.lending import router as lending_router
from src.api.v1.locations import router as locations_router
from src.api.v1.lookup import router as lookup_router
from src.api.v1.manuals import router as manuals_router
from src.api.v1.providers import router as providers_router
from src.api.v1.search import router as search_router

router = APIRouter(prefix="/api/v1/library")
router.include_router(locations_router)
router.include_router(items_router)
router.include_router(manuals_router)
router.include_router(lending_router)
router.include_router(providers_router)
router.include_router(lookup_router)
router.include_router(search_router)

__all__ = ["router"]
