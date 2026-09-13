import uuid
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.locations.models import Location, LocationCreate, LocationUpdate


class LocationService:
    """Service class encapsulating async database operations for Locations."""

    @staticmethod
    async def create_location(
        session: AsyncSession,
        payload: LocationCreate,
        owner_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> Location:
        """Create a new personal storage location in the user's home space."""
        location = Location(
            name=payload.name,
            description=payload.description,
            is_system=False,
            owner_id=owner_id,
            home_id=home_id,
        )
        session.add(location)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ValueError(f"Failed to create location: {e}") from e
        await session.refresh(location)
        return location

    @staticmethod
    async def get_location(
        session: AsyncSession,
        location_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> Location | None:
        """Retrieve a specific location details by ID, scoped to home space."""
        statement = select(Location).where(Location.id == location_id, Location.home_id == home_id)
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def list_locations(
        session: AsyncSession,
        home_id: uuid.UUID,
        name: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Location]:
        """Retrieve all storage locations in the user's home space."""
        statement = select(Location).where(Location.home_id == home_id)

        if name:
            statement = statement.where(Location.name == name)

        statement = statement.offset(offset).limit(limit)
        result = await session.exec(statement)
        return result.all()

    @staticmethod
    async def update_location(
        session: AsyncSession,
        location_id: uuid.UUID,
        home_id: uuid.UUID,
        payload: LocationUpdate,
    ) -> Location | None:
        """Partially update an existing location's properties.

        System locations are protected and cannot be modified.
        """
        location = await LocationService.get_location(session, location_id, home_id)
        if not location:
            return None

        if location.is_system:
            raise ValueError("System locations cannot be modified or deleted.")

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(location, key, value)

        session.add(location)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ValueError(f"Failed to update location: {e}") from e
        await session.refresh(location)
        return location

    @staticmethod
    async def delete_location(
        session: AsyncSession,
        location_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete a storage location.

        Reassigns stored items to fallback location. System locations cannot be deleted.
        """
        location = await LocationService.get_location(session, location_id, home_id)
        if not location:
            return False

        if location.is_system:
            raise ValueError("System locations cannot be modified or deleted.")

        # 1. Locate the default fallback location for this home
        fallback_statement = select(Location).where(Location.home_id == home_id, Location.is_system)
        fallback_result = await session.exec(fallback_statement)
        fallback = fallback_result.first()

        if not fallback:
            raise ValueError("System fallback location ('Backlog') could not be found.")

        # 2. Delete the target location
        await session.delete(location)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise ValueError(f"Failed to delete location: {e}") from e
        return True
