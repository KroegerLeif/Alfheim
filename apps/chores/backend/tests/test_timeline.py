import os
import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker

os.environ["TESTING"] = "true"

from src.main import app
from src.core.database import get_db_session

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
async_engine = create_async_engine(TEST_DB_URL, echo=False)
async_session = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db_session():
    async with async_session() as session:
        yield session


app.dependency_overrides[get_db_session] = override_get_db_session


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest.mark.asyncio
async def test_chore_completion_timeline():
    headers = {"X-Household-ID": str(uuid.uuid4())}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Create a chore template
        template_resp = await ac.post(
            "/api/v1/chores/templates",
            json={"name": "Sweep Floor", "description": "Clean kitchen floor", "points": 15},
            headers=headers,
        )
        assert template_resp.status_code == 201
        template = template_resp.json()
        template_id = template["id"]

        # 2. Get today's chores (triggers instance generation)
        today_resp = await ac.get("/api/v1/chores/today", headers=headers)
        assert today_resp.status_code == 200
        instances = today_resp.json()
        assert len(instances) >= 1
        target_instance = next(i for i in instances if i["template_id"] == template_id)

        # 3. Complete the chore instance
        complete_resp = await ac.post(
            f"/api/v1/chores/instances/{target_instance['id']}/complete",
            json={"completed_by_name": "Test User"},
            headers=headers,
        )
        assert complete_resp.status_code == 200

        # 4. Fetch the timeline for the template
        timeline_resp = await ac.get(f"/api/v1/chores/templates/{template_id}/timeline", headers=headers)
        assert timeline_resp.status_code == 200
        timeline = timeline_resp.json()
        assert len(timeline) == 1
        history_item = timeline[0]
        assert history_item["template_id"] == template_id
        assert history_item["instance_id"] == target_instance["id"]
        assert history_item["points_awarded"] == 15
        assert history_item["completed_by_name"] == "Test User"
