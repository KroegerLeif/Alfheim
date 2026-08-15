import logging
import os
import uuid
from collections.abc import Sequence

import httpx
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.exceptions import (
    ShoppingItemNotFoundError,
    ShoppingListNotFoundError,
    ShoppingListProtectedError,
)
from src.features.history.service import ShoppingHistoryService
from src.features.shopping_lists.clients import PantryClient
from src.features.shopping_lists.models import ShoppingItem, ShoppingList
from src.features.shopping_lists.schemas import (
    PushItemPayload,
    ShoppingItemCreate,
    ShoppingItemUpdate,
    ShoppingListCreate,
    SyncToPantryResponse,
    UnrecognizedShoppingItem,
)

logger = logging.getLogger(__name__)


class ShoppingListService:
    """Service class encapsulating business operations for Shopping Lists.

    Auto-provisioning rules enforced on every get_lists() call:
      1. Personal List  — one per user (owner_id), identified by is_personal=True.
                          Persists across all households the user belongs to.
                          Name pattern: "{username} - Liste" (i18n suffix appended by backend).
      2. Household List — one per home_id, identified by is_default=True.
                          Shared with every member of the household.
                          Name: "Haushalt".
    Both list types are non-deletable (guarded in delete_list).
    """

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _personal_list_name(username: str | None, user_id: uuid.UUID) -> str:
        """Build a deterministic Personal List display name.

        Falls back to a UUID-derived short name when the username claim is absent or non-string.
        The suffix ' - Liste' corresponds to the i18n key shopping.personalListSuffix.
        """
        label = username.strip() if isinstance(username, str) and username.strip() else str(user_id)[:8]
        if label.startswith("NAVIGATION.") or "NAVIGATION" in label.upper():
            label = "Personal"
        return f"{label} - Liste"

    @staticmethod
    async def _ensure_personal_list(
        session: AsyncSession,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
        username: str | None,
    ) -> ShoppingList:
        """Return the caller's Personal List, creating it if it does not yet exist.

        The lookup is scoped to owner_id only — the Personal List deliberately
        ignores home_id so it follows the user across households.
        """
        stmt = select(ShoppingList).where(
            ShoppingList.owner_id == owner_id,
            ShoppingList.is_personal == True,  # noqa: E712
        )
        result = await session.exec(stmt)
        personal = result.first()

        if not personal:
            personal = ShoppingList(
                name=ShoppingListService._personal_list_name(username, owner_id),
                home_id=home_id,
                owner_id=owner_id,
                is_personal=True,
                is_default=False,
            )
            session.add(personal)
            await session.commit()
            await session.refresh(personal)
        else:
            if personal.name.startswith("NAVIGATION.") or "NAVIGATION" in personal.name.upper():
                personal.name = ShoppingListService._personal_list_name(username, owner_id)
                session.add(personal)
                await session.commit()
                await session.refresh(personal)

        if personal.items is None:
            personal.items = []

        return personal

    @staticmethod
    async def _ensure_household_list(
        session: AsyncSession,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> ShoppingList:
        """Return the shared Household List for a home_id, creating it if absent."""
        stmt = select(ShoppingList).where(
            ShoppingList.home_id == home_id,
            ShoppingList.is_default == True,  # noqa: E712
        )
        result = await session.exec(stmt)
        household = result.first()

        if not household:
            # Fallback check for existing list named "Haushalt"
            fallback_stmt = select(ShoppingList).where(
                ShoppingList.home_id == home_id,
                ShoppingList.name == "Haushalt",
            )
            fallback_res = await session.exec(fallback_stmt)
            legacy_household = fallback_res.first()
            if legacy_household:
                legacy_household.is_default = True
                legacy_household.is_personal = False
                session.add(legacy_household)
                await session.commit()
                await session.refresh(legacy_household)
                if legacy_household.items is None:
                    legacy_household.items = []
                return legacy_household

            household = ShoppingList(
                name="Haushalt",
                home_id=home_id,
                owner_id=owner_id,
                is_default=True,
                is_personal=False,
            )
            session.add(household)
            await session.commit()
            await session.refresh(household)

        if household.name.startswith("NAVIGATION.") or "NAVIGATION" in household.name.upper():
            household.name = "Haushalt"
            session.add(household)
            await session.commit()
            await session.refresh(household)

        if household.items is None:
            household.items = []

        return household

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    @staticmethod
    async def create_list(
        session: AsyncSession,
        payload: ShoppingListCreate,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> ShoppingList:
        """Create a new user-defined shopping list scoped to a home space."""
        name = payload.name.strip()
        if name.upper().startswith("NAVIGATION") or "NAVIGATION" in name.upper():
            name = "Custom List"

        db_list = ShoppingList(
            name=name,
            home_id=home_id,
            owner_id=owner_id,
            is_default=False,
            is_personal=False,
        )
        session.add(db_list)
        await session.commit()
        await session.refresh(db_list)
        if db_list.items is None:
            db_list.items = []
        return db_list

    @staticmethod
    async def get_lists(
        session: AsyncSession,
        home_id: uuid.UUID,
        owner_id: uuid.UUID | None = None,
        username: str | None = None,
        token: str | None = None,
    ) -> Sequence[ShoppingList]:
        """Retrieve all shopping lists visible to the caller.

        Returns in a guaranteed stable order:
          - Personal List  (caller's private list — always first)
          - Household Lists (one per enrolled household)
          - Custom Lists (additional user-created lists for these households)
        """
        effective_owner = owner_id or uuid.UUID("00000000-0000-0000-0000-000000000001")

        # 1. Fetch user's enrolled households from dashboard backend
        households = []
        if token:
            dashboard_url = os.getenv("DASHBOARD_BACKEND_URL", "http://dashboard-backend:8080")
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(
                        f"{dashboard_url}/api/v1/households/me", headers={"Authorization": token}, timeout=5.0
                    )
                    if response.status_code == 200:
                        households = response.json()
                except Exception as e:
                    logger.error(f"Failed to fetch user households in get_lists: {e}")

        # If we couldn't fetch households or it's empty, fall back to the active home_id
        if not households:
            households = [{"id": str(home_id), "name": "Haushalt"}]

        # 2. Ensure default lists exist for all enrolled households
        household_lists = []
        hh_ids = []
        for hh in households:
            try:
                hh_id = uuid.UUID(hh["id"])
                hh_ids.append(hh_id)
                hh_list = await ShoppingListService._ensure_household_list(session, hh_id, effective_owner)
                household_lists.append(hh_list)
            except Exception as e:
                logger.error(f"Error ensuring household list: {e}")

        # 3. Ensure personal list exists
        personal = await ShoppingListService._ensure_personal_list(session, home_id, effective_owner, username)

        # 4. Fetch remaining user-created lists for all enrolled households ordered by position
        stmt = (
            select(ShoppingList)
            .where(
                ShoppingList.home_id.in_(hh_ids),
                ShoppingList.is_default == False,  # noqa: E712
                col(ShoppingList.is_personal) == False,  # noqa: E712
            )
            .order_by(ShoppingList.position.asc(), ShoppingList.created_at.asc())
        )
        result = await session.exec(stmt)
        custom_lists = list(result.all())

        all_lists = [personal, *household_lists, *custom_lists]
        for lst in all_lists:
            if lst.items is None:
                lst.items = []

        return all_lists

    @staticmethod
    async def get_list(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> ShoppingList | None:
        """Retrieve a specific shopping list with boundary checks.

        Personal Lists are accessible from any household context — the home_id
        constraint is relaxed for is_personal=True lists.
        """
        stmt = select(ShoppingList).where(ShoppingList.id == list_id)
        result = await session.exec(stmt)
        db_list = result.first()

        if not db_list:
            raise ShoppingListNotFoundError(f"Shopping list with ID '{list_id}' not found.")

        # Allow access if the list belongs to this household, OR if it is the caller's personal list
        if db_list.home_id != home_id and not db_list.is_personal:
            raise ShoppingListNotFoundError(f"Shopping list with ID '{list_id}' not found.")

        return db_list

    @staticmethod
    async def delete_list(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete a user-created shopping list.

        Protected lists (is_default=True or is_personal=True) cannot be deleted.
        Raises ShoppingListProtectedError (→ HTTP 400 via global handler) on violation.
        """
        db_list = await ShoppingListService.get_list(session, list_id, home_id)

        if db_list.is_default:
            raise ShoppingListProtectedError("The Household List is protected and cannot be deleted.")
        if db_list.is_personal:
            raise ShoppingListProtectedError("The Personal List is protected and cannot be deleted.")

        await session.delete(db_list)
        await session.commit()
        return True

    @staticmethod
    async def reorder_lists(
        session: AsyncSession,
        list_ids: list[uuid.UUID],
        home_id: uuid.UUID,
    ) -> bool:
        """Update the position index of multiple user-defined shopping lists."""
        for index, list_id in enumerate(list_ids):
            stmt = select(ShoppingList).where(
                ShoppingList.id == list_id,
                ShoppingList.home_id == home_id,
                ShoppingList.is_default == False,  # noqa: E712
                col(ShoppingList.is_personal) == False,  # noqa: E712
            )
            res = await session.exec(stmt)
            db_list = res.first()
            if db_list:
                db_list.position = index
                session.add(db_list)
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
        # Validate list ownership / boundary
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
    async def push_item(
        session: AsyncSession,
        payload: PushItemPayload,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> ShoppingItem:
        """Push an out-of-stock item directly into a household shopping list.

        When no explicit list_id is supplied, the item lands in the Household List
        (is_default=True) for the active home_id, falling back to the first list.
        """
        list_id = payload.list_id
        if list_id:
            await ShoppingListService.get_list(session, list_id, home_id)
        else:
            # Prefer the shared Household List for cross-service pushes
            stmt = select(ShoppingList).where(
                ShoppingList.home_id == home_id,
                ShoppingList.is_default == True,  # noqa: E712
            )
            result = await session.exec(stmt)
            household = result.first()
            if household:
                list_id = household.id
            else:
                # Fallback: first list in scope
                lists = await ShoppingListService.get_lists(session, home_id, owner_id)
                list_id = lists[0].id

        db_item = ShoppingItem(
            list_id=list_id,
            name=payload.name.strip(),
            brand=payload.brand.strip() if payload.brand else None,
            barcode=payload.barcode.strip() if payload.barcode else None,
            quantity=payload.quantity,
            unit=payload.unit.strip().lower(),
            is_auto_generated=True,
            product_id=payload.product_id,
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
        token: str | None = None,
    ) -> list[ShoppingItem]:
        """Fetch low stock items from Pantry and merge them into the list if not already active."""
        # 1. Validate list ownership
        await ShoppingListService.get_list(session, list_id, home_id)

        # 2. Query pantry integration
        client = PantryClient()
        low_stock = await client.fetch_low_stock_items(token=token, household_id=home_id)

        # 3. Retrieve all currently active (uncompleted) items in the shopping list
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
    ) -> SyncToPantryResponse:
        """Push checked-off items in bulk to the Pantry, updating sync state and histories."""
        # 1. Validate list ownership
        await ShoppingListService.get_list(session, list_id, home_id)

        # 2. Fetch completed but unsynced items
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

        # 3. Format bulk payload for Pantry service
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

        # 4. Post to Pantry bulk add
        client = PantryClient()
        sync_result = await client.bulk_add_items(items=bulk_payload, token=token, household_id=home_id)

        success_map = {
            uuid.UUID(x["shopping_item_id"]): uuid.UUID(x["product_id"])
            for x in sync_result.get("successful_items", [])
        }
        unrecognized_list = sync_result.get("unrecognized_items", [])

        # 5. Process updates in Shopping DB
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
