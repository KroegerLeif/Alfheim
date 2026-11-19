package provisioning

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

// zitadelFake is a minimal in-memory v2 project, user and authorization API
// for the operator access calls.
type zitadelFake struct {
	assertion bool
	roles     []string
	grants    []map[string]any // id, user.id, project.id, roles[].key
	updates   int
	// roleConflict makes role creation answer 409 even though the listing
	// found nothing, as in a race.
	roleConflict bool
	// noUsers makes the user listing come back empty.
	noUsers bool
}

func (z *zitadelFake) routes(t *testing.T) map[string]rpcReply {
	return map[string]rpcReply{
		projectService + "GetProject": func(body map[string]any) (int, any) {
			if body["projectId"] != "p1" {
				t.Errorf("GetProject body = %v", body)
			}
			return 200, map[string]any{"project": map[string]any{
				"projectId": "p1", "name": "Alfheim", "organizationId": "org-1",
				"projectRoleAssertion": z.assertion,
			}}
		},
		projectService + "UpdateProject": func(body map[string]any) (int, any) {
			// Only the changed field may be sent: v2 updates are partial.
			if body["projectRoleAssertion"] != true || body["projectId"] != "p1" || len(body) != 2 {
				t.Errorf("UpdateProject body = %v", body)
			}
			z.assertion = true
			z.updates++
			return 200, map[string]any{}
		},
		projectService + "ListProjectRoles": func(map[string]any) (int, any) {
			res := []map[string]any{}
			for _, k := range z.roles {
				res = append(res, map[string]any{"key": k})
			}
			return 200, map[string]any{"projectRoles": res}
		},
		projectService + "AddProjectRole": func(body map[string]any) (int, any) {
			if z.roleConflict {
				return 409, map[string]any{"code": "already_exists", "message": "Role already exists"}
			}
			z.roles = append(z.roles, body["roleKey"].(string))
			return 200, map[string]any{}
		},
		userService + "ListUsers": func(body map[string]any) (int, any) {
			queries, _ := json.Marshal(body["queries"])
			if !strings.Contains(string(queries), `"organizationId":"org-1"`) {
				t.Errorf("ListUsers must be scoped to the project's organisation: %s", queries)
			}
			if z.noUsers {
				return 200, map[string]any{}
			}
			return 200, map[string]any{"result": []map[string]any{{"userId": "u1", "username": "ops@example.com"}}}
		},
		authorizationService + "ListAuthorizations": ok(map[string]any{"authorizations": &z.grants}),
		authorizationService + "CreateAuthorization": func(body map[string]any) (int, any) {
			if body["organizationId"] != "org-1" || body["userId"] != "u1" || body["projectId"] != "p1" {
				t.Errorf("CreateAuthorization body = %v", body)
			}
			z.grants = append(z.grants, grant("g1", body["roleKeys"]))
			return 200, map[string]any{"id": "g1"}
		},
		authorizationService + "UpdateAuthorization": func(body map[string]any) (int, any) {
			if body["id"] != "g1" {
				t.Errorf("UpdateAuthorization body = %v", body)
			}
			z.grants[0] = grant("g1", body["roleKeys"])
			return 200, map[string]any{}
		},
	}
}

// grant builds a v2 authorization of u1 on p1 holding roleKeys.
func grant(id string, roleKeys any) map[string]any {
	roles := []map[string]any{}
	raw, _ := json.Marshal(roleKeys)
	var keys []string
	_ = json.Unmarshal(raw, &keys)
	for _, k := range keys {
		roles = append(roles, map[string]any{"key": k})
	}
	return map[string]any{
		"id": id, "user": map[string]any{"id": "u1"}, "project": map[string]any{"id": "p1"}, "roles": roles,
	}
}

func TestHTTPClient_EnsureRoleAssertion_Idempotent(t *testing.T) {
	z := &zitadelFake{}
	c, _ := newTestClient(t, v2Fake(t, z.routes(t), nil))
	for i := 0; i < 2; i++ {
		if err := c.EnsureRoleAssertion(context.Background(), "p1"); err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
	}
	if !z.assertion {
		t.Error("projectRoleAssertion was not enabled")
	}
	if z.updates != 1 {
		t.Errorf("update count = %d, want 1 (second run must be a no-op)", z.updates)
	}
}

func TestHTTPClient_EnsureProjectRole_CreatesOnceAndToleratesConflict(t *testing.T) {
	z := &zitadelFake{}
	c, _ := newTestClient(t, v2Fake(t, z.routes(t), nil))
	for i := 0; i < 2; i++ {
		if err := c.EnsureProjectRole(context.Background(), "p1", OperatorRole); err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
	}
	if len(z.roles) != 1 || z.roles[0] != "alfheim_operator" {
		t.Errorf("roles = %v", z.roles)
	}

	racy := &zitadelFake{roleConflict: true}
	c, _ = newTestClient(t, v2Fake(t, racy.routes(t), nil))
	if err := c.EnsureProjectRole(context.Background(), "p1", OperatorRole); err != nil {
		t.Errorf("409 must count as already existing, got %v", err)
	}
}

func TestHTTPClient_GrantProjectRole(t *testing.T) {
	z := &zitadelFake{}
	c, _ := newTestClient(t, v2Fake(t, z.routes(t), nil))
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
	z = &zitadelFake{grants: []map[string]any{grant("g1", []string{"viewer"})}}
	c, _ = newTestClient(t, v2Fake(t, z.routes(t), nil))
	if err := c.GrantProjectRole(ctx, "p1", "ops@example.com", "alfheim_operator"); err != nil {
		t.Fatal(err)
	}
	got, _ := json.Marshal(z.grants[0]["roles"])
	if string(got) != `[{"key":"viewer"},{"key":"alfheim_operator"}]` {
		t.Errorf("roles = %s", got)
	}
}

func TestHTTPClient_GrantProjectRole_UnknownUser(t *testing.T) {
	z := &zitadelFake{noUsers: true}
	c, _ := newTestClient(t, v2Fake(t, z.routes(t), nil))
	err := c.GrantProjectRole(context.Background(), "p1", "nobody", "alfheim_operator")
	if err == nil || !strings.Contains(err.Error(), "nobody") {
		t.Errorf("err = %v, want unknown user error", err)
	}
}

func TestHTTPClient_OperatorAccessFailures(t *testing.T) {
	fail := func(map[string]any) (int, any) { return 403, map[string]any{} }
	ctx := context.Background()
	for name, override := range map[string]map[string]rpcReply{
		"project lookup":       {projectService + "GetProject": fail},
		"project without body": {projectService + "GetProject": ok(map[string]any{})},
		"role listing":         {projectService + "ListProjectRoles": fail},
		"user listing":         {userService + "ListUsers": fail},
		"grant listing":        {authorizationService + "ListAuthorizations": fail},
	} {
		z := &zitadelFake{}
		c, _ := newTestClient(t, v2Fake(t, merge(z.routes(t), override), nil))
		errs := []error{
			c.EnsureRoleAssertion(ctx, "p1"),
			c.EnsureProjectRole(ctx, "p1", OperatorRole),
			c.GrantProjectRole(ctx, "p1", "ops@example.com", OperatorRoleKey),
		}
		failed := false
		for _, err := range errs {
			failed = failed || err != nil
		}
		if !failed {
			t.Errorf("%s: no call reported the failure", name)
		}
	}
}
