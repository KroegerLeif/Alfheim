package plugins

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/go-shared/netguard"
)

type failingResolver struct{}

func (failingResolver) LookupNetIP(context.Context, string, string) ([]netip.Addr, error) {
	return nil, errors.New("no such host")
}

func save(t *testing.T, svc *Service, body UpdateRequest) {
	t.Helper()
	if _, err := svc.Save(context.Background(), hhA, "testdouble", body); err != nil {
		t.Fatalf("save: %v", err)
	}
}

func TestService_EncryptionUnavailableFailsClosed(t *testing.T) {
	f := newFixture(t, func(r *memRepo, p *testPlugin) *Service { return newTestService(r, p, nil, "") })
	rec := f.do(t, http.MethodPut, putPath, "admin-a", hhA, `{"enabled":true,"credentials":{"token":"x"}}`)
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), CodeEncryptionUnavailable) {
		t.Fatalf("credentials without a key: %d %s", rec.Code, rec.Body.String())
	}
	// Plugins without credentials still work, and the list says why secrets cannot be saved.
	if rec := f.do(t, http.MethodPut, putPath, "admin-a", hhA, `{"enabled":true}`); rec.Code != http.StatusOK {
		t.Fatalf("save without credentials: %d", rec.Code)
	}
	if list := decode[ListResponse](t, f.do(t, http.MethodGet, "/api/v1/integrations/plugins", "admin-a", hhA, "")); list.EncryptionAvailable {
		t.Fatal("encryption_available must be false without a key")
	}
}

func TestService_UnreadableCredentials(t *testing.T) {
	repo, plugin := newMemRepo(), &testPlugin{typ: "testdouble", health: Health{Status: StatusOK}}
	save(t, newTestService(repo, plugin, testKey, ""), UpdateRequest{Enabled: true, Credentials: &Credentials{"token": "t"}})
	ctx := context.Background()

	for name, svc := range map[string]*Service{
		"no key":       newTestService(repo, plugin, nil, ""),
		"rotated key":  NewService(repo, mustRegistry(plugin), mustCipher(testKey, "v2"), mustGuard(""), 0),
		"corrupt data": NewService(repo, mustRegistry(plugin), mustCipher(make([]byte, 32), "v1"), mustGuard(""), 0),
	} {
		view, err := svc.Test(ctx, hhA, "testdouble")
		if err != nil || view.Record.HealthStatus != StatusCredentialsUnavailable || view.Record.HealthDetail == "" {
			t.Errorf("%s: %+v %v", name, view.Record, err)
		}
		if _, err := svc.Instance(ctx, hhA, "testdouble"); err == nil {
			t.Errorf("%s: Instance must fail", name)
		}
	}
	if plugin.callCount() != 0 {
		t.Fatal("the plugin must not run without readable credentials")
	}
}

func mustRegistry(p Plugin) *Registry {
	r, err := NewRegistry(p)
	if err != nil {
		panic(err)
	}
	return r
}

func TestService_UnresolvableHostAndEmptyStatus(t *testing.T) {
	repo, plugin := newMemRepo(), &testPlugin{typ: "testdouble"}
	g, _ := netguard.NewWithResolver("", failingResolver{})
	svc := NewService(repo, mustRegistry(plugin), mustCipher(testKey, "v1"), g, 0)
	save(t, svc, UpdateRequest{Enabled: true, BaseURL: "https://ha.invalid"})
	if view, _ := svc.Test(context.Background(), hhA, "testdouble"); view.Record.HealthStatus != StatusUnreachable {
		t.Fatalf("unresolvable host: %+v", view.Record)
	}
	if _, err := svc.EnabledInstance(context.Background(), hhA, "testdouble"); err == nil || errors.Is(err, ErrHostNotAllowed) {
		t.Fatalf("unresolvable host instance: %v", err)
	}

	save(t, svc, UpdateRequest{Enabled: true})
	if view, _ := svc.Test(context.Background(), hhA, "testdouble"); view.Record.HealthStatus != StatusError {
		t.Fatalf("an empty plugin status must become error: %+v", view.Record)
	}
}

