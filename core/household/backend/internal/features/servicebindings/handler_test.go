package servicebindings

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/go-shared/auth"
)

// asUser authenticates every request as sub; an empty sub leaves the request
// without claims.
func asUser(sub string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if sub != "" {
				r = r.WithContext(context.WithValue(r.Context(), auth.UserContextKey, &auth.UserClaims{Subject: sub}))
			}
			next.ServeHTTP(w, r)
		})
	}
}

func newTestRouter(repo Repository, sub string) http.Handler {
	svc, _ := newTestService(repo)
	r := chi.NewRouter()
	NewHandler(svc, discardLog()).RegisterRoutes(r, asUser(sub))
	return r
}

func call(h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

const base = "/api/v1/households/" + hhID + "/service-bindings"

func TestHandler_Lifecycle(t *testing.T) {
	repo := newFakeRepo()
	h := newTestRouter(repo, admin)
	body := `{"principal_id":"` + principal + `","scopes":["` + scope + `"]}`

	rec := call(h, http.MethodPost, base, body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body.String())
	}
	var b Binding
	if err := json.Unmarshal(rec.Body.Bytes(), &b); err != nil || b.PrincipalID != principal || b.Scopes[0] != scope {
		t.Fatalf("create body %+v err=%v", b, err)
	}
	if rec := call(h, http.MethodPost, base, body); rec.Code != http.StatusOK {
		t.Fatalf("repeat create: %d", rec.Code)
	}

	rec = call(h, http.MethodGet, base, "")
	var list ListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &list); rec.Code != http.StatusOK || err != nil || len(list.Bindings) != 1 {
		t.Fatalf("list: %d %s", rec.Code, rec.Body.String())
	}

	if rec := call(h, http.MethodDelete, base+"/"+principal, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("revoke: %d", rec.Code)
	}
	if rec := call(h, http.MethodDelete, base+"/"+principal, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("second revoke: %d", rec.Code)
	}
}

func TestHandler_Errors(t *testing.T) {
	ok := `{"principal_id":"` + principal + `","scopes":["` + scope + `"]}`
	cases := []struct {
		name   string
		sub    string
		repo   Repository
		method string
		path   string
		body   string
		want   int
	}{
		{"create unauthenticated", "", newFakeRepo(), http.MethodPost, base, ok, http.StatusUnauthorized},
		{"list unauthenticated", "", newFakeRepo(), http.MethodGet, base, "", http.StatusUnauthorized},
		{"revoke unauthenticated", "", newFakeRepo(), http.MethodDelete, base + "/x", "", http.StatusUnauthorized},
		{"bad json", admin, newFakeRepo(), http.MethodPost, base, "{", http.StatusBadRequest},
		{"member forbidden", "member-sub", newFakeRepo(), http.MethodPost, base, ok, http.StatusForbidden},
		{"list forbidden", "member-sub", newFakeRepo(), http.MethodGet, base, "", http.StatusForbidden},
		{"unknown principal", admin, newFakeRepo(), http.MethodPost, base, `{"principal_id":"x","scopes":["a:b"]}`, http.StatusBadRequest},
		{"bad scopes", admin, newFakeRepo(), http.MethodPost, base, `{"principal_id":"` + principal + `","scopes":[]}`, http.StatusBadRequest},
		{"member principal", admin, newFakeRepo(), http.MethodPost, base, `{"principal_id":"member-machine","scopes":["a:b"]}`, http.StatusConflict},
		{"create db failure", admin, &fakeRepo{err: errDB}, http.MethodPost, base, ok, http.StatusInternalServerError},
		{"list db failure", admin, &fakeRepo{err: errDB}, http.MethodGet, base, "", http.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if rec := call(newTestRouter(tc.repo, tc.sub), tc.method, tc.path, tc.body); rec.Code != tc.want {
				t.Fatalf("status %d, want %d: %s", rec.Code, tc.want, rec.Body.String())
			}
		})
	}
}

func TestPrincipals_Guard(t *testing.T) {
	p := NewPrincipals([]string{principal})
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })

	for sub, want := range map[string]int{principal: http.StatusForbidden, admin: http.StatusNoContent, "": http.StatusUnauthorized} {
		if rec := call(p.Guard(asUser(sub))(ok), http.MethodGet, "/api/v1/households/me", ""); rec.Code != want {
			t.Errorf("sub %q: status %d, want %d", sub, rec.Code, want)
		}
	}
	if NewPrincipals(nil).Contains("") || p.Contains("") {
		t.Error("an empty subject is never a principal")
	}
}
