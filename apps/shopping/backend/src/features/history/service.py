import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.history.models import ShoppingHistory


class ShoppingHistoryService:
    """Service class encapsulating selection grid search history aggregation."""

    @staticmethod
    async def log_purchase(
        session: AsyncSession,
        home_id: uuid.UUID,
        name: str,
        brand: str | None = None,
        barcode: str | None = None,
        unit: str = "piece",
    ) -> ShoppingHistory:
        """Upsert a purchase event into history, incrementing the count and updating timestamps.

        Scopes entries using home_id and normalizes brand names to empty strings to support
        deterministic constraint matching.
        """
        clean_name = name.strip()
        clean_brand = brand.strip() if brand else ""
        clean_unit = unit.strip().lower()

        # Query existing entry within home space
        stmt = select(ShoppingHistory).where(
            ShoppingHistory.home_id == home_id,
            func.lower(ShoppingHistory.name) == clean_name.lower(),
            ShoppingHistory.brand == clean_brand,
        )
        res = await session.exec(stmt)
        db_history = res.first()

        now = datetime.now(UTC)

        if db_history:
            # Increment and update
            db_history.purchase_count += 1
            db_history.last_purchased_at = now
            db_history.unit = clean_unit
            if barcode:
                db_history.barcode = barcode.strip()
            session.add(db_history)
            return db_history
        else:
            # Create new history log
            db_history = ShoppingHistory(
                home_id=home_id,
                name=clean_name,
                brand=clean_brand,
                barcode=barcode.strip() if barcode else None,
                unit=clean_unit,
                purchase_count=1,
                last_purchased_at=now,
                icon_tag=ShoppingHistoryService.resolve_icon_tag(clean_name),
            )
            session.add(db_history)
            return db_history

    @staticmethod
    async def get_history(
        session: AsyncSession,
        home_id: uuid.UUID,
        limit: int = 50,
    ) -> Sequence[ShoppingHistory]:
        """Fetch frequently purchased items sorted by frequency and date."""
        stmt = (
            select(ShoppingHistory)
            .where(ShoppingHistory.home_id == home_id)
            .order_by(
                ShoppingHistory.purchase_count.desc(),
                ShoppingHistory.last_purchased_at.desc(),
            )
            .limit(limit)
        )
        res = await session.exec(stmt)
        return res.all()

    @staticmethod
    async def delete_history_item(
        session: AsyncSession,
        history_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Remove an item from the history list."""
        stmt = select(ShoppingHistory).where(
            ShoppingHistory.id == history_id,
            ShoppingHistory.home_id == home_id,
        )
        res = await session.exec(stmt)
        item = res.first()
        if not item:
            return False
        await session.delete(item)
        await session.commit()
        return True

    @staticmethod
    def resolve_icon_tag(name: str) -> str:
        """Resolve a translatable frontend category icon tag based on item keywords.

        This helps the next-intl frontend render dynamic visual badge tags.
        """
        keywords = {
            "milk": "icon.grocery.milk",
            "milch": "icon.grocery.milk",
            "cheese": "icon.grocery.cheese",
            "käse": "icon.grocery.cheese",
            "bread": "icon.grocery.bread",
            "brot": "icon.grocery.bread",
            "apple": "icon.grocery.fruit",
            "apfel": "icon.grocery.fruit",
            "banana": "icon.grocery.fruit",
            "banane": "icon.grocery.fruit",
            "water": "icon.grocery.drinks",
            "wasser": "icon.grocery.drinks",
            "beer": "icon.grocery.drinks",
            "bier": "icon.grocery.drinks",
            "coffee": "icon.grocery.drinks",
            "kaffee": "icon.grocery.drinks",
            "meat": "icon.grocery.meat",
            "fleisch": "icon.grocery.meat",
        }

        query = name.lower()
        for kw, tag in keywords.items():
            if kw in query:
                return tag

        return "icon.grocery.default"
