import uuid
from typing import Optional, List, Sequence
from sqlmodel import select, and_, col
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import ShoppingListNotFoundError, ShoppingItemNotFoundError
from src.features.shopping_lists.models import ShoppingList, ShoppingItem
from src.features.shopping_lists.schemas import (
    ShoppingListCreate,
    ShoppingItemCreate,
    ShoppingItemUpdate,
    SyncToPantryResponse,
    UnrecognizedShoppingItem,
)
from src.features.shopping_lists.clients import PantryClient
from src.features.history.service import ShoppingHistoryService


class ShoppingListService:
    """Service class encapsulating business operations for Shopping Lists."""

    @staticmethod
    async def create_list(
        session: AsyncSession,
        payload: ShoppingListCreate,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> ShoppingList:
        """Create a new shopping list scoped to a home space."""
        db_list = ShoppingList(
            name=payload.name,
            home_id=home_id,
            owner_id=owner_id,
        )
        session.add(db_list)
        await session.commit()
        await session.refresh(db_list)
        return db_list

    @staticmethod
    async def get_lists(
        session: AsyncSession,
        home_id: uuid.UUID,
        owner_id: Optional[uuid.UUID] = None,
    ) -> Sequence[ShoppingList]:
        """Retrieve all shopping lists scoped to a home space."""
        stmt = select(ShoppingList).where(ShoppingList.home_id == home_id)
        result = await session.exec(stmt)
        lists = result.all()
        if not lists:
            # Auto-provision a default list named "Wocheneinkauf"
            default_list = ShoppingList(
                name="Wocheneinkauf",
                home_id=home_id,
                owner_id=owner_id or uuid.UUID("00000000-0000-0000-0000-000000000001"),
            )
            session.add(default_list)
            await session.commit()
            await session.refresh(default_list)
            
            # Re-fetch the lists
            result = await session.exec(stmt)
            lists = result.all()
        return lists

    @staticmethod
    async def get_list(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> Optional[ShoppingList]:
        """Retrieve a specific shopping list, validating home space bounds."""
        stmt = select(ShoppingList).where(
            ShoppingList.id == list_id,
            ShoppingList.home_id == home_id,
        )
        result = await session.exec(stmt)
        db_list = result.first()
        if not db_list:
            raise ShoppingListNotFoundError(f"Shopping list with ID '{list_id}' not found.")
        return db_list

    @staticmethod
    async def delete_list(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete a shopping list."""
        db_list = await ShoppingListService.get_list(session, list_id, home_id)
        await session.delete(db_list)
        await session.commit()
        return True

    @staticmethod
    async def add_item(
        session: AsyncSession,
        list_id: uuid.UUID,
        payload: ShoppingItemCreate,
        home_id: uuid.UUID,
    ) -> ShoppingItem:
        """Add a manual shopping item to a list."""
        # Validate list ownership
        await ShoppingListService.get_list(session, list_id, home_id)

        db_item = ShoppingItem(
            list_id=list_id,
            name=payload.name.strip(),
            brand=payload.brand.strip() if payload.brand else None,
            barcode=payload.barcode.strip() if payload.barcode else None,
            quantity=payload.quantity,
            unit=payload.unit.strip().lower(),
        )
        session.add(db_item)
        await session.commit()
        await session.refresh(db_item)
        return db_item

    @staticmethod
    async def update_item(
        session: AsyncSession,
        list_id: uuid.UUID,
        item_id: uuid.UUID,
        payload: ShoppingItemUpdate,
        home_id: uuid.UUID,
    ) -> ShoppingItem:
        """Update an existing item's quantity, unit, or completion status."""
        await ShoppingListService.get_list(session, list_id, home_id)

        stmt = select(ShoppingItem).where(
            ShoppingItem.id == item_id,
            ShoppingItem.list_id == list_id,
        )
        result = await session.exec(stmt)
        db_item = result.first()
        if not db_item:
            raise ShoppingItemNotFoundError(f"Shopping item with ID '{item_id}' not found.")

        # Partially update fields
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            if key == "name" and value:
                value = value.strip()
            elif key == "brand" and value:
                value = value.strip()
            elif key == "barcode" and value:
                value = value.strip()
            elif key == "unit" and value:
                value = value.strip().lower()
            setattr(db_item, key, value)

        session.add(db_item)
        await session.commit()
        await session.refresh(db_item)
        return db_item

    @staticmethod
    async def delete_item(
        session: AsyncSession,
        list_id: uuid.UUID,
        item_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete an item from a list."""
        await ShoppingListService.get_list(session, list_id, home_id)

        stmt = select(ShoppingItem).where(
            ShoppingItem.id == item_id,
            ShoppingItem.list_id == list_id,
        )
        result = await session.exec(stmt)
        db_item = result.first()
        if not db_item:
            raise ShoppingItemNotFoundError(f"Shopping item with ID '{item_id}' not found.")

        await session.delete(db_item)
        await session.commit()
        return True

    @staticmethod
    async def auto_import_low_stock(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
        token: Optional[str] = None,
    ) -> List[ShoppingItem]:
        """Fetch low stock items from Pantry and merge them into the list if not already active."""
        # 1. Validate list ownership
        db_list = await ShoppingListService.get_list(session, list_id, home_id)

        # 2. Query pantry integration
        client = PantryClient()
        low_stock = await client.fetch_low_stock_items(token=token)

        # 3. Retrieve all currently active (uncompleted) items in the shopping list
        active_items_stmt = select(ShoppingItem).where(
            ShoppingItem.list_id == list_id,
            ShoppingItem.is_completed == False,
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
        token: Optional[str] = None,
    ) -> SyncToPantryResponse:
        """Push checked-off items in bulk to the Pantry, updating sync state and histories."""
        # 1. Validate list ownership
        await ShoppingListService.get_list(session, list_id, home_id)

        # 2. Fetch completed but unsynced items
        stmt = select(ShoppingItem).where(
            ShoppingItem.list_id == list_id,
            ShoppingItem.is_completed == True,
            ShoppingItem.is_synced == False,
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

        # 3. Format bulk payload for Pantry service
        bulk_payload = []
        for item in completed_items:
            bulk_payload.append({
                "shopping_item_id": str(item.id),
                "name": item.name,
                "brand": item.brand,
                "barcode": item.barcode,
                "quantity": item.quantity,
                "unit": item.unit,
            })

        # 4. Post to Pantry bulk add
        client = PantryClient()
        sync_result = await client.bulk_add_items(items=bulk_payload, token=token)

        success_map = {
            uuid.UUID(x["shopping_item_id"]): uuid.UUID(x["product_id"])
            for x in sync_result.get("successful_items", [])
        }
        unrecognized_list = sync_result.get("unrecognized_items", [])

        # 5. Process updates in Shopping DB
        # For successful matches: mark as synced and save the resolved product_id
        for item in completed_items:
            if item.id in success_map:
                item.is_synced = True
                item.product_id = success_map[item.id]
                session.add(item)

            # Log to Bring-style selection history (log both successful and unrecognized purchases)
            # Scoped by home_id
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
