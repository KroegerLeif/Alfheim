import uuid

from src.core.database import async_session_factory
from src.features.equipment.models import EquipmentScope
from src.features.equipment.schemas import EquipmentCreate, EquipmentUpdate
from src.features.equipment.service import EquipmentService
from src.mcp.server import mcp


@mcp.tool()
async def list_equipment(
    household_id: str,
    user_id: str,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> str:
    """List equipment visible to the caller: system + their household's + their own entries.

    Parameters:
    - household_id: UUID string of the caller's household. Required for tenant isolation.
    - user_id: UUID string of the caller.
    - is_active: Optional filter for active/inactive equipment.
    - limit: Maximum number of entries to return (default 100).
    - offset: Number of records to skip (default 0).
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        async with async_session_factory() as session:
            items = await EquipmentService.list_equipment(
                session=session,
                home_id=home_uuid,
                user_id=user_uuid,
                is_active=is_active,
                limit=limit,
                offset=offset,
            )
            if not items:
                return "No equipment found."
            lines = [f"- {item.name} (ID: {item.id}, scope: {item.scope.value})" for item in items]
            return "\n".join(lines)
    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to list equipment: {str(e)}"


@mcp.tool()
async def create_equipment(
    household_id: str,
    user_id: str,
    name: str,
    category: str | None = None,
    scope: str = "household",
) -> str:
    """Create a new equipment entry scoped to the caller's household or the caller alone.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - name: Name of the equipment.
    - category: Optional free-text category tag.
    - scope: 'household' (default) or 'user'. System-scoped entries cannot be created via this tool.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        payload = EquipmentCreate(name=name, category=category, scope=EquipmentScope(scope))
        async with async_session_factory() as session:
            equipment = await EquipmentService.create_equipment(
                session=session,
                payload=payload,
                home_id=home_uuid,
                user_id=user_uuid,
            )
            return f"Success: Created equipment '{equipment.name}' with ID {equipment.id}."
    except ValueError as e:
        return f"Error: Failed to create equipment: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def update_equipment(
    household_id: str,
    user_id: str,
    equipment_id: str,
    name: str | None = None,
    category: str | None = None,
    is_active: bool | None = None,
) -> str:
    """Update an equipment entry the caller owns. System entries cannot be modified.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - equipment_id: UUID string of the equipment entry to update.
    - name: Optional new name.
    - category: Optional new category tag.
    - is_active: Optional new active status.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        eq_uuid = uuid.UUID(equipment_id)
        payload = EquipmentUpdate(name=name, category=category, is_active=is_active)
        async with async_session_factory() as session:
            equipment = await EquipmentService.update_equipment(
                session=session,
                equipment_id=eq_uuid,
                home_id=home_uuid,
                user_id=user_uuid,
                payload=payload,
            )
            if not equipment:
                return f"Equipment with ID {equipment_id} not found or not authorized."
            return f"Success: Updated equipment {equipment.id} (Name: '{equipment.name}')."
    except ValueError as e:
        return f"Error: Update failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def delete_equipment(household_id: str, user_id: str, equipment_id: str) -> str:
    """Delete an equipment entry the caller owns. System entries cannot be deleted.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    - equipment_id: UUID string of the equipment entry to delete.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        eq_uuid = uuid.UUID(equipment_id)
        async with async_session_factory() as session:
            deleted = await EquipmentService.delete_equipment(
                session=session,
                equipment_id=eq_uuid,
                home_id=home_uuid,
                user_id=user_uuid,
            )
            if not deleted:
                return f"Equipment with ID {equipment_id} not found or not authorized."
            return f"Success: Deleted equipment {equipment_id}."
    except ValueError as e:
        return f"Error: Deletion failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"
