package plugins

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/go-shared/auth"
	"alfheim/go-shared/household"
)

// fakeMembership answers like core/household from a fixed role table.
type fakeMembership map[string]household.Role

func (f fakeMembership) CheckMembership(_ context.Context, hh uuid.UUID, sub string) (household.Membership, error) {
	role, ok := f[hh.String()+"|"+sub]
	if !ok {
		return household.Membership{}, household.ErrNotMember
	}
	return household.Membership{HouseholdID: hh, UserID: sub, Role: role}, nil
}

var (
	hhA = uuid.MustParse("11111111-1111-4111-8111-111111111111")
	hhB = uuid.MustParse("22222222-2222-4222-8222-222222222222")
)

type fixture struct {
	router http.Handler
	repo   *memRepo
	plugin *testPlugin
	svc    *Service
}

func newFixture(t *testing.T, svcFor func(*memRepo, *testPlugin) *Service) *fixture {
	t.Helper()
	members := fakeMembership{
		hhA.String() + "|admin-a":  household.RoleAdmin,
		hhA.String() + "|owner-a":  household.RoleOwner,
		hhA.String() + "|member-a": household.RoleMember,
		hhB.String() + "|admin-b":  household.RoleAdmin,
	}
	// Test auth: the subject comes from a header instead of a signed token.
	authMw := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), auth.UserContextKey, &auth.UserClaims{Subject: r.Header.Get("X-Test-User")})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
	repo, plugin := newMemRepo(), &testPlugin{typ: "testdouble", health: Health{Status: StatusOK, Detail: "fine"}}
	if svcFor == nil {
		svcFor = func(r *memRepo, p *testPlugin) *Service { return newTestService(r, p, testKey, "") }
	}
	svc := svcFor(repo, plugin)
	r := chi.NewRouter()
	NewHandler(svc, discardLog()).RegisterRoutes(r, authMw, household.RequireHousehold(members, discardLog()))
	return &fixture{router: r, repo: repo, plugin: plugin, svc: svc}
}

func (f *fixture) do(t *testing.T, method, path, user string, hh uuid.UUID, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("X-Test-User", user)
	req.Header.Set(household.HouseholdHeader, hh.String())
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return v
}

const putPath = "/api/v1/integrations/plugins/testdouble"

func TestHandler_CredentialRoundTrip(t *testing.T) {
	f := newFixture(t, nil)
	body := `{"enabled":true,"base_url":"https://ha.example.com","config":{"mode":"x"},"credentials":{"token":"s3cret-token"}}`
	rec := f.do(t, http.MethodPut, putPath, "admin-a", hhA, body)
	if rec.Code != http.StatusOK || strings.Contains(rec.Body.String(), "s3cret-token") {
		t.Fatalf("save: %d %s", rec.Code, rec.Body.String())
	}

	list := decode[ListResponse](t, f.do(t, http.MethodGet, "/api/v1/integrations/plugins", "member-a", hhA, ""))
	if len(list.Items) != 1 || !list.Items[0].HasCredentials || !list.Items[0].Enabled || !list.EncryptionAvailable {
		t.Fatalf("unexpected list %+v", list)
	}
	if list.Items[0].BaseURL != "https://ha.example.com" || string(list.Items[0].Config) != `{"mode":"x"}` {
		t.Fatalf("non-secret config missing: %+v", list.Items[0])
	}

	row := f.repo.rows[key(hhA, "testdouble")]
	if len(row.CredentialsEncrypted) == 0 || bytes.Contains(row.CredentialsEncrypted, []byte("s3cret-token")) {
		t.Fatal("the stored credentials must be ciphertext")
	}
	if row.CredentialsKeyID != "v1" {
		t.Fatalf("key id %q, want v1", row.CredentialsKeyID)
	}
	creds, err := mustCipher(testKey, "v1").Open(row.CredentialsEncrypted, row.CredentialsKeyID)
	if err != nil || creds["token"] != "s3cret-token" {
		t.Fatalf("decrypt with the configured key id: %v %v", creds, err)
	}

	// Without credentials in the body the stored ones are kept; {} removes them.
	f.do(t, http.MethodPut, putPath, "owner-a", hhA, `{"enabled":false}`)
	if !f.repo.rows[key(hhA, "testdouble")].HasCredentials() {
		t.Fatal("an update without credentials must keep them")
	}
	f.do(t, http.MethodPut, putPath, "owner-a", hhA, `{"enabled":false,"credentials":{}}`)
	if f.repo.rows[key(hhA, "testdouble")].HasCredentials() {
		t.Fatal("empty credentials must remove the stored ones")
	}
}

