package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	var created map[string]any
	routes := merge(identityRoutes(), map[string]rpcReply{
		projectService + "ListProjects": func(body map[string]any) (int, any) {
			filters, _ := json.Marshal(body["filters"])
			if !strings.Contains(string(filters), `"organizationId":"org-1"`) ||
				!strings.Contains(string(filters), `"projectName":"Alfheim"`) {
				t.Errorf("ListProjects filters = %s", filters)
			}
			return 200, map[string]any{"projects": []any{}}
		},
		projectService + "CreateProject": func(body map[string]any) (int, any) {
			created = body
			return 200, map[string]any{"projectId": "proj-1"}
		},
	})
	fake := v2Fake(t, routes, nil)
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotHost = r.Host
		fake(w, r)
	})

	id, err := c.EnsureProject(context.Background(), "Alfheim")
	if err != nil {
		t.Fatalf("EnsureProject() error = %v", err)
	}
	if id != "proj-1" {
		t.Errorf("id = %q", id)
	}
	if created["organizationId"] != "org-1" || created["name"] != "Alfheim" {
		t.Errorf("CreateProject body = %v, want the caller's organisation", created)
	}
	if gotHost != "auth.example.com" {
		t.Errorf("Host header = %q, want the external auth domain", gotHost)
	}
}

func TestHTTPClient_EnsureProject_ReturnsExisting(t *testing.T) {
	routes := merge(identityRoutes(), map[string]rpcReply{
		projectService + "ListProjects": ok(map[string]any{"projects": []map[string]any{
			{"projectId": "other", "name": "Alfheim Copy"},
			{"projectId": "existing-id", "name": "Alfheim"},
		}}),
	})
	c, _ := newTestClient(t, v2Fake(t, routes, nil))

	id, err := c.EnsureProject(context.Background(), "Alfheim")
	if err != nil {
		t.Fatal(err)
	}
	if id != "existing-id" {
		t.Errorf("id = %q, want the existing project", id)
	}
}

func TestHTTPClient_EnsureProject_IdentityFailures(t *testing.T) {
	for name, routes := range map[string]map[string]rpcReply{
		"userinfo rejected": {userinfoPath: func(map[string]any) (int, any) { return 401, map[string]any{} }},
		"no organisation": merge(identityRoutes(), map[string]rpcReply{
			userService + "GetUserByID": ok(map[string]any{"user": map[string]any{}}),
		}),
		"user lookup fails": merge(identityRoutes(), map[string]rpcReply{
			userService + "GetUserByID": func(map[string]any) (int, any) { return 403, map[string]any{} },
		}),
	} {
		c, _ := newTestClient(t, v2Fake(t, routes, nil))
		if _, err := c.EnsureProject(context.Background(), "Alfheim"); err == nil {
			t.Errorf("%s: EnsureProject() error = nil", name)
		}
	}
}

// appList answers ListApplications with one existing app.
func appList(name, clientID string) rpcReply {
	return ok(map[string]any{"applications": []map[string]any{
		{"applicationId": "app-1", "name": name, "oidcConfiguration": map[string]any{"clientId": clientID}},
	}})
}

