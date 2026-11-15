package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

// emailServer is a stateful fake of the Admin API e-mail provider endpoints,
// on top of loginPolicyServer's login policies.
type emailServer struct {
	policy    *loginPolicyServer
	providers []map[string]any
	writes    []string
	bodies    map[string]map[string]any
	nextID    int
}

func (s *emailServer) handler(t *testing.T) http.HandlerFunc {
	policyHandler := s.policy.handler(t)
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if !strings.HasPrefix(path, adminEmailPath) {
			policyHandler(w, r)
			return
		}
		var body map[string]any
		if r.Method != http.MethodDelete {
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("decode %s %s: %v", r.Method, path, err)
			}
		}
		if path != adminEmailProvidersSearchPath {
			s.writes = append(s.writes, r.Method+" "+path)
			s.bodies[r.Method+" "+path] = body
		}
		switch {
		case path == adminEmailProvidersSearchPath:
			writeJSON(w, 200, map[string]any{"result": s.providers})
		case path == adminEmailSMTPPath && r.Method == http.MethodPost:
			s.nextID++
			id := fmt.Sprintf("smtp-%d", s.nextID)
			s.providers = append(s.providers, providerView(id, "EMAIL_PROVIDER_INACTIVE", body))
			writeJSON(w, 200, map[string]any{"id": id})
		case strings.HasPrefix(path, adminEmailSMTPPath+"/") && r.Method == http.MethodPut:
			p := s.find(t, strings.TrimPrefix(path, adminEmailSMTPPath+"/"))
			*p = providerView((*p)["id"].(string), (*p)["state"].(string), body)
			writeJSON(w, 200, map[string]any{})
		case strings.HasSuffix(path, "/_activate"):
			id := strings.TrimSuffix(strings.TrimPrefix(path, adminEmailPath+"/"), "/_activate")
			for i := range s.providers {
				s.providers[i]["state"] = "EMAIL_PROVIDER_INACTIVE"
			}
			(*s.find(t, id))["state"] = emailProviderActive
			writeJSON(w, 200, map[string]any{})
		case r.Method == http.MethodDelete:
			id := strings.TrimPrefix(path, adminEmailPath+"/")
			kept := s.providers[:0]
			for _, p := range s.providers {
				if p["id"] != id {
					kept = append(kept, p)
				}
			}
			s.providers = kept
			writeJSON(w, 200, map[string]any{})
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, path)
		}
	}
}

func (s *emailServer) find(t *testing.T, id string) *map[string]any {
	for i := range s.providers {
		if s.providers[i]["id"] == id {
			return &s.providers[i]
		}
	}
	t.Fatalf("no provider %q", id)
	return nil
}

// providerView is a provider the way the list returns it: the password is
// dropped, PLAIN auth shows as an empty object.
func providerView(id, state string, body map[string]any) map[string]any {
	view := map[string]any{
		"host": body["host"], "user": body["user"], "tls": body["tls"],
		"senderAddress": body["senderAddress"], "senderName": body["senderName"],
	}
	if _, ok := body["plain"]; ok {
		view["plain"] = map[string]any{}
	} else {
		view["none"] = map[string]any{}
	}
	return map[string]any{"id": id, "state": state, "description": body["description"], "smtp": view}
}

func newEmailTestClient(t *testing.T, orgCustom bool) (*HTTPClient, *emailServer) {
	t.Helper()
	srv := &emailServer{policy: newLoginPolicyServer(false, orgCustom, false), bodies: map[string]map[string]any{}}
	c, _ := newTestClient(t, srv.handler(t))
	return c, srv
}

func smtpTestSpec() SMTPSpec {
	return SMTPSpec{
		Host: "smtp.example.com", Port: "587", User: "alfheim", Password: "mail-secret",
		SenderAddress: "alfheim@example.com", SenderName: "Alfheim", TLS: true,
	}
}

