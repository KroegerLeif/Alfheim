package provisioning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestHTTPClient_WithTokenLeavesTheOriginalAlone(t *testing.T) {
	c := &HTTPClient{BaseURL: "http://x", PAT: "old"}
	clone := c.WithToken("new")
	if c.PAT != "old" || clone.PAT != "new" || clone.BaseURL != "http://x" {
		t.Errorf("original %+v, clone %+v", c, clone)
	}
}

func TestHTTPClient_CurrentUserID(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != userinfoPath {
			t.Errorf("request = %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-pat" {
			t.Errorf("Authorization = %q", r.Header.Get("Authorization"))
		}
		writeJSON(w, http.StatusOK, map[string]any{"sub": "machine-1"})
	})
	id, err := c.CurrentUserID(context.Background())
	if err != nil || id != "machine-1" {
		t.Fatalf("CurrentUserID() = %q, %v", id, err)
	}
}

func TestHTTPClient_CurrentUserIDFailures(t *testing.T) {
	for name, respond := range map[string]func(w http.ResponseWriter){
		"401":      func(w http.ResponseWriter) { writeJSON(w, http.StatusUnauthorized, map[string]any{}) },
		"bad json": func(w http.ResponseWriter) { _, _ = w.Write([]byte("{")) },
		"no sub":   func(w http.ResponseWriter) { writeJSON(w, http.StatusOK, map[string]any{}) },
	} {
		c, _ := newTestClient(t, func(w http.ResponseWriter, _ *http.Request) { respond(w) })
		if _, err := c.CurrentUserID(context.Background()); err == nil {
			t.Errorf("%s: CurrentUserID() error = nil", name)
		}
	}
}

func TestHTTPClient_AddMachineKey(t *testing.T) {
	expires := time.Date(2027, 2, 12, 8, 0, 0, 0, time.FixedZone("CET", 3600))
	keyFile := []byte(`{"type":"serviceaccount","keyId":"key-1"}`)
	c, _ := newTestClient(t, v2Fake(t, map[string]rpcReply{
		userService + "AddKey": func(body map[string]any) (int, any) {
			if body["userId"] != "machine-1" || body["expirationDate"] != "2027-02-12T07:00:00Z" {
				t.Errorf("body = %v", body)
			}
			return 200, map[string]any{
				"keyId": "key-1", "keyContent": base64.StdEncoding.EncodeToString(keyFile),
			}
		},
	}, nil))
	id, data, err := c.AddMachineKey(context.Background(), "machine-1", expires)
	if err != nil || id != "key-1" || string(data) != string(keyFile) {
		t.Fatalf("AddMachineKey() = %q, %q, %v", id, data, err)
	}
}

func TestHTTPClient_AddMachineKeyFailures(t *testing.T) {
	for name, respond := range map[string]func(w http.ResponseWriter){
		"403":      func(w http.ResponseWriter) { writeJSON(w, http.StatusForbidden, map[string]any{}) },
		"bad json": func(w http.ResponseWriter) { _, _ = w.Write([]byte("{")) },
		"bad base64": func(w http.ResponseWriter) {
			writeJSON(w, http.StatusOK, map[string]any{"keyId": "k", "keyContent": "%%"})
		},
		"empty reply": func(w http.ResponseWriter) { writeJSON(w, http.StatusOK, map[string]any{}) },
	} {
		c, _ := newTestClient(t, func(w http.ResponseWriter, _ *http.Request) { respond(w) })
		if _, _, err := c.AddMachineKey(context.Background(), "u", time.Now()); err == nil {
			t.Errorf("%s: AddMachineKey() error = nil", name)
		}
	}
}

func TestHTTPClient_ListAndRemoveCredentials(t *testing.T) {
	var removed []string
	userFilter := func(body map[string]any) {
		raw, _ := json.Marshal(body["filters"])
		if string(raw) != `[{"userIdFilter":{"id":"machine-1"}}]` {
			t.Errorf("filters = %s, want the machine user only", raw)
		}
	}
	c, _ := newTestClient(t, v2Fake(t, map[string]rpcReply{
		userService + "ListKeys": func(body map[string]any) (int, any) {
			userFilter(body)
			// k3 belongs to another user and must never be returned.
			return 200, map[string]any{"result": []map[string]string{
				{"id": "k1", "userId": "machine-1"}, {"id": "k2", "userId": "machine-1"}, {"id": "k3", "userId": "someone"},
			}}
		},
		userService + "ListPersonalAccessTokens": func(body map[string]any) (int, any) {
			userFilter(body)
			return 200, map[string]any{"result": []map[string]string{{"id": "p1"}}}
		},
		userService + "RemoveKey": func(body map[string]any) (int, any) {
			removed = append(removed, "key:"+body["userId"].(string)+"/"+body["keyId"].(string))
			return 200, map[string]any{}
		},
		userService + "RemovePersonalAccessToken": func(body map[string]any) (int, any) {
			removed = append(removed, "pat:"+body["userId"].(string)+"/"+body["tokenId"].(string))
			return 200, map[string]any{}
		},
	}, nil))
	ctx := context.Background()
	keys, err := c.ListMachineKeys(ctx, "machine-1")
	if err != nil || strings.Join(keys, ",") != "k1,k2" {
		t.Errorf("ListMachineKeys() = %v, %v", keys, err)
	}
	pats, err := c.ListPersonalAccessTokens(ctx, "machine-1")
	if err != nil || strings.Join(pats, ",") != "p1" {
		t.Errorf("ListPersonalAccessTokens() = %v, %v", pats, err)
	}
	if err := c.RemoveMachineKey(ctx, "machine-1", "k1"); err != nil {
		t.Errorf("RemoveMachineKey() error = %v", err)
	}
	if err := c.RemovePersonalAccessToken(ctx, "machine-1", "p 1"); err != nil {
		t.Errorf("RemovePersonalAccessToken() error = %v", err)
	}
	if want := "key:machine-1/k1,pat:machine-1/p 1"; strings.Join(removed, ",") != want {
		t.Errorf("removed = %v", removed)
	}
}

func TestHTTPClient_ListIDsFailures(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "ListKeys") {
			writeJSON(w, http.StatusForbidden, map[string]any{})
			return
		}
		_, _ = w.Write([]byte("{"))
	})
	if _, err := c.ListMachineKeys(context.Background(), "u"); err == nil {
		t.Error("ListMachineKeys(403) error = nil")
	}
	if _, err := c.ListPersonalAccessTokens(context.Background(), "u"); err == nil {
		t.Error("ListPersonalAccessTokens(bad json) error = nil")
	}
}
