package mcp

import "testing"

func TestClientPool_ReusesClientPerEndpoint(t *testing.T) {
	pool := NewClientPool()

	a := pool.Get("http://pantry-backend:8000/mcp")
	b := pool.Get("http://pantry-backend:8000/mcp")
	c := pool.Get("http://chores-backend:8000/mcp")

	if a != b {
		t.Errorf("expected the same client instance for the same endpoint URL")
	}
	if a == c {
		t.Errorf("expected different client instances for different endpoint URLs")
	}
}
