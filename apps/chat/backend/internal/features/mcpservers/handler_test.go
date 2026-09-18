package mcpservers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/chat/internal/features/mcpservers"
	"alfheim/chat/internal/shared/householdclient"
	"alfheim/chat/internal/shared/mcp"
	"alfheim/chat/internal/shared/middleware"
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

// withScope injects an authenticated caller with the given household role.
func withScope(role householdclient.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, &middleware.UserClaims{Subject: "user-1", AccessToken: "tok-1"})
			ctx = middleware.ContextWithHousehold(ctx, &middleware.HouseholdContext{HouseholdID: uuid.MustParse("11111111-1111-1111-1111-111111111111"), Role: role, Subject: "user-1"})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func newTestRouter(svc mcpservers.Service) http.Handler {
	r := chi.NewRouter()
	handler := mcpservers.NewHandler(svc, &fakeDiagPool{})
	handler.RegisterRoutes(r, withScope(householdclient.RoleOwner))
	return r
}

func TestHandler_SetEnabled_RequiresOwnerOrAdmin(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	if err := svc.SeedFromEnv(context.Background(), "pantry=http://pantry-backend:8000/mcp"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	servers, _ := svc.List(context.Background())

	for _, tc := range []struct {
		name string
		mw   func(http.Handler) http.Handler
		want int
	}{
		{"member", withScope(householdclient.RoleMember), http.StatusForbidden},
		{"guest", withScope(householdclient.RoleGuest), http.StatusForbidden},
		{"no household context", passthroughMiddleware, http.StatusForbidden},
		{"admin", withScope(householdclient.RoleAdmin), http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := chi.NewRouter()
			mcpservers.NewHandler(svc, &fakeDiagPool{}).RegisterRoutes(r, tc.mw)
			body, _ := json.Marshal(mcpservers.SetEnabledRequest{Enabled: true})
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/chat/mcp-servers/"+servers[0].ID, bytes.NewReader(body))
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("expected %d, got %d: %s", tc.want, rec.Code, rec.Body.String())
			}
		})
	}
}

// credsRecordingPool records the caller credentials each Ping was made with.
type credsRecordingPool struct{ seen []mcp.CallerCredentials }

func (p *credsRecordingPool) Get(url string) mcp.ToolCaller { return &credsRecordingCaller{pool: p} }

type credsRecordingCaller struct{ pool *credsRecordingPool }

func (c *credsRecordingCaller) ListTools(ctx context.Context) ([]mcp.Tool, error) { return nil, nil }
func (c *credsRecordingCaller) CallTool(ctx context.Context, n string, a map[string]any) (string, bool, error) {
	return "", false, nil
}
func (c *credsRecordingCaller) Ping(ctx context.Context) mcp.DiagnosticResult {
	creds, _ := mcp.CallerCredentialsFrom(ctx)
	c.pool.seen = append(c.pool.seen, creds)
	return mcp.DiagnosticResult{Reachable: true}
}

func TestHandler_Diagnostics_ForwardsCallerCredentials(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	if err := svc.SeedFromEnv(context.Background(), "pantry=http://pantry-backend:8000/mcp"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	pool := &credsRecordingPool{}
	r := chi.NewRouter()
	mcpservers.NewHandler(svc, pool).RegisterRoutes(r, withScope(householdclient.RoleMember))

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/chat/mcp-servers/diagnostics", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if len(pool.seen) != 1 || pool.seen[0].AccessToken != "tok-1" || pool.seen[0].HouseholdID != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("expected forwarded caller credentials, got %+v", pool.seen)
	}
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
