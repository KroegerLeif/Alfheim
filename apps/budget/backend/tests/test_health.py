import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_healthz_endpoint(client: AsyncClient):
    """Verify healthz endpoint returns HTTP 200 and status ok."""
    response = await client.get("/healthz")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "service" in payload


@pytest.mark.asyncio
async def test_metrics_endpoint(client: AsyncClient):
    """Verify metrics endpoint returns HTTP 200 and metrics payload."""
    response = await client.get("/metrics")
    assert response.status_code == 200
    payload = response.json()
    assert payload["metrics"] == "ok"
