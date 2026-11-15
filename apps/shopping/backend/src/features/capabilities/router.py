"""HTTP API exposing the installation's shopping capabilities."""

from backend_shared.household import HouseholdContext, require_household
from fastapi import APIRouter, Depends
from src.core.config import settings
from src.features.capabilities.schemas import ShoppingCapabilities
from src.features.capabilities.service import get_capabilities

router = APIRouter(prefix="/api/v1/shopping/capabilities", tags=["capabilities"])


@router.get("", response_model=ShoppingCapabilities, summary="Optional integrations of this installation")
async def read_capabilities(
    _household: HouseholdContext = Depends(require_household),
) -> ShoppingCapabilities:
    """Return whether Pantry is available, so the UI can hide the pantry sync.

    The answer describes the installation, not the household; the household
    dependency only ensures the caller is an authenticated member.
    """
    return get_capabilities(settings)
