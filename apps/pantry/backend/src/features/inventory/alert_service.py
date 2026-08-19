import uuid
from datetime import UTC, datetime

from sqlmodel import col, func, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.inventory.models import InventoryState
from src.features.locations.models import Location
from src.features.products.models import Product


class AlertService:
    """Service class encapsulating expiration monitoring, threshold calculations, and alert generation."""

    @staticmethod
    async def get_low_stock_items(
        session: AsyncSession,
        home_id: uuid.UUID,
    ) -> list[dict]:
        """Evaluate current cached InventoryState against minimum_stock to find low-stock products.

        Uses a LEFT OUTER JOIN to include products with zero stock that have a minimum_stock > 0.
        """
        # Subquery to aggregate total stock per product for the home
        subq = (
            select(InventoryState.product_id, func.sum(InventoryState.quantity).label("total_quantity"))
            .join(Location, col(InventoryState.location_id) == Location.id)
            .where(Location.home_id == home_id)
            .group_by(col(InventoryState.product_id))
            .subquery()
        )

        # Query products where aggregated quantity is less than minimum_stock
        stmt = (
            select(Product, func.coalesce(subq.c.total_quantity, 0.0).label("current_stock"))
            .outerjoin(subq, col(Product.id) == subq.c.product_id)
            .where(
                or_(Product.is_global, Product.home_id == home_id),
                func.coalesce(subq.c.total_quantity, 0.0) < Product.minimum_stock,
            )
        )

        result = await session.exec(stmt)
        low_stock = []
        for product, current_stock in result:
            low_stock.append(
                {
                    "product": product,
                    "current_stock": current_stock,
                }
            )
        return low_stock

    @staticmethod
    async def get_expiration_summary(
        session: AsyncSession,
        home_id: uuid.UUID,
    ) -> dict:
        """Categorize current cached inventory stock into 'Valid', 'Expired', and 'Untracked'.

        Leverages sentinel date '9999-12-31' for infinite shelf-life tracking,
        optimizing index usage on expiration_date.
        """
        today = datetime.now(UTC).date()

        # Base statement to select inventory state within target home locations
        base_stmt = (
            select(InventoryState)
            .join(Location, col(InventoryState.location_id) == Location.id)
            .where(Location.home_id == home_id)
        )

        # 1. Expired: expiration_date is not NULL and <= today
        expired_stmt = base_stmt.where(
            col(InventoryState.expiration_date).is_not(None), col(InventoryState.expiration_date) <= today
        )
        expired_res = await session.exec(expired_stmt)
        expired = expired_res.all()

        # 2. Valid: expiration_date is not NULL and > today (includes the sentinel 9999-12-31)
        valid_stmt = base_stmt.where(
            col(InventoryState.expiration_date).is_not(None), col(InventoryState.expiration_date) > today
        )
        valid_res = await session.exec(valid_stmt)
        valid = valid_res.all()

        # 3. Untracked: expiration_date is NULL
        untracked_stmt = base_stmt.where(col(InventoryState.expiration_date).is_(None))
        untracked_res = await session.exec(untracked_stmt)
        untracked = untracked_res.all()

        return {
            "expired": expired,
            "valid": valid,
            "untracked": untracked,
        }
