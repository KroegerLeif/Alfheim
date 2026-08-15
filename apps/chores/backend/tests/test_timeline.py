import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_chore_completion_timeline(client: AsyncClient):
    headers = {"X-Household-ID": str(uuid.uuid4())}

    # 1. Create a chore template
    template_resp = await client.post(
        "/api/v1/chores/templates",
        json={"name": "Sweep Floor", "description": "Clean kitchen floor", "points": 15},
        headers=headers,
    )
    assert template_resp.status_code == 201
    template = template_resp.json()
    template_id = template["id"]

    # 2. Get today's chores (triggers instance generation)
    today_resp = await client.get("/api/v1/chores/today", headers=headers)
    assert today_resp.status_code == 200
    instances = today_resp.json()
    assert len(instances) >= 1
    target_instance = next(i for i in instances if i["template_id"] == template_id)

    # 3. Complete the chore instance
    complete_resp = await client.post(
        f"/api/v1/chores/instances/{target_instance['id']}/complete",
        json={"completed_by_name": "Test User"},
        headers=headers,
    )
    assert complete_resp.status_code == 200

    # 4. Fetch the timeline for the template
    timeline_resp = await client.get(f"/api/v1/chores/templates/{template_id}/timeline", headers=headers)
    assert timeline_resp.status_code == 200
    timeline = timeline_resp.json()
    assert len(timeline) == 1
    history_item = timeline[0]
    assert history_item["template_id"] == template_id
    assert history_item["instance_id"] == target_instance["id"]
    assert history_item["points_awarded"] == 15
    assert history_item["completed_by_name"] == "Test User"
