import json
import pathlib

import anyio
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.equipment.models import Equipment, EquipmentScope


async def seed_default_equipment(session: AsyncSession) -> None:
    """Ensure standard system-level equipment entries exist.

    Loads equipment dynamically from default_equipment.json on application startup.
    Idempotent: skips any name that already exists as a system-scoped entry.
    """
    config_path = anyio.Path(pathlib.Path(__file__).parent / "default_equipment.json")
    if not await config_path.exists():
        return

    try:
        content = await config_path.read_text()
        default_equipment = json.loads(content)
    except Exception as e:
        print(f"Failed to load default equipment config: {e}")
        return

    for item in default_equipment:
        name = item["name"]
        category = item.get("category")

        stmt = select(Equipment).where(
            Equipment.scope == EquipmentScope.SYSTEM,
            Equipment.name == name,
        )
        res = await session.exec(stmt)
        if not res.first():
            equipment = Equipment(
                scope=EquipmentScope.SYSTEM,
                name=name,
                category=category,
                home_id=None,
                owner_user_id=None,
            )
            session.add(equipment)
    await session.commit()
