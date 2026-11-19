package apps_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/dashboard/internal/features/apps"
)

func serveEnabledApps(t *testing.T, enabled apps.EnabledApps, authMw func(http.Handler) http.Handler) *httptest.ResponseRecorder {
	t.Helper()
	r := chi.NewRouter()
	apps.NewEnabledAppsHandler(apps.EnabledCoreApps(enabled)).RegisterRoutes(r, authMw)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/apps/enabled", nil))
	return rec
}

func decodeEnabledApps(t *testing.T, rec *httptest.ResponseRecorder) []string {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected application/json, got %q", ct)
	}
	var body apps.EnabledAppsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return body.Apps
}

func passThrough(next http.Handler) http.Handler { return next }

func TestEnabledAppsHandler_LeanCoreHasNoChat(t *testing.T) {
	got := decodeEnabledApps(t, serveEnabledApps(t, apps.ParseEnabledApps(""), passThrough))
	if !slices.Equal(got, []string{"household"}) {
		t.Errorf("expected only household in the Lean Core, got %v", got)
	}
}

func TestEnabledAppsHandler_ListsEnabledOptionalApps(t *testing.T) {
	got := decodeEnabledApps(t, serveEnabledApps(t, apps.ParseEnabledApps("pantry, CHAT"), passThrough))
	if !slices.Contains(got, "chat") || !slices.Contains(got, "pantry") || slices.Contains(got, "budget") {
		t.Errorf("expected pantry and chat but not budget, got %v", got)
	}
}

func TestEnabledAppsHandler_AllAppsListsEveryRegistryEntry(t *testing.T) {
	got := decodeEnabledApps(t, serveEnabledApps(t, apps.AllApps(), passThrough))
	if len(got) != len(apps.CoreApps) {
		t.Errorf("expected %d apps, got %v", len(apps.CoreApps), got)
	}
}

func TestEnabledAppsHandler_RequiresAuth(t *testing.T) {
	deny := func(http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		})
	}
	if rec := serveEnabledApps(t, apps.AllApps(), deny); rec.Code != http.StatusUnauthorized {
		t.Errorf("expected the auth middleware to guard the route, got %d", rec.Code)
	}
}
