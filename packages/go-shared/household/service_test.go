package household

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"

	"alfheim/go-shared/httpmw"
)

const integrationsSub = "integrations-principal"

// serviceBindingServer answers like core/household for a principal bound to
// bound with scopes, until revoked is set; any other lookup is "not a member".
func serviceBindingServer(t *testing.T, bound uuid.UUID, scopes []string, revoked *atomic.Bool) *fakeServer {
	t.Helper()
	return newFakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		if revoked.Load() || r.URL.Path != "/internal/v1/memberships/"+bound.String()+"/"+integrationsSub {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"household_id": bound.String(), "user_id": integrationsSub, "role": "SERVICE", "scopes": scopes,
		})
	})
}

func serveAs(handler http.Handler, household uuid.UUID) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.Header.Set(HouseholdHeader, household.String())
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestCheckMembership_ServicePrincipalIsNeverCached(t *testing.T) {
	bound := uuid.New()
	var revoked atomic.Bool
	fs := serviceBindingServer(t, bound, []string{"chores:create_instance"}, &revoked)
	c := New(fs.server.URL, "internal-secret")

	m, err := c.CheckMembership(context.Background(), bound, integrationsSub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.Role != RoleService || len(m.Scopes) != 1 || m.Scopes[0] != "chores:create_instance" {
		t.Fatalf("unexpected membership %+v", m)
	}
	if m.Role.Valid() {
		t.Fatal("SERVICE must not be a valid member role")
	}

	revoked.Store(true)
	if _, err := c.CheckMembership(context.Background(), bound, integrationsSub); !errors.Is(err, ErrNotMember) {
		t.Fatalf("expected ErrNotMember right after revocation, got %v", err)
	}
	if got := fs.calls.Load(); got != 2 {
		t.Fatalf("expected every service lookup to reach the API, got %d calls", got)
	}
}

func TestRequireHousehold_ServicePrincipal(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	bound := uuid.New()
	var revoked atomic.Bool
	fs := serviceBindingServer(t, bound, []string{"chores:create_instance"}, &revoked)
	checker := New(fs.server.URL, "internal-secret")

	var seen *HouseholdContext
	capture := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hc, err := GetHousehold(r.Context())
		if err != nil {
			t.Fatalf("missing household context: %v", err)
		}
		seen = hc
		w.WriteHeader(http.StatusNoContent)
	})
	build := func(opts ...RequireOption) http.Handler {
		return httpmw.Chain(withTestClaims(integrationsSub), RequireHousehold(checker, log, opts...))(capture)
	}
	optedIn := build(AllowServiceScopes("chores:create_instance"))

	if rec := serveAs(optedIn, bound); rec.Code != http.StatusNoContent {
		t.Fatalf("opted-in route: status %d, want 204", rec.Code)
	}
	if !seen.IsService() || !seen.HasScope("chores:create_instance") || seen.HasScope("chores:delete") {
		t.Fatalf("unexpected context %+v", seen)
	}

	cases := []struct {
		name    string
		handler http.Handler
		hh      uuid.UUID
		code    string
	}{
		{"default route rejects service", build(), bound, CodeHouseholdForbidden},
		{"empty opt-in rejects service", build(AllowServiceScopes()), bound, CodeHouseholdForbidden},
		{"missing scope rejects service", build(AllowServiceScopes("chores:create_instance", "pantry:write")), bound, CodeHouseholdForbidden},
		{"other household rejects service", optedIn, uuid.New(), CodeHouseholdForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := serveAs(tc.handler, tc.hh)
			var body errorBody
			_ = json.NewDecoder(rec.Body).Decode(&body)
			if rec.Code != http.StatusForbidden || body.Detail.Code != tc.code {
				t.Fatalf("status %d code %q, want 403 %q", rec.Code, body.Detail.Code, tc.code)
			}
		})
	}

	revoked.Store(true)
	if rec := serveAs(optedIn, bound); rec.Code != http.StatusForbidden {
		t.Fatalf("after revocation: status %d, want 403", rec.Code)
	}
}

func TestRequireHouseholdRole_RejectsServicePrincipal(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mw := RequireHouseholdRole(log, RoleOwner, RoleAdmin, RoleMember)(ok)
	hc := &HouseholdContext{HouseholdID: uuid.New(), Role: RoleService, Subject: integrationsSub, Scopes: []string{"x:y"}}
	req := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ContextWithHousehold(context.Background(), hc))
	rec := httptest.NewRecorder()
	mw.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status %d, want 403", rec.Code)
	}
	member := &HouseholdContext{Role: RoleMember, Scopes: []string{"x:y"}}
	if member.IsService() || member.HasScope("x:y") {
		t.Fatal("a member never holds service scopes")
	}
}
