import uuid
from datetime import date

from src.core.database import async_session_factory
from src.core.dependencies import MOCK_HOME_ID
from src.features.inventory.alert_service import AlertService
from src.features.inventory.exceptions import InventoryError
from src.features.inventory.schemas import InventoryTransactionCreate
from src.features.inventory.service import InventoryService
from src.mcp.server import mcp


@mcp.tool()
async def record_inventory_movement(
    product_id: str,
    location_id: str,
    transaction_type: str,
    quantity_input: float,
    unit_input: str,
    batch_code: str | None = None,
    expiration_date: str | None = None,
    notes: str | None = None,
) -> str:
    """Record a physical inventory movement (IN, OUT, WASTE, RECONCILIATION).

    Parameters:
    - product_id: UUID of the target product blueprint.
    - location_id: UUID of the storage location.
    - transaction_type: Type of movement ('in', 'out', 'waste', 'reconciliation').
    - quantity_input: Magnitude of quantity to log.
    - unit_input: Unit name (e.g. 'g', 'ml', 'piece', 'kg', 'pack').
    - batch_code: Optional batch/lot code for tracking.
    - expiration_date: Optional expiration date (format: YYYY-MM-DD).
    - notes: Optional text note detailing transaction reasons.
    """
    try:
        payload = InventoryTransactionCreate(
            product_id=uuid.UUID(product_id),
            location_id=uuid.UUID(location_id),
            transaction_type=transaction_type,
            quantity_input=quantity_input,
            unit_input=unit_input,
            batch_code=batch_code,
            expiration_date=date.fromisoformat(expiration_date) if expiration_date else None,
            notes=notes,
        )

        async with async_session_factory() as session:
            ledger = await InventoryService.create_transaction(
                session=session,
                payload=payload,
                home_id=MOCK_HOME_ID,
            )
            return (
                f"Success: Recorded {transaction_type.upper()} transaction {ledger.id}. "
                f"Normalized quantity committed: {ledger.quantity}."
            )

    except InventoryError as e:
        return f"Error: Inventory operation failed: {str(e)}"
    except ValueError as e:
        return f"Error: Invalid argument: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def get_current_inventory(
    product_id: str | None = None,
    location_id: str | None = None,
) -> str:
    """Retrieve the real-time cached inventory levels.

    Parameters:
    - product_id: Optional UUID to filter results by a specific product.
    - location_id: Optional UUID to filter results by a specific location.
    """
    try:
        p_uuid = uuid.UUID(product_id) if product_id else None
        l_uuid = uuid.UUID(location_id) if location_id else None

        async with async_session_factory() as session:
            states = await InventoryService.get_current_state(
                session=session,
                home_id=MOCK_HOME_ID,
                product_id=p_uuid,
                location_id=l_uuid,
            )

            if not states:
                return "No inventory items found matching the filter criteria."

            lines = []
            for state in states:
                batch_str = f" [Batch: {state.batch_code}]" if state.batch_code else ""
                expiry_str = f" [Expires: {state.expiration_date}]" if state.expiration_date else ""
                p_name = state.product.name if state.product else "Unknown"
                p_unit = state.product.base_unit if state.product else ""
                l_name = state.location.name if state.location else "Unknown"
                lines.append(
                    f"- Product: {p_name} (ID: {state.product_id}) | "
                    f"Location: {l_name} (ID: {state.location_id}) | "
                    f"Qty: {state.quantity} {p_unit}{batch_str}{expiry_str}"
                )
            return "\n".join(lines)

    except Exception as e:
        return f"Error: Failed to fetch inventory state: {str(e)}"


@mcp.tool()
async def get_low_stock_alerts() -> str:
    """List all products currently below their minimum stock thresholds."""
    try:
        async with async_session_factory() as session:
            low_stock_items = await AlertService.get_low_stock_items(
                session=session,
                home_id=MOCK_HOME_ID,
            )

            if not low_stock_items:
                return "All products are currently fully stocked above their minimum thresholds."

            lines = []
            for item in low_stock_items:
                prod = item["product"]
                lines.append(
                    f"- Product: {prod.name} (ID: {prod.id}) | "
                    f"Current Stock: {item['current_stock']} {prod.base_unit} | "
                    f"Min Threshold Required: {prod.minimum_stock} {prod.base_unit}"
                )
            return "\n".join(lines)

    except Exception as e:
        return f"Error: Failed to fetch low stock alerts: {str(e)}"


@mcp.tool()
async def get_inventory_expiration_summary() -> str:
    """Summarize inventory items grouped by their expiration status (Expired, Valid, Untracked)."""
    try:
        async with async_session_factory() as session:
            summary = await AlertService.get_expiration_summary(
                session=session,
                home_id=MOCK_HOME_ID,
            )

            lines = []

            # 1. Expired Items
            expired = summary.get("expired", [])
            lines.append(f"=== EXPIRED ITEMS ({len(expired)}) ===")
            if not expired:
                lines.append("None")
            for state in expired:
                lines.append(
                    f"- Product: {state.product.name} | Location: {state.location.name} | "
                    f"Qty: {state.quantity} {state.product.base_unit} | Expired on: {state.expiration_date}"
                )

            lines.append("")

            # 2. Valid Items (Active shelf-life)
            valid = summary.get("valid", [])
            lines.append(f"=== STOCK WITH VALID SHELF-LIFE ({len(valid)}) ===")
            if not valid:
                lines.append("None")
            for state in valid:
                date_str = (
                    "Sentinel (infinite)" if str(state.expiration_date) == "9999-12-31" else str(state.expiration_date)
                )
                lines.append(
                    f"- Product: {state.product.name} | Location: {state.location.name} | "
                    f"Qty: {state.quantity} {state.product.base_unit} | Expires: {date_str}"
                )

            lines.append("")

            # 3. Untracked Items
            untracked = summary.get("untracked", [])
            lines.append(f"=== UNTRACKED SHELF-LIFE ITEMS ({len(untracked)}) ===")
            if not untracked:
                lines.append("None")
            for state in untracked:
                lines.append(
                    f"- Product: {state.product.name} | Location: {state.location.name} | "
                    f"Qty: {state.quantity} {state.product.base_unit}"
                )

            return "\n".join(lines)

    except Exception as e:
        return f"Error: Failed to fetch expiration summary: {str(e)}"
