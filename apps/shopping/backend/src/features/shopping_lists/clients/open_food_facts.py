import logging

import httpx

logger = logging.getLogger(__name__)


class OpenFoodFactsClient:
    """Async client for querying the Open Food Facts API."""

    def __init__(
        self,
        base_url: str = "https://world.openfoodfacts.org",
        timeout: float = 3.0,
    ):
        self.base_url = base_url
        self.timeout = timeout

    async def get_by_barcode(self, barcode: str) -> dict | None:
        """Fetch product metadata from Open Food Facts by barcode.

        Returns None if not found, if a request error occurs, or if timeout is exceeded.
        """
        url = f"{self.base_url}/api/v2/product/{barcode}.json"
        headers = {"User-Agent": "DigitalPantry - ShoppingBackend - Version 0.1.0"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=headers)

                if response.status_code != 200:
                    logger.warning(
                        "Open Food Facts API returned status %s for barcode %s",
                        response.status_code,
                        barcode,
                    )
                    return None

                data = response.json()
                if data.get("status") != 1 or "product" not in data:
                    logger.info(
                        "Product with barcode %s not found on Open Food Facts",
                        barcode,
                    )
                    return None

                product_data = data["product"]
                name = (
                    product_data.get("product_name")
                    or product_data.get("product_name_en")
                    or product_data.get("product_name_de")
                    or f"Product {barcode}"
                )

                brand = product_data.get("brands")
                if brand:
                    brand = brand.split(",")[0].strip()

                image_url = product_data.get("image_front_url") or product_data.get("image_url")

                return {
                    "barcode": barcode,
                    "name": name,
                    "brand": brand,
                    "quantity": 1.0,
                    "unit": "piece",
                    "image_url": image_url,
                }

        except httpx.TimeoutException:
            logger.warning("Timeout querying Open Food Facts for barcode %s", barcode)
            return None
        except httpx.RequestError as exc:
            logger.error(
                "Network error querying Open Food Facts for barcode %s: %s",
                barcode,
                exc,
            )
            return None
        except Exception as exc:
            logger.error(
                "Unexpected error parsing Open Food Facts response for barcode %s: %s",
                barcode,
                exc,
            )
            return None
