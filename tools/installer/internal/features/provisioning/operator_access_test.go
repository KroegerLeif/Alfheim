package provisioning

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

// zitadelFake is a minimal in-memory Management API for the operator access
// calls.
type zitadelFake struct {
	assertion bool
	roles     []string
	grants    []map[string]any // id, userId, projectId, roleKeys
	requests  []string
	// roleConflict makes role creation answer 409 even though the search
	// found nothing, as in a race.
	roleConflict bool
}

func (z *zitadelFake) handler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)
		z.requests = append(z.requests, r.Method+" "+r.URL.Path)
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/management/v1/projects/p1":
			writeJSON(w, 200, map[string]any{"project": map[string]any{
				"id": "p1", "name": "Alfheim", "projectRoleAssertion": z.assertion,
				"projectRoleCheck": false, "hasProjectCheck": false,
				"privateLabelingSetting": "PRIVATE_LABELING_SETTING_UNSPECIFIED",
			}})
		case r.Method == http.MethodPut && r.URL.Path == "/management/v1/projects/p1":
			if body["projectRoleAssertion"] != true || body["name"] != "Alfheim" {
				t.Errorf("project update body = %v", body)
			}
			z.assertion = true
			writeJSON(w, 200, map[string]any{})
		case r.URL.Path == "/management/v1/projects/p1/roles/_search":
			res := []map[string]any{}
			for _, k := range z.roles {
				res = append(res, map[string]any{"key": k})
			}
			writeJSON(w, 200, map[string]any{"result": res})
		case r.Method == http.MethodPost && r.URL.Path == "/management/v1/projects/p1/roles":
			if z.roleConflict {
				writeJSON(w, 409, map[string]any{"message": "Role already exists"})
				return
			}
			z.roles = append(z.roles, body["roleKey"].(string))
			writeJSON(w, 200, map[string]any{})
		case r.URL.Path == "/management/v1/users/_search":
			writeJSON(w, 200, map[string]any{"result": []map[string]any{{"id": "u1", "userName": "ops@example.com"}}})
		case r.URL.Path == "/management/v1/users/grants/_search":
			writeJSON(w, 200, map[string]any{"result": z.grants})
		case r.Method == http.MethodPost && r.URL.Path == "/management/v1/users/u1/grants":
			z.grants = append(z.grants, map[string]any{
				"id": "g1", "userId": "u1", "projectId": "p1", "roleKeys": body["roleKeys"],
			})
			writeJSON(w, 200, map[string]any{"userGrantId": "g1"})
		case r.Method == http.MethodPut && r.URL.Path == "/management/v1/users/u1/grants/g1":
			z.grants[0]["roleKeys"] = body["roleKeys"]
			writeJSON(w, 200, map[string]any{})
		default:
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			writeJSON(w, 500, map[string]any{})
		}
	}
}

func TestHTTPClient_EnsureRoleAssertion_IdempotentAndKeepsSettings(t *testing.T) {
	z := &zitadelFake{}
	c, _ := newTestClient(t, z.handler(t))
	for i := 0; i < 2; i++ {
		if err := c.EnsureRoleAssertion(context.Background(), "p1"); err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
	}
	if !z.assertion {
		t.Error("projectRoleAssertion was not enabled")
	}
	puts := 0
	for _, r := range z.requests {
		if strings.HasPrefix(r, "PUT") {
			puts++
		}
	}
	if puts != 1 {
		t.Errorf("PUT count = %d, want 1 (second run must be a no-op)", puts)
	}
}

func TestHTTPClient_EnsureProjectRole_CreatesOnceAndToleratesConflict(t *testing.T) {
	z := &zitadelFake{}
	c, _ := newTestClient(t, z.handler(t))
	for i := 0; i < 2; i++ {
		if err := c.EnsureProjectRole(context.Background(), "p1", OperatorRole); err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
	}
	if len(z.roles) != 1 || z.roles[0] != "alfheim_operator" {
		t.Errorf("roles = %v", z.roles)
	}

	racy := &zitadelFake{roleConflict: true}
	c, _ = newTestClient(t, racy.handler(t))
	if err := c.EnsureProjectRole(context.Background(), "p1", OperatorRole); err != nil {
		t.Errorf("409 must count as already existing, got %v", err)
	}
}

func TestHTTPClient_GrantProjectRole(t *testing.T) {
	z := &zitadelFake{}
	c, _ := newTestClient(t, z.handler(t))
	ctx := context.Background()

	for i := 0; i < 2; i++ {
		if err := c.GrantProjectRole(ctx, "p1", "ops@example.com", "alfheim_operator"); err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
	}
	if len(z.grants) != 1 {
		t.Fatalf("grants = %v, want exactly one", z.grants)
	}

	// A user holding another role keeps it.
	z = &zitadelFake{grants: []map[string]any{
		{"id": "g1", "userId": "u1", "projectId": "p1", "roleKeys": []string{"viewer"}},
	}}
	c, _ = newTestClient(t, z.handler(t))
	if err := c.GrantProjectRole(ctx, "p1", "ops@example.com", "alfheim_operator"); err != nil {
		t.Fatal(err)
	}
	got, _ := json.Marshal(z.grants[0]["roleKeys"])
	if string(got) != `["viewer","alfheim_operator"]` {
		t.Errorf("roleKeys = %s", got)
	}
}

func TestHTTPClient_GrantProjectRole_UnknownUser(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]any{"result": []any{}})
	})
	err := c.GrantProjectRole(context.Background(), "p1", "nobody", "alfheim_operator")
	if err == nil || !strings.Contains(err.Error(), "nobody") {
		t.Errorf("err = %v, want unknown user error", err)
	}
}
