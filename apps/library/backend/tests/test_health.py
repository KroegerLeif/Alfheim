import httpx
import pytest
from src.main import app


@pytest.mark.asyncio
async def test_health_check():
    """Test the /health endpoint returns 200 OK and status ok."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_api_v1_health_check():
    """Test the /api/v1/health endpoint returns 200 OK and status ok."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
