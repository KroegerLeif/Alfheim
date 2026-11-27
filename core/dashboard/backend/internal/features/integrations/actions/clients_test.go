package actions

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"alfheim/dashboard/internal/features/plugins"
)

func TestTokenSource_DiscoversAndCaches(t *testing.T) {
	var tokenCalls atomic.Int32
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			_ = json.NewEncoder(w).Encode(map[string]string{"token_endpoint": srv.URL + "/oauth/v2/token"})
		case "/oauth/v2/token":
			tokenCalls.Add(1)
			user, pass, ok := r.BasicAuth()
			if err := r.ParseForm(); err != nil || !ok || user != "client" || pass != "s3cret" ||
				r.Form.Get("grant_type") != "client_credentials" ||
				r.Form.Get("scope") != "openid urn:zitadel:iam:org:project:id:proj:aud" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "tok-1", "expires_in": 3600})
		}
	}))
	defer srv.Close()
	src := NewTokenSource(PrincipalConfig{IssuerURL: srv.URL + "/", ClientID: "client", ClientSecret: "s3cret", ProjectID: "proj"}, srv.Client())
	now := time.Unix(1_800_000_000, 0)
	src.now = func() time.Time { return now }
	for range 2 {
		if tok, err := src.Token(context.Background()); err != nil || tok != "tok-1" {
			t.Fatalf("token: %q %v", tok, err)
		}
	}
	if tokenCalls.Load() != 1 {
		t.Fatalf("a valid token must be cached, calls %d", tokenCalls.Load())
	}
	now = now.Add(time.Hour)
	if _, err := src.Token(context.Background()); err != nil || tokenCalls.Load() != 2 {
		t.Fatalf("an expiring token must be renewed: %v %d", err, tokenCalls.Load())
	}
}

func TestTokenSource_Errors(t *testing.T) {
	for name, handler := range map[string]http.HandlerFunc{
		"discovery status": func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusBadGateway) },
		"discovery empty":  func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(`{}`)) },
		"bad json":         func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(`{`)) },
		"no token": func(w http.ResponseWriter, r *http.Request) {
			if strings.HasSuffix(r.URL.Path, "configuration") {
				_, _ = w.Write([]byte(`{"token_endpoint":"http://` + r.Host + `/t"}`))
				return
			}
			_, _ = w.Write([]byte(`{"access_token":""}`))
		},
		"bad endpoint": func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(`{"token_endpoint":"http://[::1"}`))
		},
	} {
		srv := httptest.NewServer(handler)
		_, err := NewTokenSource(PrincipalConfig{IssuerURL: srv.URL}, srv.Client()).Token(context.Background())
		if !errors.Is(err, ErrTokenUnavailable) {
			t.Errorf("%s: %v", name, err)
		}
		srv.Close()
	}
	for _, issuer := range []string{"http://[::1", "http://127.0.0.1:1"} {
		if _, err := NewTokenSource(PrincipalConfig{IssuerURL: issuer}, http.DefaultClient).Token(context.Background()); !errors.Is(err, ErrTokenUnavailable) {
			t.Errorf("%s: %v", issuer, err)
		}
	}
}

type tokenFunc func() (string, error)

func (f tokenFunc) Token(context.Context) (string, error) { return f() }

func TestChoresExecutor(t *testing.T) {
	status := http.StatusCreated
	var gotKey string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("Idempotency-Key")
		w.WriteHeader(status)
	}))
	defer srv.Close()
	ok := tokenFunc(func() (string, error) { return "tok", nil })
	ex := Execution{HouseholdID: hhA, EventID: "evt-9", Params: []byte(`{"template_id":"` + template + `"}`)}
	run := func(e *ChoresExecutor, x Execution) Result { return e.Execute(context.Background(), x) }

	if res := run(NewChoresExecutor(srv.URL, true, ok, srv.Client()), ex); res.Status != StatusExecuted || gotKey != "evt-9" {
		t.Fatalf("created: %+v key %q", res, gotKey)
	}
	for code, want := range map[int]Status{http.StatusOK: StatusExecuted, http.StatusForbidden: StatusFailed,
		http.StatusNotFound: StatusFailed, http.StatusConflict: StatusFailed} {
		status = code
		if res := run(NewChoresExecutor(srv.URL+"/", true, ok, srv.Client()), ex); res.Status != want {
			t.Errorf("%d: %+v", code, res)
		}
	}
	if res := run(NewChoresExecutor(srv.URL, false, ok, srv.Client()), ex); res.Status != StatusSkipped {
		t.Errorf("not installed: %+v", res)
	}
	if res := run(NewChoresExecutor(srv.URL, true, nil, srv.Client()), ex); res.Status != StatusFailed {
		t.Errorf("no principal: %+v", res)
	}
	if res := run(NewChoresExecutor(srv.URL, true, ok, srv.Client()), Execution{Params: []byte(`{}`)}); res.Status != StatusFailed {
		t.Errorf("bad params: %+v", res)
	}
	failing := tokenFunc(func() (string, error) { return "", ErrTokenUnavailable })
	if res := run(NewChoresExecutor(srv.URL, true, failing, srv.Client()), ex); res.Status != StatusFailed {
		t.Errorf("no token: %+v", res)
	}
	if res := run(NewChoresExecutor("http://[::1", true, ok, srv.Client()), ex); res.Status != StatusFailed {
		t.Errorf("bad url: %+v", res)
	}
	if res := run(NewChoresExecutor("http://127.0.0.1:1", true, ok, srv.Client()), ex); res.Status != StatusFailed {
		t.Errorf("unreachable: %+v", res)
	}
}

func TestBindingClient(t *testing.T) {
	var calls []string
	status := http.StatusCreated
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		calls = append(calls, r.Method+" "+r.URL.Path+" "+r.Header.Get("Authorization"))
		if r.Method == http.MethodPost && (body["principal_id"] != "principal" || body["scopes"].([]any)[0] != ChoresScope) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.WriteHeader(status)
	}))
	defer srv.Close()
	c := NewBindingClient(srv.URL+"/", "principal", []string{ChoresScope}, srv.Client())
	ctx := context.Background()
	change := plugins.EnableChange{HouseholdID: hhA, Enabled: true, CallerToken: "admin-jwt"}
	if err := c.Bind(ctx, change); err != nil {
		t.Fatal(err)
	}
	status = http.StatusNotFound
	if err := c.Unbind(ctx, change); err != nil {
		t.Fatalf("an already removed binding is fine: %v", err)
	}
	want := "POST /api/v1/households/" + hhA.String() + "/service-bindings Bearer admin-jwt"
	if calls[0] != want || !strings.HasPrefix(calls[1], "DELETE /api/v1/households/"+hhA.String()+"/service-bindings/principal ") {
		t.Fatalf("calls: %v", calls)
	}
	status = http.StatusForbidden
	if err := c.Bind(ctx, change); !errors.Is(err, ErrBinding) {
		t.Fatalf("a refused binding is an error: %v", err)
	}
	if err := c.Bind(ctx, plugins.EnableChange{HouseholdID: hhA}); !errors.Is(err, ErrBinding) {
		t.Fatalf("no token: %v", err)
	}
	if err := NewBindingClient("http://[::1", "p", nil, srv.Client()).Unbind(ctx, change); !errors.Is(err, ErrBinding) {
		t.Fatalf("bad url: %v", err)
	}
	if err := NewBindingClient("http://127.0.0.1:1", "p", nil, srv.Client()).Unbind(ctx, change); !errors.Is(err, ErrBinding) {
		t.Fatalf("unreachable: %v", err)
	}
}