func TestHTTPClient_EnsureSMTP_CreatesActivatesAndIsIdempotent(t *testing.T) {
	c, srv := newEmailTestClient(t, false)
	srv.policy.instance["hidePasswordReset"] = true
	spec := smtpTestSpec()

	out, err := c.EnsureSMTP(context.Background(), spec)
	if err != nil {
		t.Fatalf("EnsureSMTP() error = %v", err)
	}
	if out.Action != SMTPCreated || out.ID != "smtp-1" || out.Fingerprint != spec.Fingerprint() || !out.MailWorks() {
		t.Errorf("outcome = %+v", out)
	}
	body := srv.bodies["POST "+adminEmailSMTPPath]
	if body["host"] != "smtp.example.com:587" || body["plain"].(map[string]any)["password"] != "mail-secret" ||
		body["description"] != SMTPProviderDescription || body["tls"] != true {
		t.Errorf("create body = %v", body)
	}
	if srv.providers[0]["state"] != emailProviderActive {
		t.Error("the created provider must be activated")
	}
	if srv.policy.instance["hidePasswordReset"] != false {
		t.Error("turning e-mail on must show the password reset link again")
	}

	// The second run, with the recorded fingerprint, writes nothing.
	spec.ExistingFingerprint = out.Fingerprint
	writes, puts := len(srv.writes), len(srv.policy.puts)
	out, err = c.EnsureSMTP(context.Background(), spec)
	if err != nil {
		t.Fatalf("second EnsureSMTP() error = %v", err)
	}
	if out.Action != SMTPUnchanged || len(srv.writes) != writes || len(srv.policy.puts) != puts {
		t.Errorf("second run: outcome = %+v, writes = %v, policy puts = %v", out, srv.writes[writes:], srv.policy.puts[puts:])
	}
}

func TestHTTPClient_EnsureSMTP_UpdatesOnChange(t *testing.T) {
	for name, change := range map[string]func(*SMTPSpec){
		"password rotated": func(s *SMTPSpec) { s.Password = "rotated" },
		"host changed":     func(s *SMTPSpec) { s.Host = "mail.example.com" },
		"auth dropped":     func(s *SMTPSpec) { s.User, s.Password = "", "" },
	} {
		t.Run(name, func(t *testing.T) {
			c, srv := newEmailTestClient(t, false)
			spec := smtpTestSpec()
			first, err := c.EnsureSMTP(context.Background(), spec)
			if err != nil {
				t.Fatal(err)
			}
			change(&spec)
			spec.ExistingFingerprint = first.Fingerprint
			out, err := c.EnsureSMTP(context.Background(), spec)
			if err != nil {
				t.Fatalf("EnsureSMTP() error = %v", err)
			}
			body := srv.bodies["PUT "+adminEmailSMTPPath+"/smtp-1"]
			if out.Action != SMTPUpdated || out.Fingerprint != spec.Fingerprint() || body == nil {
				t.Fatalf("outcome = %+v, update body = %v", out, body)
			}
			if spec.User == "" && body["none"] == nil {
				t.Errorf("a relay without user must use no auth, body = %v", body)
			}
		})
	}
}

func TestHTTPClient_EnsureSMTP_ReactivatesAnInactiveProvider(t *testing.T) {
	c, srv := newEmailTestClient(t, false)
	spec := smtpTestSpec()
	first, err := c.EnsureSMTP(context.Background(), spec)
	if err != nil {
		t.Fatal(err)
	}
	srv.providers[0]["state"] = "EMAIL_PROVIDER_INACTIVE"
	spec.ExistingFingerprint = first.Fingerprint
	out, err := c.EnsureSMTP(context.Background(), spec)
	if err != nil || out.Action != SMTPUpdated || srv.providers[0]["state"] != emailProviderActive {
		t.Errorf("outcome = %+v, err = %v, state = %v", out, err, srv.providers[0]["state"])
	}
}

