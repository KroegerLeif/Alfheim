import logging
import uuid

import httpx

logger = logging.getLogger(__name__)


async def push_out_of_stock_to_shopping(
    shopping_url: str,
    token: str | None,
    household_id: uuid.UUID,
    name: str,
    quantity: float = 1.0,
    unit: str = "piece",
    product_id: uuid.UUID | None = None,
    barcode: str | None = None,
) -> bool:
    """Push an out-of-stock item from Pantry directly to Shopping backend via internal HTTP integration."""
    target_url = f"{shopping_url.rstrip('/')}/api/v1/shopping/items"
    headers = {"X-Household-ID": str(household_id)}
    if token:
        headers["Authorization"] = token if token.startswith("Bearer ") else f"Bearer {token}"

    payload = {
        "name": name,
        "quantity": quantity,
        "unit": unit,
        "product_id": str(product_id) if product_id else None,
        "barcode": barcode,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(target_url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                logger.info(f"Successfully pushed out-of-stock item '{name}' to shopping service")
                return True
            else:
                logger.warning(f"Failed to push out-of-stock item to shopping: {resp.status_code} {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Error connecting to shopping service to push out-of-stock item: {e}")
        return False
