import uuid

from src.core.database import async_session_factory
from src.core.dependencies import MOCK_HOME_ID, MOCK_USER_ID
from src.features.locations.models import LocationCreate, LocationUpdate
from src.features.locations.service import LocationService
from src.mcp.server import mcp


@mcp.tool()
async def list_locations(
    name: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> str:
    """Retrieve all storage locations in the current home space.

    Parameters:
    - name: Optional exact name to filter locations.
    - limit: Maximum number of locations to return (default 100).
    - offset: Number of records to skip (default 0).
    """
    try:
        async with async_session_factory() as session:
            locations = await LocationService.list_locations(
                session=session,
                home_id=MOCK_HOME_ID,
                name=name,
                limit=limit,
                offset=offset,
            )

            if not locations:
                return "No storage locations found."

            lines = []
            for loc in locations:
                system_tag = " [System]" if loc.is_system else ""
                desc = f" ({loc.description})" if loc.description else ""
                lines.append(f"- {loc.name} (ID: {loc.id}){system_tag}{desc}")
            return "\n".join(lines)

    except Exception as e:
        return f"Error: Failed to list locations: {str(e)}"


@mcp.tool()
async def get_location(location_id: str) -> str:
    """Retrieve details of a specific storage location by ID.

    Parameters:
    - location_id: UUID string of the storage location.
    """
    try:
        loc_uuid = uuid.UUID(location_id)
        async with async_session_factory() as session:
            loc = await LocationService.get_location(
                session=session,
                location_id=loc_uuid,
                home_id=MOCK_HOME_ID,
            )

            if not loc:
                return f"Location with ID {location_id} not found or not authorized."

            system_tag = " [System]" if loc.is_system else ""
            desc = f"\nDescription: {loc.description}" if loc.description else ""
            return (
                f"Location: {loc.name}{system_tag}\n"
                f"ID: {loc.id}{desc}\n"
                f"Created: {loc.created_at} | Updated: {loc.updated_at}"
            )

    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to retrieve location: {str(e)}"


@mcp.tool()
async def create_location(
    name: str,
    description: str | None = None,
) -> str:
    """Create a new storage location inside the home space.

    Parameters:
    - name: Name of the physical storage location (e.g. 'Pantry Shelf B', 'Kitchen Freezer').
    - description: Optional details or notes describing the location.
    """
    try:
        payload = LocationCreate(name=name, description=description)
        async with async_session_factory() as session:
            loc = await LocationService.create_location(
                session=session,
                payload=payload,
                owner_id=MOCK_USER_ID,
                home_id=MOCK_HOME_ID,
            )
            return f"Success: Created location '{loc.name}' with ID {loc.id}."

    except ValueError as e:
        return f"Error: Failed to create location: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def update_location(
    location_id: str,
    name: str | None = None,
    description: str | None = None,
) -> str:
    """Update details of a custom storage location (System locations cannot be updated).

    Parameters:
    - location_id: UUID string of the location to update.
    - name: Optional new name of the location.
    - description: Optional new description/details of the location.
    """
    try:
        loc_uuid = uuid.UUID(location_id)
        payload = LocationUpdate(name=name, description=description)

        async with async_session_factory() as session:
            loc = await LocationService.update_location(
                session=session,
                location_id=loc_uuid,
                home_id=MOCK_HOME_ID,
                payload=payload,
            )

            if not loc:
                return f"Location with ID {location_id} not found or not authorized."

            return f"Success: Updated location {loc.id} (Name: '{loc.name}')."

    except ValueError as e:
        return f"Error: Update failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def delete_location(location_id: str) -> str:
    """Delete a custom storage location, moving any contents to 'Backlog' system location.

    Parameters:
    - location_id: UUID string of the storage location to delete.
    """
    try:
        loc_uuid = uuid.UUID(location_id)
        async with async_session_factory() as session:
            success = await LocationService.delete_location(
                session=session,
                location_id=loc_uuid,
                home_id=MOCK_HOME_ID,
            )

            if not success:
                return f"Location with ID {location_id} not found or not authorized."

            return f"Success: Deleted storage location {location_id} and reassigned items."

    except ValueError as e:
        return f"Error: Deletion failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"
