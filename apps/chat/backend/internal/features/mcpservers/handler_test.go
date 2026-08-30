package mcpservers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/chat/internal/features/mcpservers"
	"alfheim/chat/internal/shared/mcp"
)

func passthroughMiddleware(next http.Handler) http.Handler { return next }

type fakeDiagPool struct{}

func (f *fakeDiagPool) Get(url string) mcp.ToolCaller {
	return &fakeDiagToolCaller{}
}

type fakeDiagToolCaller struct{}

func (f *fakeDiagToolCaller) ListTools(ctx context.Context) ([]mcp.Tool, error) {
	return []mcp.Tool{{Name: "test_tool", Description: "Test tool"}}, nil
}

func (f *fakeDiagToolCaller) CallTool(ctx context.Context, toolName string, arguments map[string]any) (string, bool, error) {
	return "ok", false, nil
}

func (f *fakeDiagToolCaller) Ping(ctx context.Context) mcp.DiagnosticResult {
	return mcp.DiagnosticResult{
		Reachable:  true,
		LatencyMs:  12,
		ToolsCount: 1,
		Tools:      []string{"test_tool"},
	}
}

func newTestRouter(svc mcpservers.Service) http.Handler {
	r := chi.NewRouter()
	handler := mcpservers.NewHandler(svc, &fakeDiagPool{})
	handler.RegisterRoutes(r, passthroughMiddleware)
	return r
}

func TestHandler_ListAndSetEnabled(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	if err := svc.SeedFromEnv(context.Background(), "pantry=http://pantry-backend:8000/mcp"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	router := newTestRouter(svc)

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/chat/mcp-servers", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", listRec.Code, listRec.Body.String())
	}
	var servers []mcpservers.ResponseDTO
	if err := json.Unmarshal(listRec.Body.Bytes(), &servers); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(servers) != 1 {
		t.Fatalf("expected 1 server, got %d", len(servers))
	}

	body, _ := json.Marshal(mcpservers.SetEnabledRequest{Enabled: false})
	patchReq := httptest.NewRequest(http.MethodPatch, "/api/v1/chat/mcp-servers/"+servers[0].ID, bytes.NewReader(body))
	patchRec := httptest.NewRecorder()
	router.ServeHTTP(patchRec, patchReq)

	if patchRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", patchRec.Code, patchRec.Body.String())
	}
	var updated mcpservers.ResponseDTO
	if err := json.Unmarshal(patchRec.Body.Bytes(), &updated); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if updated.Enabled {
		t.Errorf("expected the server to be disabled")
	}
}

func TestHandler_SetEnabled_NotFound(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	router := newTestRouter(svc)

	body, _ := json.Marshal(mcpservers.SetEnabledRequest{Enabled: true})
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/chat/mcp-servers/does-not-exist", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_Diagnostics(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	if err := svc.SeedFromEnv(context.Background(), "pantry=http://pantry-backend:8000/mcp"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	router := newTestRouter(svc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/mcp-servers/diagnostics", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var diags []mcpservers.ServerDiagnosticDTO
	if err := json.Unmarshal(rec.Body.Bytes(), &diags); err != nil {
		t.Fatalf("failed to decode diagnostics response: %v", err)
	}
	if len(diags) != 1 {
		t.Fatalf("expected 1 diagnostic item, got %d", len(diags))
	}
	if !diags[0].Reachable || diags[0].ToolsCount != 1 {
		t.Errorf("expected reachable server with 1 tool, got %+v", diags[0])
	}
}
