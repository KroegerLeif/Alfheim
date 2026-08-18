import logging
import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.history.service import ShoppingHistoryService
from src.features.shopping_lists.clients.pantry_client import PantryClient
from src.features.shopping_lists.models import ShoppingItem
from src.features.shopping_lists.schemas import (
    SyncToPantryResponse,
    UnrecognizedShoppingItem,
)

logger = logging.getLogger(__name__)


class PantrySyncService:
    """Service handling cross-app inter-service communications and synchronization with Pantry Backend."""

    @staticmethod
    async def auto_import_low_stock(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
        token: str | None = None,
        pantry_client: PantryClient | None = None,
    ) -> list[ShoppingItem]:
        """Fetch low stock items from Pantry and merge them into the list if not already active."""
        client = pantry_client or PantryClient()
        low_stock = await client.fetch_low_stock_items(token=token, household_id=home_id)

        # Retrieve all currently active (uncompleted) items in the shopping list
        active_items_stmt = select(ShoppingItem).where(
            ShoppingItem.list_id == list_id,
            ShoppingItem.is_completed == False,  # noqa: E712
        )
        active_items_res = await session.exec(active_items_stmt)
        active_items = active_items_res.all()

        # Build lookup helpers to prevent duplicate inserts
        active_barcodes = {x.barcode for x in active_items if x.barcode}
        active_names = {x.name.lower().strip() for x in active_items}

        imported_items = []

        for item in low_stock:
            product = item.get("product", {})
            current_stock = item.get("current_stock", 0.0)
            min_stock = product.get("minimum_stock", 0.0)
            product_id = product.get("id")

            barcode = product.get("barcode")
            name = product.get("name", "").strip()
            brand = product.get("brand")

            if not name:
                continue

            # Merge Logic: Skip if already present in the active shopping list
            if barcode and barcode in active_barcodes:
                continue
            if name.lower() in active_names:
                continue

            # Deficiency calculation: target - current
            deficit = min_stock - current_stock
            quantity_to_buy = max(1.0, deficit)

            db_item = ShoppingItem(
                list_id=list_id,
                name=name,
                brand=brand,
                barcode=barcode,
                quantity=quantity_to_buy,
                unit=product.get("base_unit", "piece"),
                is_auto_generated=True,
                is_completed=False,
                is_synced=False,
                product_id=uuid.UUID(product_id) if product_id else None,
            )
            session.add(db_item)
            imported_items.append(db_item)

        if imported_items:
            await session.commit()
            for item in imported_items:
                await session.refresh(item)

        return imported_items

    @staticmethod
    async def sync_to_pantry(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
        token: str | None = None,
        pantry_client: PantryClient | None = None,
    ) -> SyncToPantryResponse:
        """Push checked-off items in bulk to the Pantry, updating sync state and histories."""
        # Fetch completed but unsynced items
        stmt = select(ShoppingItem).where(
            ShoppingItem.list_id == list_id,
            ShoppingItem.is_completed == True,  # noqa: E712
            ShoppingItem.is_synced == False,  # noqa: E712
        )
        res = await session.exec(stmt)
        completed_items = res.all()

        if not completed_items:
            return SyncToPantryResponse(
                status="success",
                synced_count=0,
                unrecognized_count=0,
                unrecognized_items=[],
            )

        # Format bulk payload for Pantry service
        bulk_payload = []
        for item in completed_items:
            bulk_payload.append(
                {
                    "shopping_item_id": str(item.id),
                    "name": item.name,
                    "brand": item.brand,
                    "barcode": item.barcode,
                    "quantity": item.quantity,
                    "unit": item.unit,
                }
            )

        # Post to Pantry bulk add
        client = pantry_client or PantryClient()
        sync_result = await client.bulk_add_items(items=bulk_payload, token=token, household_id=home_id)

        success_map: dict[uuid.UUID, uuid.UUID] = {}
        for x in sync_result.get("successful_items", []):
            try:
                success_map[uuid.UUID(x["shopping_item_id"])] = uuid.UUID(x["product_id"])
            except (KeyError, ValueError, TypeError) as exc:
                logger.warning("Invalid successful_items entry from pantry: %r (%s)", x, exc)

        unrecognized_list = sync_result.get("unrecognized_items", [])

        # Process updates in Shopping DB
        for item in completed_items:
            if item.id in success_map:
                item.is_synced = True
                item.product_id = success_map[item.id]
                session.add(item)

            # Log to selection history for both successful and unrecognized purchases
            await ShoppingHistoryService.log_purchase(
                session=session,
                home_id=home_id,
                name=item.name,
                brand=item.brand,
                barcode=item.barcode,
                unit=item.unit,
            )

        await session.commit()

        # Build unrecognized response mapping
        unrecognized_response = []
        for un_item in unrecognized_list:
            unrecognized_response.append(
                UnrecognizedShoppingItem(
                    shopping_item_id=uuid.UUID(un_item["shopping_item_id"]),
                    name=un_item["name"],
                    brand=un_item.get("brand"),
                    barcode=un_item.get("barcode"),
                    quantity=un_item["quantity"],
                    unit=un_item["unit"],
                    reason=un_item.get("reason", "pantry.error.product_not_found"),
                )
            )

        status_flag = "success" if not unrecognized_response else "partial_success"

        return SyncToPantryResponse(
            status=status_flag,
            synced_count=len(success_map),
            unrecognized_count=len(unrecognized_response),
            unrecognized_items=unrecognized_response,
        )
