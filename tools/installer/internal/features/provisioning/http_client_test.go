package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// noSleep makes retry backoffs instant, so a retrying test costs no real
// time.
type noSleep struct{ slept int32 }

func (n *noSleep) Sleep(_ context.Context, _ time.Duration) error {
	atomic.AddInt32(&n.slept, 1)
	return nil
}

func newTestClient(t *testing.T, handler http.HandlerFunc) (*HTTPClient, *noSleep) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	sleep := &noSleep{}
	return &HTTPClient{
		BaseURL: srv.URL,
		Host:    "auth.example.com",
		PAT:     "test-pat",
		Clock:   sleep,
	}, sleep
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func TestHTTPClient_EnsureProject_CreatesWhenMissing(t *testing.T) {
	var gotHost string
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotHost = r.Host
		switch {
		case strings.HasSuffix(r.URL.Path, "/projects/_search"):
			writeJSON(w, 200, map[string]any{"result": []any{}})
		case r.URL.Path == "/management/v1/projects" && r.Method == http.MethodPost:
			writeJSON(w, 200, map[string]any{"id": "proj-1"})
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	})

	id, err := c.EnsureProject(context.Background(), "Alfheim")
	if err != nil {
		t.Fatalf("EnsureProject() error = %v", err)
	}
	if id != "proj-1" {
		t.Errorf("id = %q", id)
	}
	if gotHost != "auth.example.com" {
		t.Errorf("Host header = %q, want the external auth domain", gotHost)
	}
}

func TestHTTPClient_EnsureProject_ReturnsExisting(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/projects/_search") {
			writeJSON(w, 200, map[string]any{"result": []map[string]any{{"id": "existing-id"}}})
			return
		}
		t.Fatalf("a project search hit must not create a new project; got %s", r.URL.Path)
	})

	id, err := c.EnsureProject(context.Background(), "Alfheim")
	if err != nil {
		t.Fatal(err)
	}
	if id != "existing-id" {
		t.Errorf("id = %q, want the existing project", id)
	}
}

func TestHTTPClient_EnsureOIDCApp_CreatesPublicClient(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/apps/_search"):
			writeJSON(w, 200, map[string]any{"result": []any{}})
		case strings.HasSuffix(r.URL.Path, "/apps/oidc"):
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["authMethodType"] != "OIDC_AUTH_METHOD_TYPE_NONE" {
				t.Errorf("authMethodType = %v, want NONE for a public client", body["authMethodType"])
			}
			writeJSON(w, 200, map[string]any{"appId": "app-1", "clientId": "web-client"})
		default:
			t.Fatalf("unexpected request: %s", r.URL.Path)
		}
	})

	creds, err := c.EnsureOIDCApp(context.Background(), "proj-1", AppSpec{
		Name: "Alfheim Web", Type: AppTypePublicPKCE, RedirectURIs: []string{"https://x/"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if creds.ClientID != "web-client" || creds.ClientSecret != "" {
		t.Errorf("creds = %+v, want a public client with no secret", creds)
	}
}

func TestHTTPClient_EnsureOIDCApp_CreatesConfidentialClientWithSecret(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/apps/_search"):
			writeJSON(w, 200, map[string]any{"result": []any{}})
		case strings.HasSuffix(r.URL.Path, "/apps/oidc"):
			writeJSON(w, 200, map[string]any{
				"appId": "app-1", "clientId": "grafana-client", "clientSecret": "grafana-secret",
			})
		default:
			t.Fatalf("unexpected request: %s", r.URL.Path)
		}
	})

	creds, err := c.EnsureOIDCApp(context.Background(), "proj-1", AppSpec{
		Name: "Grafana", Type: AppTypeConfidentialWeb, RedirectURIs: []string{"https://x/grafana"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if creds.ClientID != "grafana-client" || creds.ClientSecret != "grafana-secret" {
		t.Errorf("creds = %+v", creds)
	}
}

func TestHTTPClient_EnsureOIDCApp_ReusesSecretWhenUnchanged(t *testing.T) {
	var regenerateCalled bool
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/apps/_search"):
			writeJSON(w, 200, map[string]any{"result": []map[string]any{
				{"id": "app-1", "name": "Grafana", "oidcConfig": map[string]any{"clientId": "grafana-client"}},
			}})
		case strings.HasSuffix(r.URL.Path, "/oidc_config") && r.Method == http.MethodPut:
			writeJSON(w, 200, map[string]any{})
		case strings.HasSuffix(r.URL.Path, "_generate_client_secret"):
			regenerateCalled = true
			writeJSON(w, 200, map[string]any{"clientSecret": "new-secret"})
		default:
			t.Fatalf("unexpected request: %s", r.URL.Path)
		}
	})

	creds, err := c.EnsureOIDCApp(context.Background(), "proj-1", AppSpec{
		Name: "Grafana", Type: AppTypeConfidentialWeb, RedirectURIs: []string{"https://x/grafana"},
		ExistingClientID: "grafana-client", ExistingClientSecret: "kept-secret",
	})
	if err != nil {
		t.Fatal(err)
	}
	if regenerateCalled {
		t.Fatal("the secret must not be regenerated when the client id matches and a secret is on file")
	}
	if creds.ClientSecret != "kept-secret" {
		t.Errorf("ClientSecret = %q, want the preserved secret", creds.ClientSecret)
	}
}

