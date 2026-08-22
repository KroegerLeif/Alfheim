import asyncio
import logging
from unittest.mock import AsyncMock, patch

import pytest
from src.main import BACKGROUND_TASKS, app, handle_task_exception, lifespan


@pytest.mark.asyncio
async def test_lifespan_tracks_and_cleans_up_background_task():
    """Verify that lifespan initializes the background task, adds it to BACKGROUND_TASKS, and cleans it up."""
    # Mock init_db and telemetry shutdown to avoid DB / telemetry side effects
    with (
        patch("src.core.database.init_db", new_callable=AsyncMock),
        patch("src.core.telemetry.shutdown_telemetry"),
    ):
        BACKGROUND_TASKS.clear()
        async with lifespan(app):
            # Verify background task is registered
            assert len(BACKGROUND_TASKS) >= 1
            task = next(iter(BACKGROUND_TASKS))
            assert not task.done()

        # After lifespan exits, task should be cancelled and discarded
        assert task.done()
        assert task.cancelled()
        assert len(BACKGROUND_TASKS) == 0


@pytest.mark.asyncio
async def test_handle_task_exception_logs_error(caplog):
    """Verify handle_task_exception logs task failures and removes the task from BACKGROUND_TASKS."""
    BACKGROUND_TASKS.clear()

    async def failing_task():
        raise RuntimeError("Unexpected failure in background task")

    task = asyncio.create_task(failing_task(), name="failing_test_task")
    BACKGROUND_TASKS.add(task)
    task.add_done_callback(handle_task_exception)

    with caplog.at_level(logging.ERROR):
        with pytest.raises(RuntimeError, match="Unexpected failure in background task"):
            await task

    assert task not in BACKGROUND_TASKS
    assert (
        "Background task failing_test_task failed with exception: Unexpected failure in background task" in caplog.text
    )


@pytest.mark.asyncio
async def test_handle_task_exception_cancelled():
    """Verify handle_task_exception handles task cancellation gracefully."""
    BACKGROUND_TASKS.clear()

    async def long_running_task():
        await asyncio.sleep(10)

    task = asyncio.create_task(long_running_task(), name="cancelled_test_task")
    BACKGROUND_TASKS.add(task)
    task.add_done_callback(handle_task_exception)

    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert task not in BACKGROUND_TASKS


@pytest.mark.asyncio
async def test_handle_task_exception_successful_task():
    """Verify handle_task_exception discards completed tasks without logging errors."""
    BACKGROUND_TASKS.clear()

    async def successful_task():
        return "success"

    task = asyncio.create_task(successful_task(), name="successful_test_task")
    BACKGROUND_TASKS.add(task)
    task.add_done_callback(handle_task_exception)

    res = await task
    assert res == "success"
    assert task not in BACKGROUND_TASKS
