package provisioning

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"testing"
)

// idpServer is a stateful fake of the Zitadel Admin and Management API
// endpoints EnsureIDP uses, on top of loginPolicyServer's login policies.
type idpServer struct {
	policy    *loginPolicyServer
	providers map[string]map[string]any
	links     map[string][]string // policy idps path -> linked ids
	writes    []string
	bodies    map[string]map[string]any
	nextID    int
}

func newIDPServer(policy *loginPolicyServer) *idpServer {
	return &idpServer{
		policy:    policy,
		providers: map[string]map[string]any{},
		links:     map[string][]string{},
		bodies:    map[string]map[string]any{},
	}
}

func (s *idpServer) handler(t *testing.T) http.HandlerFunc {
	policyHandler := s.policy.handler(t)
	return func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if r.Body != nil && r.Method != http.MethodGet && r.Method != http.MethodDelete {
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("decode %s %s: %v", r.Method, r.URL.Path, err)
			}
		}
		path := r.URL.Path
		write := func() {
			s.writes = append(s.writes, r.Method+" "+path)
			s.bodies[r.Method+" "+path] = body
		}
		switch {
		case path == instanceLoginPolicyPath || path == orgLoginPolicyPath:
			raw, _ := json.Marshal(body)
			r.Body = io.NopCloser(bytes.NewReader(raw))
			if r.Method == http.MethodPut {
				write()
			}
			policyHandler(w, r)
		case path == adminIDPSearchPath:
			result := make([]map[string]any, 0, len(s.providers))
			for _, p := range s.providers {
				result = append(result, p)
			}
			writeJSON(w, 200, map[string]any{"result": result})
		case path == "/admin/v1/idps/google" && r.Method == http.MethodPost:
			write()
			s.nextID++
			id := fmt.Sprintf("idp-%d", s.nextID)
			s.store(id, body)
			writeJSON(w, 200, map[string]any{"id": id})
		case strings.HasPrefix(path, "/admin/v1/idps/google/") && r.Method == http.MethodPut:
			write()
			s.store(strings.TrimPrefix(path, "/admin/v1/idps/google/"), body)
			writeJSON(w, 200, map[string]any{})
		case strings.HasSuffix(path, "/idps/_search"):
			result := []map[string]any{}
			for _, id := range s.links[strings.TrimSuffix(path, "/_search")] {
				result = append(result, map[string]any{"idpId": id})
			}
			writeJSON(w, 200, map[string]any{"result": result})
		case (path == instanceLoginPolicyIDPsPath || path == orgLoginPolicyIDPsPath) && r.Method == http.MethodPost:
			write()
			s.links[path] = append(s.links[path], body["idpId"].(string))
			writeJSON(w, 200, map[string]any{})
		case r.Method == http.MethodDelete:
			write()
			base, id := path[:strings.LastIndex(path, "/")], path[strings.LastIndex(path, "/")+1:]
			s.links[base] = slices.DeleteFunc(s.links[base], func(v string) bool { return v == id })
			writeJSON(w, 200, map[string]any{})
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, path)
		}
	}
}

// store keeps a provider the way the template search returns it: secrets
// are dropped, the readable config is kept.
func (s *idpServer) store(id string, body map[string]any) {
	s.providers[id] = map[string]any{
		"id": id, "name": body["name"], "type": "PROVIDER_TYPE_GOOGLE",
		"config": map[string]any{
			"options": body["providerOptions"],
			"google":  map[string]any{"clientId": body["clientId"], "scopes": body["scopes"]},
		},
	}
}

func newIDPTestClient(t *testing.T, orgCustom bool) (*HTTPClient, *idpServer) {
	t.Helper()
	policy := newLoginPolicyServer(true, orgCustom, true)
	policy.instance["allowExternalIdp"] = false
	srv := newIDPServer(policy)
	c, _ := newTestClient(t, srv.handler(t))
	return c, srv
}

func TestHTTPClient_EnsureIDP_CreatesAndLinks(t *testing.T) {
	c, srv := newIDPTestClient(t, false)
	out, err := c.EnsureIDP(context.Background(), googleSpec())
	if err != nil {
		t.Fatalf("EnsureIDP() error = %v", err)
	}
	if out.Action != IDPCreated || out.ID == "" || out.Fingerprint != googleSpec().Fingerprint() {
		t.Fatalf("outcome = %+v", out)
	}
	body := srv.bodies["POST /admin/v1/idps/google"]
	if body["clientSecret"] != "google-secret" || body["name"] != "Google" {
		t.Errorf("create body = %v", body)
	}
	if !slices.Contains(srv.links[instanceLoginPolicyIDPsPath], out.ID) {
		t.Errorf("instance policy links = %v, want %s", srv.links[instanceLoginPolicyIDPsPath], out.ID)
	}
}

