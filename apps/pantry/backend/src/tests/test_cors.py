import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cors_allowed_origin(client: AsyncClient):
    """Test that requests from an allowed origin receive CORS headers."""
    response = await client.get(
        "/api/v1/health",
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"


@pytest.mark.asyncio
async def test_cors_disallowed_origin(client: AsyncClient):
    """Test that requests from a disallowed origin do not receive CORS allow-origin header matching the origin."""
    response = await client.get(
        "/api/v1/health",
        headers={"Origin": "http://malicious-website.com"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") != "http://malicious-website.com"
