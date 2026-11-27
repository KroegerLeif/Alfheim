package plugins

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"alfheim/go-shared/household"
)

// observingPlugin records enable state changes and can refuse them.
type observingPlugin struct {
	*testPlugin
	changes []EnableChange
	err     error
}

func (p *observingPlugin) PluginEnabledChanged(_ context.Context, c EnableChange) error {
	p.changes = append(p.changes, c)
	return p.err
}

func TestService_EnableObserverSeesChangesOnly(t *testing.T) {
	repo := newMemRepo()
	plugin := &observingPlugin{testPlugin: &testPlugin{typ: "testdouble"}}
	svc := newTestService(repo, plugin, testKey, "")
	ctx := WithCallerToken(context.Background(), "admin-token")

	for _, enabled := range []bool{false, true, true, false} {
		if _, err := svc.Save(ctx, hhA, "testdouble", UpdateRequest{Enabled: enabled}); err != nil {
			t.Fatal(err)
		}
	}
	if len(plugin.changes) != 2 || !plugin.changes[0].Enabled || plugin.changes[1].Enabled {
		t.Fatalf("expected enable then disable, got %+v", plugin.changes)
	}
	if plugin.changes[0].CallerToken != "admin-token" || plugin.changes[0].HouseholdID != hhA {
		t.Errorf("change misses the caller or household: %+v", plugin.changes[0])
	}
}

func TestService_EnableObserverErrorAbortsSave(t *testing.T) {
	repo := newMemRepo()
	plugin := &observingPlugin{testPlugin: &testPlugin{typ: "testdouble"}, err: errors.New("household down")}
	svc := newTestService(repo, plugin, testKey, "")
	_, err := svc.Save(context.Background(), hhA, "testdouble", UpdateRequest{Enabled: true})
	if !errors.Is(err, ErrLifecycle) {
		t.Fatalf("want ErrLifecycle, got %v", err)
	}
	if _, err := repo.Get(context.Background(), hhA, "testdouble"); !errors.Is(err, ErrNotConfigured) {
		t.Errorf("a refused enable must not be stored: %v", err)
	}
}

func TestHandler_EnableObserverGetsBearerAndMapsError(t *testing.T) {
	plugin := &observingPlugin{testPlugin: &testPlugin{typ: "testdouble"}, err: errors.New("down")}
	f := newFixture(t, func(r *memRepo, _ *testPlugin) *Service { return newTestService(r, plugin, testKey, "") })
	req := httptest.NewRequest(http.MethodPut, putPath, strings.NewReader(`{"enabled":true}`))
	req.Header.Set("X-Test-User", "admin-a")
	req.Header.Set(household.HouseholdHeader, hhA.String())
	req.Header.Set("Authorization", "Bearer admin-jwt")
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway || decode[map[string]map[string]string](t, rec)["detail"]["code"] != CodeLifecycle {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String())
	}
	if len(plugin.changes) != 1 || plugin.changes[0].CallerToken != "admin-jwt" {
		t.Errorf("the observer must get the admin's bearer token: %+v", plugin.changes)
	}
}

func TestBearerToken(t *testing.T) {
	for header, want := range map[string]string{
		"Bearer abc":  "abc",
		"bearer  xyz": "xyz",
		"Basic abc":   "",
		"":            "",
	} {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", header)
		if got := BearerToken(req); got != want {
			t.Errorf("%q: got %q want %q", header, got, want)
		}
	}
	if callerToken(context.Background()) != "" {
		t.Error("no token in a plain context")
	}
}
