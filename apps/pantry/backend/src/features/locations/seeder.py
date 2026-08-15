import json
import pathlib

import anyio
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import MOCK_HOME_ID, MOCK_USER_ID
from src.features.locations.models import Location


async def seed_default_locations(session: AsyncSession) -> None:
    """Ensure standard system-level physical locations exist for the mock home space.

    Loads locations dynamically from default_locations.json on application startup.
    """
    config_path = anyio.Path(pathlib.Path(__file__).parent / "default_locations.json")
    if not await config_path.exists():
        return

    try:
        content = await config_path.read_text()
        default_locations = json.loads(content)
    except Exception as e:
        print(f"Failed to load default locations config: {e}")
        return

    for item in default_locations:
        name = item["name"]
        description = item.get("description", "Default storage location.")
        is_system = item.get("is_system", False)

        # Check if a location with this name already exists for this home space
        stmt = select(Location).where(Location.home_id == MOCK_HOME_ID, Location.name == name)
        res = await session.exec(stmt)
        if not res.first():
            loc = Location(
                name=name,
                description=description,
                is_system=is_system,
                owner_id=MOCK_USER_ID,
                home_id=MOCK_HOME_ID,
            )
            session.add(loc)
    await session.commit()