func TestHandler_RolesAndHouseholds(t *testing.T) {
	f := newFixture(t, nil)
	if rec := f.do(t, http.MethodPut, putPath, "member-a", hhA, `{"enabled":true}`); rec.Code != http.StatusForbidden {
		t.Fatalf("member write: %d, want 403", rec.Code)
	}
	if rec := f.do(t, http.MethodPost, putPath+"/test", "member-a", hhA, ``); rec.Code != http.StatusForbidden {
		t.Fatalf("member test: %d, want 403", rec.Code)
	}
	if rec := f.do(t, http.MethodGet, "/api/v1/integrations/plugins", "admin-b", hhA, ""); rec.Code != http.StatusForbidden {
		t.Fatalf("non-member list: %d, want 403", rec.Code)
	}
	f.do(t, http.MethodPut, putPath, "admin-a", hhA, `{"enabled":true}`)
	// Household B never sees or tests household A's row.
	if rec := f.do(t, http.MethodPost, putPath+"/test", "admin-b", hhB, ``); rec.Code != http.StatusNotFound {
		t.Fatalf("cross-household test: %d, want 404", rec.Code)
	}
	list := decode[ListResponse](t, f.do(t, http.MethodGet, "/api/v1/integrations/plugins", "admin-b", hhB, ""))
	if list.Items[0].Configured || list.Items[0].Enabled {
		t.Fatalf("household B sees A's row: %+v", list.Items[0])
	}
	if _, err := f.svc.Instance(context.Background(), hhB, "testdouble"); err != ErrNotConfigured {
		t.Fatalf("cross-household instance: %v", err)
	}
}

func TestHandler_ValidationAndUnknownType(t *testing.T) {
	f := newFixture(t, nil)
	cases := []struct {
		path, body string
		want       int
		code       string
	}{
		{"/api/v1/integrations/plugins/nope", `{}`, http.StatusNotFound, CodeUnknownType},
		{putPath, `{"household_id":"x"}`, http.StatusBadRequest, CodeInvalidBody},
		{putPath, `{"base_url":"ftp://x"}`, http.StatusUnprocessableEntity, CodeValidation},
		{putPath, `{"config":{"mode":"bad"}}`, http.StatusUnprocessableEntity, CodeValidation},
		{putPath, `{"config":{"typo":1}}`, http.StatusUnprocessableEntity, CodeValidation},
		{putPath, `{"credentials":{"Bad-Name":"x"}}`, http.StatusUnprocessableEntity, CodeValidation},
	}
	for _, tc := range cases {
		rec := f.do(t, http.MethodPut, tc.path, "admin-a", hhA, tc.body)
		if rec.Code != tc.want || !strings.Contains(rec.Body.String(), tc.code) {
			t.Errorf("%s %s: %d %s, want %d %s", tc.path, tc.body, rec.Code, rec.Body.String(), tc.want, tc.code)
		}
	}
	if rec := f.do(t, http.MethodPost, "/api/v1/integrations/plugins/nope/test", "admin-a", hhA, ""); rec.Code != http.StatusNotFound {
		t.Errorf("unknown type test: %d, want 404", rec.Code)
	}
}

func TestHandler_HostNotAllowedMakesNoRequest(t *testing.T) {
	var hits atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { hits.Add(1) }))
	defer target.Close()

	f := newFixture(t, func(r *memRepo, p *testPlugin) *Service {
		g := mustGuard("")
		p.client = NewHTTPClient(g, DefaultTimeout)
		reg, _ := NewRegistry(p)
		return NewService(r, reg, mustCipher(testKey, "v1"), g, 0)
	})
	f.do(t, http.MethodPut, putPath, "admin-a", hhA, `{"enabled":true,"base_url":"`+target.URL+`"}`)
	rec := f.do(t, http.MethodPost, putPath+"/test", "admin-a", hhA, "")
	got := decode[PluginResponse](t, rec)
	if rec.Code != http.StatusOK || got.Health.Status != StatusHostNotAllowed || got.Health.CheckedAt == nil {
		t.Fatalf("test: %d %+v", rec.Code, got)
	}
	if hits.Load() != 0 || f.plugin.callCount() != 0 {
		t.Fatalf("a blocked host must not be contacted: hits=%d calls=%d", hits.Load(), f.plugin.callCount())
	}
	if f.repo.rows[key(hhA, "testdouble")].HealthStatus != StatusHostNotAllowed {
		t.Fatal("the health result must be stored")
	}
}

func TestHandler_TestAllowedHostRedactsCredentials(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer good" {
			w.WriteHeader(http.StatusUnauthorized)
		}
	}))
	defer target.Close()

	f := newFixture(t, func(r *memRepo, p *testPlugin) *Service {
		g := mustGuard("127.0.0.1")
		p.client = NewHTTPClient(g, DefaultTimeout)
		reg, _ := NewRegistry(p)
		return NewService(r, reg, mustCipher(testKey, "v1"), g, 0)
	})
	f.do(t, http.MethodPut, putPath, "admin-a", hhA, `{"enabled":true,"base_url":"`+target.URL+`","credentials":{"token":"good"}}`)
	if got := decode[PluginResponse](t, f.do(t, http.MethodPost, putPath+"/test", "owner-a", hhA, "")); got.Health.Status != StatusOK {
		t.Fatalf("allowed host: %+v", got.Health)
	}

	f.do(t, http.MethodPut, putPath, "admin-a", hhA, `{"enabled":true,"base_url":"`+target.URL+`","credentials":{"token":"wrong-secret"}}`)
	got := decode[PluginResponse](t, f.do(t, http.MethodPost, putPath+"/test", "owner-a", hhA, ""))
	if got.Health.Status != StatusAuthFailed || strings.Contains(got.Health.Detail, "wrong-secret") || !strings.Contains(got.Health.Detail, redacted) {
		t.Fatalf("health detail must not echo credentials: %+v", got.Health)
	}
}
