import logging

import httpx
from src.features.products.models import BaseUnit
from src.features.products.schemas import ProductCreate, ProductNutritionCreate

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

    async def get_by_barcode(self, barcode: str) -> ProductCreate | None:
        """Fetch product metadata from Open Food Facts by barcode.

        Returns None if not found, if a request error occurs, or if timeout is exceeded.
        """
        url = f"{self.base_url}/api/v2/product/{barcode}.json"
        headers = {"User-Agent": "DigitalPantry - Python - Version 0.1.0 - Developer Contact"}

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

                return self._map_to_product_create(barcode, data["product"])

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

    def _map_to_product_create(self, barcode: str, product_data: dict) -> ProductCreate:
        """Map raw Open Food Facts product data to a ProductCreate schema."""
        # 1. Resolve product name
        name = (
            product_data.get("product_name")
            or product_data.get("product_name_en")
            or product_data.get("product_name_de")
            or f"Product {barcode}"
        )

        # 2. Resolve brand
        brand = product_data.get("brands")
        if brand:
            # Open Food Facts often returns comma-separated brands, take the first one
            brand = brand.split(",")[0].strip()

        # 3. Resolve base unit
        # Check product quantity/unit or default to piece/g
        raw_quantity = product_data.get("quantity", "")
        base_unit = BaseUnit.G
        if any(keyword in raw_quantity.lower() for keyword in ["ml", "l", "liter", "liquid"]):
            base_unit = BaseUnit.ML
        elif any(keyword in raw_quantity.lower() for keyword in ["piece", "stk", "x"]):
            base_unit = BaseUnit.PIECE

        # 4. Resolve image URL
        image_url = product_data.get("image_front_url") or product_data.get("image_url")

        # 5. Extract nutrition details safely
        nutriments = product_data.get("nutriments", {})
        nutrition_payload = None

        # Energy can be under different keys, standard kcal is preferred
        calories = nutriments.get("energy-kcal_100g") or nutriments.get("energy-kcal")
        if calories is None and "energy_100g" in nutriments:
            # Convert kJ to kcal if kcal is missing (1 kcal = 4.184 kJ)
            try:
                calories = float(nutriments["energy_100g"]) / 4.184
            except (ValueError, TypeError):
                pass

        try:
            # Check if any nutritional info is present
            has_nutrition = (
                any(key in nutriments for key in ["fat_100g", "carbohydrates_100g", "proteins_100g", "salt_100g"])
                or calories is not None
            )

            if has_nutrition:
                nutrition_payload = ProductNutritionCreate(
                    calories=float(calories) if calories is not None else None,
                    fat=self._safe_float(nutriments.get("fat_100g") or nutriments.get("fat")),
                    saturated_fat=self._safe_float(
                        nutriments.get("saturated-fat_100g") or nutriments.get("saturated-fat")
                    ),
                    carbohydrates=self._safe_float(
                        nutriments.get("carbohydrates_100g") or nutriments.get("carbohydrates")
                    ),
                    sugars=self._safe_float(nutriments.get("sugars_100g") or nutriments.get("sugars")),
                    protein=self._safe_float(nutriments.get("proteins_100g") or nutriments.get("proteins")),
                    salt=self._safe_float(nutriments.get("salt_100g") or nutriments.get("salt")),
                )
        except Exception as exc:
            logger.warning(
                "Failed to parse nutrition details for barcode %s: %s",
                barcode,
                exc,
            )

        return ProductCreate(
            name=name,
            brand=brand,
            barcode=barcode,
            image_url=image_url,
            base_unit=base_unit,
            nutrition=nutrition_payload,
        )

    @staticmethod
    def _safe_float(value) -> float | None:
        """Convert input to float safely, returning None on failure."""
        if value is None:
            return None
        try:
            val = float(value)
            return val if val >= 0 else None
        except (ValueError, TypeError):
            return None