func TestHTTPClient_EnsureOIDCApp_RegeneratesWhenSecretMissing(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/apps/_search"):
			writeJSON(w, 200, map[string]any{"result": []map[string]any{
				{"id": "app-1", "name": "Grafana", "oidcConfig": map[string]any{"clientId": "grafana-client"}},
			}})
		case strings.HasSuffix(r.URL.Path, "/oidc_config") && r.Method == http.MethodPut:
			writeJSON(w, 200, map[string]any{})
		case strings.HasSuffix(r.URL.Path, "_generate_client_secret"):
			writeJSON(w, 200, map[string]any{"clientSecret": "fresh-secret"})
		default:
			t.Fatalf("unexpected request: %s", r.URL.Path)
		}
	})

	creds, err := c.EnsureOIDCApp(context.Background(), "proj-1", AppSpec{
		Name: "Grafana", Type: AppTypeConfidentialWeb, RedirectURIs: []string{"https://x/grafana"},
		ExistingClientID: "grafana-client", ExistingClientSecret: "",
	})
	if err != nil {
		t.Fatal(err)
	}
	if creds.ClientSecret != "fresh-secret" {
		t.Errorf("ClientSecret = %q, want a freshly generated secret", creds.ClientSecret)
	}
}

func TestHTTPClient_EnsureOIDCApp_ToleratesNoChangesResponse(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/apps/_search"):
			writeJSON(w, 200, map[string]any{"result": []map[string]any{
				{"id": "app-1", "name": "Alfheim Web", "oidcConfig": map[string]any{"clientId": "web-client"}},
			}})
		case strings.HasSuffix(r.URL.Path, "/oidc_config") && r.Method == http.MethodPut:
			http.Error(w, `{"message":"No changes","id":"COMMAND-1m88i"}`, http.StatusBadRequest)
		default:
			t.Fatalf("unexpected request: %s", r.URL.Path)
		}
	})

	creds, err := c.EnsureOIDCApp(context.Background(), "proj-1", AppSpec{
		Name: "Alfheim Web", Type: AppTypePublicPKCE, RedirectURIs: []string{"https://x/"},
	})
	if err != nil {
		t.Fatalf("a no-changes response must be treated as success: %v", err)
	}
	if creds.ClientID != "web-client" {
		t.Errorf("ClientID = %q", creds.ClientID)
	}
}

