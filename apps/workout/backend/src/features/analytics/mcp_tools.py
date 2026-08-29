import uuid

from src.core.database import async_session_factory
from src.features.analytics import service
from src.mcp.server import mcp


@mcp.tool()
async def get_muscle_volume(household_id: str, user_id: str) -> str:
    """Get total training volume (reps x weight) per muscle group for the caller.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        async with async_session_factory() as session:
            entries = await service.get_muscle_volume(session, home_uuid, user_uuid)
            if not entries:
                return "No completed sets recorded yet."
            return "\n".join(f"- {muscle}: {volume:.1f} kg total volume" for muscle, volume in entries)
    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to compute muscle volume: {str(e)}"


@mcp.tool()
async def get_streaks(household_id: str, user_id: str) -> str:
    """Get the caller's current and longest consecutive-day workout streaks.

    Parameters:
    - household_id: UUID string of the caller's household.
    - user_id: UUID string of the caller.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        async with async_session_factory() as session:
            current, longest = await service.get_streaks(session, home_uuid, user_uuid)
            return f"Current streak: {current} day(s). Longest streak: {longest} day(s)."
    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to compute streaks: {str(e)}"


@mcp.tool()
async def get_leaderboard(household_id: str) -> str:
    """Get the household leaderboard ranked by total training volume.

    Parameters:
    - household_id: UUID string of the household.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        async with async_session_factory() as session:
            entries = await service.get_leaderboard(session, home_uuid)
            if not entries:
                return "No completed sessions recorded yet for this household."
            lines = [
                f"{i + 1}. User {uid}: {vol:.1f} kg total volume ({count} session(s))"
                for i, (uid, vol, count) in enumerate(entries)
            ]
            return "\n".join(lines)
    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to compute leaderboard: {str(e)}"
