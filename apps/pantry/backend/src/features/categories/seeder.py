import json
import pathlib

import anyio
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.features.categories.models import Category


async def seed_default_categories(session: AsyncSession) -> None:
    """Ensure standard system-level global categories exist.

    Loads categories dynamically from default_categories.json on application startup.
    """
    config_path = anyio.Path(pathlib.Path(__file__).parent / "default_categories.json")
    if not await config_path.exists():
        return

    try:
        content = await config_path.read_text()
        default_categories = json.loads(content)
    except Exception as e:
        print(f"Failed to load default categories config: {e}")
        return

    for item in default_categories:
        name = item["name"]
        description = item.get("description", f"Global system category for {name.lower()}.")

        stmt = select(Category).where(Category.name == name, Category.is_global)
        res = await session.exec(stmt)
        if not res.first():
            cat = Category(
                name=name,
                description=description,
                is_global=True,
                owner_id=None,
                home_id=None,
            )
            session.add(cat)
    await session.commit()