// TestEnsureIDPPolicyKeepsRegistrationClosed locks in the login policy that
// ADR 0008 derives from the Zitadel v4.20.3 source: JIT creation needs
// allowExternalIdp and the provider options, never allowRegister.
func TestEnsureIDPPolicyKeepsRegistrationClosed(t *testing.T) {
	c, srv := newIDPTestClient(t, true)
	ctx := context.Background()
	if err := c.EnsureRegistrationDisabled(ctx); err != nil {
		t.Fatalf("EnsureRegistrationDisabled() error = %v", err)
	}
	if _, err := c.EnsureIDP(ctx, googleSpec()); err != nil {
		t.Fatalf("EnsureIDP() error = %v", err)
	}
	for name, policy := range map[string]map[string]any{"instance": srv.policy.instance, "org": srv.policy.org} {
		if policy["allowRegister"] != false || policy["allowExternalIdp"] != true || policy["allowUsernamePassword"] != true {
			t.Errorf("%s policy = %v, want allowRegister=false, allowExternalIdp=true, allowUsernamePassword=true",
				name, policy)
		}
	}
	options := srv.bodies["POST /admin/v1/idps/google"]["providerOptions"].(map[string]any)
	want := map[string]any{
		"isCreationAllowed": true, "isAutoCreation": true, "isLinkingAllowed": true,
		"isAutoUpdate": true, "autoLinking": "AUTO_LINKING_OPTION_EMAIL",
	}
	for k, v := range want {
		if options[k] != v {
			t.Errorf("providerOptions.%s = %v, want %v", k, options[k], v)
		}
	}
	org := srv.bodies["POST "+orgLoginPolicyIDPsPath]
	if org["ownerType"] != "IDP_OWNER_TYPE_SYSTEM" {
		t.Errorf("org link body = %v, want the instance provider linked as a system provider", org)
	}
}

func TestHTTPClient_EnsureIDP_SecondRunIsANoOp(t *testing.T) {
	c, srv := newIDPTestClient(t, true)
	first, err := c.EnsureIDP(context.Background(), googleSpec())
	if err != nil {
		t.Fatal(err)
	}
	writes := len(srv.writes)
	spec := googleSpec()
	spec.ExistingFingerprint = first.Fingerprint
	out, err := c.EnsureIDP(context.Background(), spec)
	if err != nil {
		t.Fatal(err)
	}
	if out.Action != IDPUnchanged || out.ID != first.ID {
		t.Errorf("outcome = %+v, want unchanged %s", out, first.ID)
	}
	if len(srv.writes) != writes {
		t.Errorf("second run wrote %v", srv.writes[writes:])
	}
}

func TestHTTPClient_EnsureIDP_UpdatesChangedConfigOrSecret(t *testing.T) {
	c, srv := newIDPTestClient(t, false)
	first, err := c.EnsureIDP(context.Background(), googleSpec())
	if err != nil {
		t.Fatal(err)
	}

	rotated := googleSpec()
	rotated.ClientSecret = "rotated"
	rotated.ExistingFingerprint = first.Fingerprint
	out, err := c.EnsureIDP(context.Background(), rotated)
	if err != nil {
		t.Fatal(err)
	}
	put := "PUT /admin/v1/idps/google/" + first.ID
	if out.Action != IDPUpdated || srv.bodies[put]["clientSecret"] != "rotated" {
		t.Fatalf("outcome = %+v, body = %v, want the rotated secret sent", out, srv.bodies[put])
	}

	renamed := rotated
	renamed.ClientID = "new-id"
	renamed.ExistingFingerprint = renamed.Fingerprint()
	if out, err = c.EnsureIDP(context.Background(), renamed); err != nil || out.Action != IDPUpdated {
		t.Fatalf("outcome = %+v, err = %v, want an update for a new client id", out, err)
	}
	if got := srv.bodies[put]["clientId"]; got != "new-id" {
		t.Errorf("clientId = %v", got)
	}
}

func TestHTTPClient_EnsureIDP_RemovesFromLoginPolicyWhenDisabled(t *testing.T) {
	c, srv := newIDPTestClient(t, true)
	first, err := c.EnsureIDP(context.Background(), googleSpec())
	if err != nil {
		t.Fatal(err)
	}
	out, err := c.EnsureIDP(context.Background(), IDPSpec{Kind: IDPGoogle})
	if err != nil {
		t.Fatal(err)
	}
	if out.Action != IDPRemoved || out.Fingerprint != "" {
		t.Errorf("outcome = %+v, want removed with no fingerprint", out)
	}
	for _, path := range []string{instanceLoginPolicyIDPsPath, orgLoginPolicyIDPsPath} {
		if slices.Contains(srv.links[path], first.ID) {
			t.Errorf("%s still links %s", path, first.ID)
		}
	}
	if _, kept := srv.providers[first.ID]; !kept {
		t.Error("the provider must be kept so existing user links survive")
	}

	writes := len(srv.writes)
	if out, err = c.EnsureIDP(context.Background(), IDPSpec{Kind: IDPGoogle}); err != nil || out.Action != IDPAbsent {
		t.Errorf("second disabled run: outcome = %+v, err = %v, want absent", out, err)
	}
	if len(srv.writes) != writes {
		t.Errorf("second disabled run wrote %v", srv.writes[writes:])
	}
}

func TestHTTPClient_EnsureIDP_DisabledWithoutProviderIsAbsent(t *testing.T) {
	c, srv := newIDPTestClient(t, false)
	out, err := c.EnsureIDP(context.Background(), IDPSpec{Kind: IDPGoogle})
	if err != nil || out.Action != IDPAbsent || len(srv.writes) != 0 {
		t.Errorf("outcome = %+v, err = %v, writes = %v", out, err, srv.writes)
	}
}

func TestHTTPClient_EnsureIDP_ReportsAPIErrors(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 403, map[string]any{"message": "no permission"})
	})
	if _, err := c.EnsureIDP(context.Background(), googleSpec()); !IsUnauthorized(err) {
		t.Fatalf("error = %v, want an unauthorized API error", err)
	}
}

func TestHTTPClient_EnsureIDP_RejectsMalformedResponses(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == adminIDPSearchPath {
			writeJSON(w, 200, map[string]any{"result": []any{}})
			return
		}
		writeJSON(w, 200, map[string]any{})
	})
	_, err := c.EnsureIDP(context.Background(), googleSpec())
	if err == nil || !strings.Contains(err.Error(), "no id") {
		t.Fatalf("error = %v, want the missing id reported", err)
	}
}