func TestService_InstanceAccess(t *testing.T) {
	ctx := context.Background()
	repo, plugin := newMemRepo(), &testPlugin{typ: "testdouble"}
	svc := newTestService(repo, plugin, testKey, "")

	if _, err := svc.Instance(ctx, hhA, "nope"); !errors.Is(err, ErrUnknownType) {
		t.Fatalf("unknown type: %v", err)
	}
	if on, err := svc.IsEnabled(ctx, hhA, "testdouble"); on || err != nil {
		t.Fatalf("unconfigured: %v %v", on, err)
	}
	if _, err := svc.IsEnabled(ctx, hhA, "nope"); !errors.Is(err, ErrUnknownType) {
		t.Fatalf("unknown type: %v", err)
	}

	save(t, svc, UpdateRequest{Enabled: false, BaseURL: "https://93.184.215.14", Credentials: &Credentials{"token": "t"}})
	if _, err := svc.EnabledInstance(ctx, hhA, "testdouble"); !errors.Is(err, ErrDisabled) {
		t.Fatalf("disabled: %v", err)
	}
	inst, err := svc.Instance(ctx, hhA, "testdouble")
	if err != nil || inst.Credentials["token"] != "t" || inst.Enabled || inst.HouseholdID != hhA {
		t.Fatalf("instance: %+v %v", inst, err)
	}

	save(t, svc, UpdateRequest{Enabled: true, BaseURL: "https://93.184.215.14"})
	if on, err := svc.IsEnabled(ctx, hhA, "testdouble"); !on || err != nil {
		t.Fatalf("enabled: %v %v", on, err)
	}
	if inst, err := svc.EnabledInstance(ctx, hhA, "testdouble"); err != nil || inst.Credentials["token"] != "t" {
		t.Fatalf("enabled instance: %+v %v", inst, err)
	}

	save(t, svc, UpdateRequest{Enabled: true, BaseURL: "http://192.168.1.10"})
	if _, err := svc.EnabledInstance(ctx, hhA, "testdouble"); !errors.Is(err, ErrHostNotAllowed) {
		t.Fatalf("private host: %v", err)
	}
	if _, err := svc.EnabledInstance(ctx, hhB, "testdouble"); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("other household: %v", err)
	}
	if _, ok := CapabilityOf[Plugin](svc.Registry(), "testdouble"); !ok {
		t.Fatal("registry must be reachable from the service")
	}
}

func TestService_RepositoryErrors(t *testing.T) {
	f := newFixture(t, nil)
	f.do(t, http.MethodPut, putPath, "admin-a", hhA, `{"enabled":true}`)
	f.repo.err = errors.New("db down")
	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/api/v1/integrations/plugins"},
		{http.MethodPut, putPath},
		{http.MethodPost, putPath + "/test"},
	} {
		rec := f.do(t, tc.method, tc.path, "admin-a", hhA, `{}`)
		if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "db down") {
			t.Errorf("%s %s: %d %s", tc.method, tc.path, rec.Code, rec.Body.String())
		}
	}
	ctx := context.Background()
	if _, err := f.svc.IsEnabled(ctx, hhA, "testdouble"); err == nil {
		t.Error("IsEnabled must surface repository errors")
	}
	if _, err := f.svc.EnabledInstance(ctx, hhA, "testdouble"); err == nil {
		t.Error("EnabledInstance must surface repository errors")
	}
}

func TestService_SaveHealthAfterRowRemoved(t *testing.T) {
	repo, plugin := newMemRepo(), &testPlugin{typ: "testdouble", health: Health{Status: StatusOK}}
	svc := newTestService(repo, plugin, testKey, "")
	save(t, svc, UpdateRequest{Enabled: true})
	failing := &vanishingRepo{memRepo: repo}
	svc.repo = failing
	if _, err := svc.Test(context.Background(), hhA, "testdouble"); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("health save on a removed row: %v", err)
	}
}

// vanishingRepo drops the row between the read and the health write.
type vanishingRepo struct{ *memRepo }

func (v *vanishingRepo) SaveHealth(context.Context, uuid.UUID, string, HealthResult) error {
	return ErrNotConfigured
}

func TestHandler_MissingHouseholdContext(t *testing.T) {
	h := NewHandler(newTestService(newMemRepo(), &testPlugin{typ: "testdouble"}, testKey, ""), discardLog())
	r := chi.NewRouter()
	r.Get("/l", h.List)
	r.Put("/u/{type}", h.Update)
	r.Post("/t/{type}", h.Test)
	for _, tc := range []struct{ method, path string }{{http.MethodGet, "/l"}, {http.MethodPut, "/u/testdouble"}, {http.MethodPost, "/t/testdouble"}} {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, strings.NewReader("{}")))
		if rec.Code != http.StatusInternalServerError || !strings.Contains(rec.Body.String(), CodeHouseholdCtx) {
			t.Errorf("%s: %d %s", tc.path, rec.Code, rec.Body.String())
		}
	}
}
