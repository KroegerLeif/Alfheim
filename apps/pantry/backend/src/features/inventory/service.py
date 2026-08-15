import uuid
from collections.abc import Sequence
from datetime import UTC

from sqlalchemy.exc import IntegrityError
from sqlmodel import col, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.features.inventory.exceptions import IncompatibleUnitsError, InsufficientStockError, InventoryError
from src.features.inventory.models import InventoryLedger, InventoryState, InventoryTransactionType
from src.features.inventory.schemas import BulkAddInventoryPayload, BulkAddResponse, InventoryTransactionCreate
from src.features.locations.models import Location
from src.features.products.models import Product


class InventoryService:
    """Service class encapsulating async database operations for Inventory Tracking."""

    @staticmethod
    async def create_transaction(
        session: AsyncSession,
        payload: InventoryTransactionCreate,
        home_id: uuid.UUID,
    ) -> InventoryLedger:
        """Create a new physical inventory transaction.

        Validates product and location bounds, parses and normalizes units using Pint,
        acquires a write-lock on the state cache row, calculates signed quantities,
        and saves both transaction log and state cache in an atomic ACID transaction.
        """
        # 1. Fetch and validate Product (must be global or owned by home space)
        product_stmt = select(Product).where(
            Product.id == payload.product_id,
            or_(Product.is_global, Product.home_id == home_id),
        )
        product_res = await session.exec(product_stmt)
        product = product_res.first()
        if not product:
            raise InventoryError(f"Product with ID '{payload.product_id}' not found or not authorized.")

        # 2. Fetch and validate Location (must be system location or owned by home space)
        location_stmt = select(Location).where(
            Location.id == payload.location_id,
            or_(Location.is_system, Location.home_id == home_id),
        )
        location_res = await session.exec(location_stmt)
        location = location_res.first()
        if not location:
            raise InventoryError(f"Location with ID '{payload.location_id}' not found or not authorized.")

        # 3. Pint-based Unit Compatibility & Normalization Check
        from pint import DimensionalityError

        from src.features.inventory.units import ureg

        try:
            input_quantity = ureg.Quantity(payload.quantity_input, payload.unit_input)
            product_base_qty = ureg.Quantity(1.0, product.base_unit)

            if not input_quantity.is_compatible_with(product_base_qty):
                raise IncompatibleUnitsError(
                    f"Unit '{payload.unit_input}' is dimensionally incompatible with "
                    f"product base unit '{product.base_unit}'."
                )

            # Normalize magnitude to product base unit
            normalized_qty = input_quantity.to(product.base_unit).magnitude
        except (DimensionalityError, ValueError) as e:
            raise IncompatibleUnitsError(
                f"Unit '{payload.unit_input}' is dimensionally incompatible with "
                f"product base unit '{product.base_unit}': {e}"
            ) from e

        # 4. Lock corresponding InventoryState row to prevent write race conditions
        state_stmt = select(InventoryState).where(
            InventoryState.product_id == payload.product_id,
            InventoryState.location_id == payload.location_id,
        )

        if payload.batch_code is not None:
            state_stmt = state_stmt.where(InventoryState.batch_code == payload.batch_code)
        else:
            state_stmt = state_stmt.where(InventoryState.batch_code.is_(None))  # type: ignore

        if payload.expiration_date is not None:
            state_stmt = state_stmt.where(InventoryState.expiration_date == payload.expiration_date)
        else:
            state_stmt = state_stmt.where(InventoryState.expiration_date.is_(None))  # type: ignore

        # SELECT FOR UPDATE acquired for lock safety
        state_stmt = state_stmt.with_for_update()
        state_res = await session.exec(state_stmt)
        state_record = state_res.first()

        current_qty = state_record.quantity if state_record else 0.0

        # 5. Determine signed quantities and target stock level
        if payload.transaction_type in (InventoryTransactionType.OUT, InventoryTransactionType.WASTE):
            ledger_qty = -normalized_qty
            new_qty = current_qty + ledger_qty
        elif payload.transaction_type == InventoryTransactionType.IN:
            ledger_qty = normalized_qty
            new_qty = current_qty + ledger_qty
        elif payload.transaction_type == InventoryTransactionType.RECONCILIATION:
            # Reconciliation sets the absolute stock level
            ledger_qty = normalized_qty - current_qty
            new_qty = normalized_qty
        else:
            raise InventoryError(f"Unsupported transaction type: '{payload.transaction_type}'")

        # 6. Prevent negative stock levels (with epsilon handling for float precision)
        if new_qty < -1e-9:
            raise InsufficientStockError(
                f"Insufficient stock for product '{product.name}' in location '{location.name}'. "
                f"Requested change results in {new_qty} {product.base_unit} (current: {current_qty} {product.base_unit})."
            )

        # 7. Update or delete state cache row
        if state_record:
            if abs(new_qty) < 1e-9:
                # If quantity reaches exactly 0, physically delete from cache table
                await session.delete(state_record)
            else:
                state_record.quantity = new_qty
                session.add(state_record)
        else:
            # Create new cache entry if not zero
            if abs(new_qty) >= 1e-9:
                state_record = InventoryState(
                    product_id=payload.product_id,
                    location_id=payload.location_id,
                    quantity=new_qty,
                    batch_code=payload.batch_code,
                    expiration_date=payload.expiration_date,
                )
                session.add(state_record)

        # 8. Create immutable ledger record
        ledger_entry = InventoryLedger(
            product_id=payload.product_id,
            location_id=payload.location_id,
            transaction_type=payload.transaction_type,
            quantity=ledger_qty,
            quantity_input=payload.quantity_input,
            unit_input=payload.unit_input,
            batch_code=payload.batch_code,
            expiration_date=payload.expiration_date,
            notes=payload.notes,
        )
        session.add(ledger_entry)

        # 9. Save all changes transactionally
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise InventoryError(f"Database error during transaction creation: {e}") from e

        await session.refresh(ledger_entry)
        return ledger_entry

    @staticmethod
    async def get_ledger_history(
        session: AsyncSession,
        home_id: uuid.UUID,
        product_id: uuid.UUID | None = None,
        location_id: uuid.UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[InventoryLedger]:
        """Retrieve historical transaction log entries, ensuring home space boundaries."""
        statement = (
            select(InventoryLedger)
            .join(Location, Location.id == InventoryLedger.location_id)
            .where(Location.home_id == home_id)
        )

        if product_id:
            statement = statement.where(InventoryLedger.product_id == product_id)
        if location_id:
            statement = statement.where(InventoryLedger.location_id == location_id)

        statement = statement.order_by(col(InventoryLedger.created_at).desc()).offset(offset).limit(limit)
        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def get_current_state(
        session: AsyncSession,
        home_id: uuid.UUID,
        product_id: uuid.UUID | None = None,
        location_id: uuid.UUID | None = None,
    ) -> Sequence[InventoryState]:
        """Retrieve real-time consolidated stock levels cache, ensuring home space boundaries."""
        statement = (
            select(InventoryState)
            .join(Location, Location.id == InventoryState.location_id)
            .where(Location.home_id == home_id)
        )

        if product_id:
            statement = statement.where(InventoryState.product_id == product_id)
        if location_id:
            statement = statement.where(InventoryState.location_id == location_id)

        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def get_low_stock_items(
        session: AsyncSession,
        home_id: uuid.UUID,
    ) -> list[dict]:
        """Evaluate current cached InventoryState against minimum_stock to find low-stock products.

        Uses a LEFT OUTER JOIN to include products with zero stock that have a minimum_stock > 0.
        """
        from sqlmodel import func

        # Subquery to aggregate total stock per product for the home
        subq = (
            select(InventoryState.product_id, func.sum(InventoryState.quantity).label("total_quantity"))
            .join(Location, InventoryState.location_id == Location.id)
            .where(Location.home_id == home_id)
            .group_by(InventoryState.product_id)
            .subquery()
        )

        # Query products where aggregated quantity is less than minimum_stock
        stmt = (
            select(Product, func.coalesce(subq.c.total_quantity, 0.0).label("current_stock"))
            .outerjoin(subq, Product.id == subq.c.product_id)
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
        from datetime import datetime

        today = datetime.now(UTC).date()

        # Base statement to select inventory state within target home locations
        base_stmt = (
            select(InventoryState)
            .join(Location, InventoryState.location_id == Location.id)
            .where(Location.home_id == home_id)
        )

        # 1. Expired: expiration_date is not NULL and <= today
        expired_stmt = base_stmt.where(
            InventoryState.expiration_date.is_not(None), InventoryState.expiration_date <= today
        )
        expired_res = await session.exec(expired_stmt)
        expired = expired_res.all()

        # 2. Valid: expiration_date is not NULL and > today (includes the sentinel 9999-12-31)
        valid_stmt = base_stmt.where(
            InventoryState.expiration_date.is_not(None), InventoryState.expiration_date > today
        )
        valid_res = await session.exec(valid_stmt)
        valid = valid_res.all()

        # 3. Untracked: expiration_date is NULL
        untracked_stmt = base_stmt.where(InventoryState.expiration_date.is_(None))
        untracked_res = await session.exec(untracked_stmt)
        untracked = untracked_res.all()

        return {
            "expired": expired,
            "valid": valid,
            "untracked": untracked,
        }

    @staticmethod
    async def bulk_add_items(
        session: AsyncSession,
        payload: "BulkAddInventoryPayload",
        home_id: uuid.UUID,
    ) -> "BulkAddResponse":
        """Process bulk addition of items from a shopping list into the pantry.

        Attempts to match items by barcode first (with OFF lookup), and falls back to
        exact name matches (case-insensitive) for items without barcodes. Adds matched
        items to the 'Backlog' system location and returns unrecognized items with
        standardized translatable i18n reasons.
        """
        from sqlmodel import func

        from src.features.inventory.schemas import (
            BulkAddSuccessfulItem,
            BulkAddUnrecognizedItem,
        )
        from src.features.products.service import ProductService

        # 1. Fetch system fallback location 'Backlog' for this home space
        fallback_stmt = select(Location).where(Location.home_id == home_id, Location.is_system == True)  # noqa: E712
        fallback_res = await session.exec(fallback_stmt)
        backlog_location = fallback_res.first()
        if not backlog_location:
            unrecognized = []
            for item in payload.items:
                unrecognized.append(
                    BulkAddUnrecognizedItem(
                        shopping_item_id=item.shopping_item_id,
                        name=item.name,
                        brand=item.brand,
                        barcode=item.barcode,
                        quantity=item.quantity,
                        unit=item.unit,
                        reason="pantry.error.system_location_missing",
                    )
                )
            return BulkAddResponse(successful_items=[], unrecognized_items=unrecognized)

        successful_items = []
        unrecognized_items = []

        for item in payload.items:
            product = None

            # Match 1: By barcode
            if item.barcode:
                try:
                    product = await ProductService.get_or_create_by_barcode(
                        session=session,
                        barcode=item.barcode,
                        home_id=home_id,
                    )
                except Exception:
                    product = None

            # Match 2: By exact name (case-insensitive) if barcode lookup did not match
            if not product:
                name_query = item.name.strip().lower()
                stmt = select(Product).where(
                    func.lower(Product.name) == name_query,
                    or_(Product.is_global == True, Product.home_id == home_id),  # noqa: E712
                )
                res = await session.exec(stmt)
                product = res.first()

            if not product:
                unrecognized_items.append(
                    BulkAddUnrecognizedItem(
                        shopping_item_id=item.shopping_item_id,
                        name=item.name,
                        brand=item.brand,
                        barcode=item.barcode,
                        quantity=item.quantity,
                        unit=item.unit,
                        reason="pantry.error.product_not_found",
                    )
                )
                continue

            try:
                # Create transaction payload inside try block to catch unit validation errors
                tx_payload = InventoryTransactionCreate(
                    product_id=product.id,
                    location_id=backlog_location.id,
                    transaction_type=InventoryTransactionType.IN,
                    quantity_input=item.quantity,
                    unit_input=item.unit,
                    notes="Synced in bulk from shopping app.",
                )
                await InventoryService.create_transaction(
                    session=session,
                    payload=tx_payload,
                    home_id=home_id,
                )
                successful_items.append(
                    BulkAddSuccessfulItem(
                        shopping_item_id=item.shopping_item_id,
                        product_id=product.id,
                        quantity_added=item.quantity,
                        unit=item.unit,
                    )
                )
            except Exception as e:
                # If transaction fails due to invalid units or Pint dimensional errors
                reason_code = "pantry.error.invalid_unit"
                if "dimension" in str(e).lower() or "incompatible" in str(e).lower():
                    reason_code = "pantry.error.incompatible_units"

                unrecognized_items.append(
                    BulkAddUnrecognizedItem(
                        shopping_item_id=item.shopping_item_id,
                        name=item.name,
                        brand=item.brand,
                        barcode=item.barcode,
                        quantity=item.quantity,
                        unit=item.unit,
                        reason=reason_code,
                    )
                )

        return BulkAddResponse(
            successful_items=successful_items,
            unrecognized_items=unrecognized_items,
        )