func TestHTTPClient_EnsureSMTP_DisabledRemovesOursAndHidesReset(t *testing.T) {
	c, srv := newEmailTestClient(t, true)
	if _, err := c.EnsureSMTP(context.Background(), smtpTestSpec()); err != nil {
		t.Fatal(err)
	}
	out, err := c.EnsureSMTP(context.Background(), SMTPSpec{ExistingFingerprint: "old"})
	if err != nil {
		t.Fatalf("EnsureSMTP() error = %v", err)
	}
	if out.Action != SMTPRemoved || out.ID != "smtp-1" || !out.PasswordResetHidden || out.MailWorks() {
		t.Errorf("outcome = %+v", out)
	}
	if len(srv.providers) != 0 {
		t.Errorf("providers = %v, want ours removed", srv.providers)
	}
	for _, policy := range []map[string]any{srv.policy.instance, srv.policy.org} {
		if policy["hidePasswordReset"] != true {
			t.Errorf("policy = %v, want the password reset link hidden", policy)
		}
	}

	// Nothing left to remove: a repeated run only confirms the policy.
	writes, puts := len(srv.writes), len(srv.policy.puts)
	out, err = c.EnsureSMTP(context.Background(), SMTPSpec{})
	if err != nil || out.Action != SMTPAbsent || len(srv.writes) != writes || len(srv.policy.puts) != puts {
		t.Errorf("repeat: outcome = %+v, err = %v, writes = %v", out, err, srv.writes[writes:])
	}
}

func TestHTTPClient_EnsureSMTP_LeavesAConsoleProviderAlone(t *testing.T) {
	c, srv := newEmailTestClient(t, false)
	srv.providers = []map[string]any{
		providerView("console-1", emailProviderActive, map[string]any{"host": "relay:25", "description": "by hand"}),
	}
	out, err := c.EnsureSMTP(context.Background(), SMTPSpec{})
	if err != nil {
		t.Fatalf("EnsureSMTP() error = %v", err)
	}
	if out.Action != SMTPAbsent || !out.ExternalProvider || out.PasswordResetHidden {
		t.Errorf("outcome = %+v", out)
	}
	if len(srv.writes) != 0 || len(srv.policy.puts) != 0 || len(srv.providers) != 1 {
		t.Errorf("writes = %v, policy puts = %v; a console provider must stay untouched", srv.writes, srv.policy.puts)
	}
}

func TestHTTPClient_EnsureSMTP_Errors(t *testing.T) {
	for name, handler := range map[string]http.HandlerFunc{
		"list fails": func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, 403, map[string]any{"message": "forbidden"})
		},
		"list undecodable": func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("{"))
		},
		"create without id": func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == adminEmailProvidersSearchPath {
				writeJSON(w, 200, map[string]any{"result": []any{}})
				return
			}
			writeJSON(w, 200, map[string]any{})
		},
		"create undecodable": func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == adminEmailProvidersSearchPath {
				writeJSON(w, 200, map[string]any{"result": []any{}})
				return
			}
			_, _ = w.Write([]byte("{"))
		},
		"create rejected": func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == adminEmailProvidersSearchPath {
				writeJSON(w, 200, map[string]any{"result": []any{}})
				return
			}
			writeJSON(w, 400, map[string]any{"message": "invalid"})
		},
	} {
		t.Run(name, func(t *testing.T) {
			c, _ := newTestClient(t, handler)
			if _, err := c.EnsureSMTP(context.Background(), smtpTestSpec()); err == nil {
				t.Error("want an error")
			}
		})
	}
}

func TestHTTPClient_EnsureSMTP_PolicyErrors(t *testing.T) {
	providers := []map[string]any{providerView("smtp-1", emailProviderActive, map[string]any{
		"host": "smtp.example.com:587", "description": SMTPProviderDescription,
	})}
	for name, enabled := range map[string]bool{"turning on": true, "turning off": false} {
		t.Run(name, func(t *testing.T) {
			c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
				switch {
				case r.URL.Path == adminEmailProvidersSearchPath:
					writeJSON(w, 200, map[string]any{"result": providers})
				case strings.HasPrefix(r.URL.Path, adminEmailPath):
					writeJSON(w, 200, map[string]any{"id": "smtp-1"})
				default:
					writeJSON(w, 403, map[string]any{"message": "forbidden"})
				}
			})
			spec := SMTPSpec{}
			if enabled {
				spec = smtpTestSpec()
			}
			if _, err := c.EnsureSMTP(context.Background(), spec); err == nil || !strings.Contains(err.Error(), "login policy") {
				t.Errorf("EnsureSMTP() error = %v, want a login policy error", err)
			}
		})
	}
}