func TestHTTPClient_EnsureOIDCApp_CreatesPublicClient(t *testing.T) {
	routes := map[string]rpcReply{
		applicationService + "ListApplications": ok(map[string]any{}),
		applicationService + "CreateApplication": func(body map[string]any) (int, any) {
			cfg, _ := body["oidcConfiguration"].(map[string]any)
			if cfg["authMethodType"] != "OIDC_AUTH_METHOD_TYPE_NONE" || cfg["applicationType"] != "OIDC_APP_TYPE_USER_AGENT" {
				t.Errorf("oidcConfiguration = %v, want a public user-agent client", cfg)
			}
			if body["projectId"] != "proj-1" || body["name"] != "Alfheim Web" {
				t.Errorf("CreateApplication body = %v", body)
			}
			return 200, map[string]any{"applicationId": "app-1", "oidcConfiguration": map[string]any{"clientId": "web-client"}}
		},
	}
	c, _ := newTestClient(t, v2Fake(t, routes, nil))

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
	routes := map[string]rpcReply{
		// A listing that ignores the name filter must not be mistaken for a hit.
		applicationService + "ListApplications": appList("Alfheim Web", "web-client"),
		applicationService + "CreateApplication": ok(map[string]any{
			"applicationId":     "app-2",
			"oidcConfiguration": map[string]any{"clientId": "grafana-client", "clientSecret": "grafana-secret"},
		}),
	}
	c, _ := newTestClient(t, v2Fake(t, routes, nil))

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
	var seen []string
	routes := map[string]rpcReply{
		applicationService + "ListApplications": appList("Grafana", "grafana-client"),
		applicationService + "UpdateApplication": func(body map[string]any) (int, any) {
			if body["applicationId"] != "app-1" || body["projectId"] != "proj-1" || body["oidcConfiguration"] == nil {
				t.Errorf("UpdateApplication body = %v", body)
			}
			return 200, map[string]any{}
		},
	}
	c, _ := newTestClient(t, v2Fake(t, routes, &seen))

	creds, err := c.EnsureOIDCApp(context.Background(), "proj-1", AppSpec{
		Name: "Grafana", Type: AppTypeConfidentialWeb, RedirectURIs: []string{"https://x/grafana"},
		ExistingClientID: "grafana-client", ExistingClientSecret: "kept-secret",
	})
	if err != nil {
		t.Fatal(err)
	}
	if creds.ClientSecret != "kept-secret" {
		t.Errorf("ClientSecret = %q, want the preserved secret", creds.ClientSecret)
	}
	if len(seen) != 2 {
		t.Errorf("requests = %v, want only the listing and the update (no secret regeneration)", seen)
	}
}

func TestHTTPClient_EnsureOIDCApp_RegeneratesWhenSecretMissing(t *testing.T) {
	routes := map[string]rpcReply{
		applicationService + "ListApplications":  appList("Grafana", "grafana-client"),
		applicationService + "UpdateApplication": ok(map[string]any{}),
		applicationService + "GenerateClientSecret": func(body map[string]any) (int, any) {
			if body["applicationId"] != "app-1" || body["projectId"] != "proj-1" {
				t.Errorf("GenerateClientSecret body = %v", body)
			}
			return 200, map[string]any{"clientSecret": "fresh-secret"}
		},
	}
	c, _ := newTestClient(t, v2Fake(t, routes, nil))

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

func TestHTTPClient_EnsureOIDCApp_Failures(t *testing.T) {
	spec := AppSpec{Name: "Grafana", Type: AppTypeConfidentialWeb, ExistingClientID: "other"}
	fail := func(map[string]any) (int, any) { return 403, map[string]any{} }
	for name, routes := range map[string]map[string]rpcReply{
		"listing fails": {applicationService + "ListApplications": fail},
		"create fails": {
			applicationService + "ListApplications":  ok(map[string]any{}),
			applicationService + "CreateApplication": fail,
		},
		"create returns no client id": {
			applicationService + "ListApplications":  ok(map[string]any{}),
			applicationService + "CreateApplication": ok(map[string]any{}),
		},
		"update fails": {
			applicationService + "ListApplications":  appList("Grafana", "c"),
			applicationService + "UpdateApplication": fail,
		},
		"regeneration fails": {
			applicationService + "ListApplications":     appList("Grafana", "c"),
			applicationService + "UpdateApplication":    ok(map[string]any{}),
			applicationService + "GenerateClientSecret": fail,
		},
		"regeneration returns no secret": {
			applicationService + "ListApplications":     appList("Grafana", "c"),
			applicationService + "UpdateApplication":    ok(map[string]any{}),
			applicationService + "GenerateClientSecret": ok(map[string]any{}),
		},
	} {
		c, _ := newTestClient(t, v2Fake(t, routes, nil))
		if _, err := c.EnsureOIDCApp(context.Background(), "proj-1", spec); err == nil {
			t.Errorf("%s: EnsureOIDCApp() error = nil", name)
		}
	}
}

func TestHTTPClient_EnsureOIDCApp_ToleratesNoChangesResponse(t *testing.T) {
	routes := map[string]rpcReply{
		applicationService + "ListApplications": appList("Alfheim Web", "web-client"),
		applicationService + "UpdateApplication": func(map[string]any) (int, any) {
			return 400, map[string]any{"code": "failed_precondition", "message": "No changes (COMMAND-1m88i)"}
		},
	}
	c, _ := newTestClient(t, v2Fake(t, routes, nil))

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
		writeJSON(w, 200, map[string]any{"sub": "u-machine"})
	})

	id, err := c.CurrentUserID(context.Background())
	if err != nil {
		t.Fatalf("CurrentUserID() error = %v, want the retry to eventually succeed", err)
	}
	if id != "u-machine" {
		t.Errorf("id = %q", id)
	}
	if atomic.LoadInt32(&attempts) != 3 {
		t.Errorf("attempts = %d, want 3", attempts)
	}
	if atomic.LoadInt32(&sleep.slept) != 2 {
		t.Errorf("slept %d times, want 2 (one between each retry)", sleep.slept)
	}
}

