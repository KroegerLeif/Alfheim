import json
import pathlib

import anyio
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.exercises.models import Exercise, ExerciseScope, MuscleGroup


async def seed_default_exercises(session: AsyncSession) -> None:
    """Ensure standard system-level exercise entries exist.

    Loads exercises dynamically from default_exercises.json on application startup.
    Idempotent: skips any name that already exists as a system-scoped entry.
    """
    config_path = anyio.Path(pathlib.Path(__file__).parent / "default_exercises.json")
    if not await config_path.exists():
        return

    try:
        content = await config_path.read_text()
        default_exercises = json.loads(content)
    except Exception as e:
        print(f"Failed to load default exercises config: {e}")
        return

    for item in default_exercises:
        name = item["name"]
        primary_muscle = MuscleGroup(item["primary_muscle"])
        secondary_muscles = (
            [MuscleGroup(m) for m in item["secondary_muscles"]] if item.get("secondary_muscles") else None
        )
        default_unit = item.get("default_unit", "kg")
        instructions = item.get("instructions")

        stmt = select(Exercise).where(
            Exercise.scope == ExerciseScope.SYSTEM,
            Exercise.name == name,
        )
        res = await session.exec(stmt)
        if not res.first():
            exercise = Exercise(
                scope=ExerciseScope.SYSTEM,
                name=name,
                primary_muscle=primary_muscle,
                secondary_muscles=secondary_muscles,
                equipment_id=None,
                default_unit=default_unit,
                instructions=instructions,
                home_id=None,
                owner_user_id=None,
            )
            session.add(exercise)
    await session.commit()
