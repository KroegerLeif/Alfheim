package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

// machineFake is an in-memory Zitadel for EnsureMachineUser: the user listing,
// v2 CreateUser and AddSecret, and the v1 machine update.
type machineFake struct {
	userID       string // empty: the user does not exist yet
	created      int
	secrets      int
	machineBody  map[string]any
	updateStatus int
	createNoID   bool
	emptySecret  bool
}

func (m *machineFake) handler(t *testing.T) http.HandlerFunc {
	routes := merge(identityRoutes(), map[string]rpcReply{
		userService + "ListUsers": func(map[string]any) (int, any) {
			if m.userID == "" {
				return 200, map[string]any{"result": []any{}}
			}
			return 200, map[string]any{"result": []any{map[string]any{"userId": m.userID, "username": IntegrationsUserName}}}
		},
		userService + "CreateUser": func(body map[string]any) (int, any) {
			machine, _ := body["machine"].(map[string]any)
			if body["organizationId"] != "org-1" || body["username"] != IntegrationsUserName || machine["name"] == "" {
				t.Errorf("CreateUser body = %v", body)
			}
			m.created++
			if m.createNoID {
				return 200, map[string]any{}
			}
			m.userID = "u-int"
			return 200, map[string]any{"id": m.userID}
		},
		userService + "AddSecret": func(body map[string]any) (int, any) {
			if body["userId"] != m.userID {
				t.Errorf("AddSecret body = %v", body)
			}
			m.secrets++
			if m.emptySecret {
				return 200, map[string]any{}
			}
			return 200, map[string]any{"clientSecret": "fresh-secret"}
		},
	})
	v2 := v2Fake(t, routes, nil)
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/management/v1/users/") {
			if r.Method != http.MethodPut || r.URL.Path != "/management/v1/users/"+m.userID+"/machine" {
				t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
			}
			raw, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(raw, &m.machineBody)
			if m.updateStatus != 0 {
				message := "permission denied"
				if m.updateStatus == http.StatusBadRequest {
					message = "No changes"
				}
				writeJSON(w, m.updateStatus, map[string]any{"code": 9, "message": message})
				return
			}
			writeJSON(w, 200, map[string]any{})
			return
		}
		v2(w, r)
	}
}

func integrationsSpec(id, secret string) MachineUserSpec {
	spec := BuildInput("Alfheim", "https://x.example", false, nil).IntegrationsUser
	spec.ExistingClientID, spec.ExistingClientSecret = id, secret
	return spec
}

func TestEnsureMachineUser_CreatesUserWithJWTTokensAndSecret(t *testing.T) {
	fake := &machineFake{}
	c, _ := newTestClient(t, fake.handler(t))

	creds, err := c.EnsureMachineUser(context.Background(), integrationsSpec(IntegrationsUserName, "stale"))
	if err != nil {
		t.Fatal(err)
	}
	if creds != (MachineCredentials{UserID: "u-int", ClientID: IntegrationsUserName, ClientSecret: "fresh-secret"}) {
		t.Fatalf("creds = %+v", creds)
	}
	if fake.created != 1 || fake.secrets != 1 || fake.machineBody["accessTokenType"] != machineAccessTokenTypeJWT {
		t.Fatalf("created=%d secrets=%d body=%v", fake.created, fake.secrets, fake.machineBody)
	}
}

func TestEnsureMachineUser_IsIdempotent(t *testing.T) {
	fake := &machineFake{userID: "u-int", updateStatus: http.StatusBadRequest}
	c, _ := newTestClient(t, fake.handler(t))

	creds, err := c.EnsureMachineUser(context.Background(), integrationsSpec(IntegrationsUserName, "kept"))
	if err != nil || creds.ClientSecret != "kept" || fake.created != 0 || fake.secrets != 0 {
		t.Fatalf("creds=%+v err=%v created=%d secrets=%d", creds, err, fake.created, fake.secrets)
	}

	// No secret on file for the existing user: a new one is generated.
	creds, err = c.EnsureMachineUser(context.Background(), integrationsSpec("", ""))
	if err != nil || creds.ClientSecret != "fresh-secret" || fake.secrets != 1 {
		t.Fatalf("creds=%+v err=%v secrets=%d", creds, err, fake.secrets)
	}
}

func TestEnsureMachineUser_Errors(t *testing.T) {
	c, _ := newTestClient(t, (&machineFake{}).handler(t))
	if _, err := c.EnsureMachineUser(context.Background(), MachineUserSpec{}); err == nil {
		t.Fatal("expected an error for an empty user name")
	}
	for name, fake := range map[string]*machineFake{
		"no id":        {createNoID: true},
		"empty secret": {emptySecret: true},
	} {
		c, _ := newTestClient(t, fake.handler(t))
		if _, err := c.EnsureMachineUser(context.Background(), integrationsSpec("", "")); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
	failing := &machineFake{userID: "u-int", updateStatus: http.StatusForbidden}
	c, _ = newTestClient(t, failing.handler(t))
	if _, err := c.EnsureMachineUser(context.Background(), integrationsSpec("", "")); err == nil {
		t.Fatal("expected the machine update error")
	}
}

func TestProvision_IntegrationsUser(t *testing.T) {
	in := BuildInput("Alfheim", "https://alfheim.example", false, AppSlugs)
	c := newFakeClient()
	res, err := Provision(context.Background(), c, in, map[string]string{
		IntegrationsClientIDEnvKey: IntegrationsUserName, IntegrationsClientSecretEnvKey: "__PROVISIONED__",
	})
	if err != nil {
		t.Fatal(err)
	}
	env := res.EnvUpdates()
	if env[IntegrationsPrincipalEnvKey] != "u-alfheim-integrations" || env[IntegrationsClientIDEnvKey] != IntegrationsUserName ||
		env[IntegrationsClientSecretEnvKey] != "generated-secret" {
		t.Fatalf("env = %v", env)
	}
	if got := c.machineSpecs[0].ExistingClientSecret; got != "" {
		t.Fatalf("placeholder secret must not be reused, got %q", got)
	}

	// A fresh install fails on an error; an existing one only warns and keeps .env as it is.
	c = newFakeClient()
	c.machineErr = errors.New("permission denied")
	if _, err := Provision(context.Background(), c, in, map[string]string{}); err == nil {
		t.Fatal("expected a fresh install to fail")
	}
	res, err = Provision(context.Background(), c, in, map[string]string{"ALFHEIM_WEB_CLIENT_ID": "web-1"})
	if err != nil || len(res.Warnings) != 1 || !strings.Contains(res.Warnings[0], IntegrationsUserName) {
		t.Fatalf("warnings = %v err=%v", res.Warnings, err)
	}
	if _, ok := res.EnvUpdates()[IntegrationsClientSecretEnvKey]; ok {
		t.Fatal("a failed reconcile must not blank the stored secret")
	}

	// A zero spec skips the user entirely.
	c = newFakeClient()
	in.IntegrationsUser = MachineUserSpec{}
	if _, err := Provision(context.Background(), c, in, map[string]string{}); err != nil || len(c.machineSpecs) != 0 {
		t.Fatalf("err=%v specs=%v", err, c.machineSpecs)
	}
}