func TestIsUnauthorized(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"401", &apiError{status: http.StatusUnauthorized}, true},
		{"403", &apiError{status: http.StatusForbidden}, true},
		{"404", &apiError{status: http.StatusNotFound}, false},
		{"wrapped 401", errWrap(&apiError{status: http.StatusUnauthorized}), true},
		{"unrelated error", errors.New("boom"), false},
		{"nil", nil, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsUnauthorized(tc.err); got != tc.want {
				t.Errorf("IsUnauthorized(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}

func errWrap(err error) error {
	return fmt.Errorf("provisioning: ensure project %q: %w", "Alfheim", err)
}

func TestHTTPClient_DoesNotRetryOn401(t *testing.T) {
	var attempts int32
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attempts, 1)
		http.Error(w, `{"message":"unauthenticated"}`, http.StatusUnauthorized)
	})

	_, err := c.EnsureProject(context.Background(), "Alfheim")
	if err == nil {
		t.Fatal("EnsureProject() error = nil, want the 401 to fail immediately")
	}
	if !IsUnauthorized(err) {
		t.Errorf("IsUnauthorized(%v) = false, want true", err)
	}
	if atomic.LoadInt32(&attempts) != 1 {
		t.Errorf("attempts = %d, want exactly 1 (no retry on a 401)", attempts)
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
	c, _ := newTestClient(t, v2Fake(t, merge(identityRoutes(), map[string]rpcReply{
		projectService + "ListProjects":  ok(map[string]any{}),
		projectService + "CreateProject": ok(map[string]any{"projectId": ""}),
	}), nil))
	if _, err := c.EnsureProject(context.Background(), "Alfheim"); err == nil {
		t.Fatal("EnsureProject() error = nil, want an error for an empty id")
	}
}

func TestHTTPClient_RealClockDoesNotBlockForever(t *testing.T) {
	// Exercises the production Clock default, without waiting for a whole
	// retry cycle: a single successful call never sleeps at all.
	c, _ := newTestClient(t, v2Fake(t, identityRoutes(), nil))
	c.Clock = nil // exercise the default realClock path
	if _, err := c.CurrentUserID(context.Background()); err != nil {
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

// loginPolicyServer is a stateful fake of the two Zitadel login policy
// endpoints, recording every write.
type loginPolicyServer struct {
	instance map[string]any
	org      map[string]any
	puts     []string
	putBody  map[string]map[string]any
	// stickyRegister makes the instance PUT a no-op, simulating a policy
	// that silently stays open.
	stickyRegister bool
}

func newLoginPolicyServer(instanceRegister bool, orgCustom bool, orgRegister bool) *loginPolicyServer {
	return &loginPolicyServer{
		instance: map[string]any{
			"isDefault": true, "allowUsernamePassword": true, "allowRegister": instanceRegister,
			"allowExternalIdp": true, "forceMfa": true, "passwordCheckLifetime": "864000s",
			"defaultRedirectUri": "https://x/",
		},
		org: map[string]any{
			"isDefault": !orgCustom, "allowUsernamePassword": true, "allowRegister": orgRegister,
			"hidePasswordReset": true,
		},
		putBody: map[string]map[string]any{},
	}
}

func (s *loginPolicyServer) handler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var state *map[string]any
		switch r.URL.Path {
		case "/admin/v1/policies/login":
			state = &s.instance
		case "/management/v1/policies/login":
			state = &s.org
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		switch r.Method {
		case http.MethodGet:
			// An org without a custom policy reports the instance's values.
			if r.URL.Path == "/management/v1/policies/login" && s.org["isDefault"] == true {
				view := map[string]any{}
				for k, v := range s.instance {
					view[k] = v
				}
				writeJSON(w, 200, map[string]any{"policy": view})
				return
			}
			writeJSON(w, 200, map[string]any{"policy": *state})
		case http.MethodPut:
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			s.puts = append(s.puts, r.URL.Path)
			s.putBody[r.URL.Path] = body
			if r.URL.Path == "/admin/v1/policies/login" && s.stickyRegister {
				writeJSON(w, 200, map[string]any{})
				return
			}
			updated := map[string]any{"isDefault": (*state)["isDefault"]}
			for k, v := range body {
				updated[k] = v
			}
			*state = updated
			writeJSON(w, 200, map[string]any{})
		default:
			t.Fatalf("unexpected method %s", r.Method)
		}
	}
}

func TestHTTPClient_EnsureRegistrationDisabled_UpdatesInstanceKeepingOtherFields(t *testing.T) {
	s := newLoginPolicyServer(true, false, true)
	c, _ := newTestClient(t, s.handler(t))

	if err := c.EnsureRegistrationDisabled(context.Background()); err != nil {
		t.Fatalf("EnsureRegistrationDisabled() error = %v", err)
	}
	if len(s.puts) != 1 || s.puts[0] != "/admin/v1/policies/login" {
		t.Fatalf("PUTs = %v, want exactly the instance policy (org policy is inherited)", s.puts)
	}
	body := s.putBody["/admin/v1/policies/login"]
	if body["allowRegister"] != false {
		t.Errorf("allowRegister = %v, want false", body["allowRegister"])
	}
	for k, want := range map[string]any{
		"allowUsernamePassword": true, "allowExternalIdp": true, "forceMfa": true,
		"passwordCheckLifetime": "864000s", "defaultRedirectUri": "https://x/",
	} {
		if body[k] != want {
			t.Errorf("PUT body %s = %v, want %v (unchanged)", k, body[k], want)
		}
	}
	if _, leaked := body["isDefault"]; leaked {
		t.Error("PUT body must not carry the read-only isDefault field")
	}
}

func TestHTTPClient_EnsureRegistrationDisabled_UpdatesCustomOrgPolicy(t *testing.T) {
	s := newLoginPolicyServer(false, true, true)
	c, _ := newTestClient(t, s.handler(t))

	if err := c.EnsureRegistrationDisabled(context.Background()); err != nil {
		t.Fatalf("EnsureRegistrationDisabled() error = %v", err)
	}
	if len(s.puts) != 1 || s.puts[0] != "/management/v1/policies/login" {
		t.Fatalf("PUTs = %v, want only the custom org policy", s.puts)
	}
	body := s.putBody["/management/v1/policies/login"]
	if body["allowRegister"] != false || body["hidePasswordReset"] != true {
		t.Errorf("org PUT body = %v, want allowRegister=false and other fields kept", body)
	}
}

func TestHTTPClient_EnsureRegistrationDisabled_IsIdempotent(t *testing.T) {
	s := newLoginPolicyServer(true, false, true)
	c, _ := newTestClient(t, s.handler(t))

	for i := 0; i < 2; i++ {
		if err := c.EnsureRegistrationDisabled(context.Background()); err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
	}
	if len(s.puts) != 1 {
		t.Errorf("PUTs = %v, want the second run to write nothing", s.puts)
	}
}

func TestHTTPClient_EnsureRegistrationDisabled_FailsWhenStillOpen(t *testing.T) {
	s := newLoginPolicyServer(true, false, true)
	s.stickyRegister = true
	c, _ := newTestClient(t, s.handler(t))

	err := c.EnsureRegistrationDisabled(context.Background())
	if err == nil || !strings.Contains(err.Error(), "still true") {
		t.Fatalf("EnsureRegistrationDisabled() error = %v, want the verification failure", err)
	}
}

func TestHTTPClient_EnsureRegistrationDisabled_ReportsForbidden(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 403, map[string]any{"message": "no permission"})
	})
	err := c.EnsureRegistrationDisabled(context.Background())
	if !IsUnauthorized(err) {
		t.Fatalf("error = %v, want it to wrap an unauthorized API error", err)
	}
}
