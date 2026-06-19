import uuid
from typing import Optional, Sequence
from sqlalchemy.exc import IntegrityError
from sqlmodel import select, or_, col
from sqlmodel.ext.asyncio.session import AsyncSession

from src.features.products.models import Product
from src.features.locations.models import Location
from src.features.inventory.models import InventoryTransactionType, InventoryLedger, InventoryState
from src.features.inventory.schemas import InventoryTransactionCreate
from src.features.inventory.exceptions import InventoryError, IncompatibleUnitsError, InsufficientStockError


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
            raise InventoryError(
                f"Product with ID '{payload.product_id}' not found or not authorized."
            )

        # 2. Fetch and validate Location (must be system location or owned by home space)
        location_stmt = select(Location).where(
            Location.id == payload.location_id,
            or_(Location.is_system, Location.home_id == home_id),
        )
        location_res = await session.exec(location_stmt)
        location = location_res.first()
        if not location:
            raise InventoryError(
                f"Location with ID '{payload.location_id}' not found or not authorized."
            )

        # 3. Pint-based Unit Compatibility & Normalization Check
        from src.features.inventory.units import ureg
        from pint import DimensionalityError

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
        product_id: Optional[uuid.UUID] = None,
        location_id: Optional[uuid.UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[InventoryLedger]:
        """Retrieve historical transaction log entries, ensuring home space boundaries."""
        statement = (
            select(InventoryLedger)
            .join(Product, Product.id == InventoryLedger.product_id)
            .where(or_(Product.is_global, Product.home_id == home_id))
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
        product_id: Optional[uuid.UUID] = None,
        location_id: Optional[uuid.UUID] = None,
    ) -> Sequence[InventoryState]:
        """Retrieve real-time consolidated stock levels cache, ensuring home space boundaries."""
        statement = (
            select(InventoryState)
            .join(Product, Product.id == InventoryState.product_id)
            .where(or_(Product.is_global, Product.home_id == home_id))
        )

        if product_id:
            statement = statement.where(InventoryState.product_id == product_id)
        if location_id:
            statement = statement.where(InventoryState.location_id == location_id)

        result = await session.exec(statement)
        return result.all()