func TestHTTPClient_RetriesTransientServerErrors(t *testing.T) {
	var attempts int32
	c, sleep := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&attempts, 1)
		if n < 3 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		writeJSON(w, 200, map[string]any{"result": []map[string]any{{"id": "proj-1"}}})
	})

	id, err := c.EnsureProject(context.Background(), "Alfheim")
	if err != nil {
		t.Fatalf("EnsureProject() error = %v, want the retry to eventually succeed", err)
	}
	if id != "proj-1" {
		t.Errorf("id = %q", id)
	}
	if atomic.LoadInt32(&attempts) != 3 {
		t.Errorf("attempts = %d, want 3", attempts)
	}
	if atomic.LoadInt32(&sleep.slept) != 2 {
		t.Errorf("slept %d times, want 2 (one between each retry)", sleep.slept)
	}
}

func TestHTTPClient_DoesNotRetryClientErrors(t *testing.T) {
	var attempts int32
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attempts, 1)
		http.Error(w, `{"message":"forbidden"}`, http.StatusForbidden)
	})

	if _, err := c.EnsureProject(context.Background(), "Alfheim"); err == nil {
		t.Fatal("EnsureProject() error = nil, want the 403 to fail immediately")
	}
	if atomic.LoadInt32(&attempts) != 1 {
		t.Errorf("attempts = %d, want exactly 1 (no retry on a 4xx)", attempts)
	}
}

func TestHTTPClient_GivesUpAfterMaxRetries(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	})
	c.MaxRetries = 2

	_, err := c.EnsureProject(context.Background(), "Alfheim")
	if err == nil {
		t.Fatal("EnsureProject() error = nil, want it to give up eventually")
	}
}

func TestHTTPClient_ContextCancelledDuringBackoffStopsRetrying(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(srv.Close)

	ctx, cancel := context.WithCancel(context.Background())
	c := &HTTPClient{
		BaseURL: srv.URL, Host: "auth.example.com", PAT: "pat",
		Clock: sleepFunc(func(context.Context, time.Duration) error {
			cancel()
			return context.Canceled
		}),
	}
	if _, err := c.EnsureProject(ctx, "Alfheim"); err == nil {
		t.Fatal("EnsureProject() error = nil, want context cancellation to stop the retry loop")
	}
}

// sleepFunc adapts a function to the Clock interface.
type sleepFunc func(ctx context.Context, d time.Duration) error

func (f sleepFunc) Sleep(ctx context.Context, d time.Duration) error { return f(ctx, d) }

func TestHTTPClient_MalformedResponseIsReported(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("not json"))
	})
	if _, err := c.EnsureProject(context.Background(), "Alfheim"); err == nil {
		t.Fatal("EnsureProject() error = nil, want a decode failure")
	}
}

func TestHTTPClient_NoClientIDReturnedIsAnError(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/projects/_search"):
			writeJSON(w, 200, map[string]any{"result": []any{}})
		case r.URL.Path == "/management/v1/projects":
			writeJSON(w, 200, map[string]any{"id": ""})
		}
	})
	if _, err := c.EnsureProject(context.Background(), "Alfheim"); err == nil {
		t.Fatal("EnsureProject() error = nil, want an error for an empty id")
	}
}

func TestHTTPClient_RealClockDoesNotBlockForever(t *testing.T) {
	// Exercises the production Clock default, without waiting for a whole
	// retry cycle: a single successful call never sleeps at all.
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{"result": []map[string]any{{"id": "proj-1"}}})
	})
	c.Clock = nil // exercise the default realClock path
	if _, err := c.EnsureProject(context.Background(), "Alfheim"); err != nil {
		t.Fatal(err)
	}
}

func TestApiError_Error(t *testing.T) {
	err := &apiError{method: "GET", path: "/x", status: 500, body: "boom"}
	if got := err.Error(); !strings.Contains(got, "500") || !strings.Contains(got, "boom") {
		t.Errorf("Error() = %q", got)
	}
}

func TestHTTPClient_DefaultHTTPClientIsUsable(t *testing.T) {
	c := &HTTPClient{}
	if c.httpClient() != http.DefaultClient {
		t.Error("httpClient() must default to http.DefaultClient")
	}
	if c.maxRetries() != 5 {
		t.Errorf("maxRetries() = %d, want 5", c.maxRetries())
	}
	if c.baseDelay() != 500*time.Millisecond {
		t.Errorf("baseDelay() = %v, want 500ms", c.baseDelay())
	}
}
