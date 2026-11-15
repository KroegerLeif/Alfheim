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
		if r.Method != http.MethodGet || r.URL.Path != "/auth/v1/users/me" {
			t.Errorf("request = %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-pat" {
			t.Errorf("Authorization = %q", r.Header.Get("Authorization"))
		}
		writeJSON(w, http.StatusOK, map[string]any{"user": map[string]any{"id": "machine-1"}})
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
		"no id":    func(w http.ResponseWriter) { writeJSON(w, http.StatusOK, map[string]any{"user": map[string]any{}}) },
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
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/management/v1/users/machine-1/keys" {
			t.Errorf("request = %s %s", r.Method, r.URL.Path)
		}
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["type"] != "KEY_TYPE_JSON" || body["expirationDate"] != "2027-02-12T07:00:00Z" {
			t.Errorf("body = %v", body)
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"keyId": "key-1", "keyDetails": base64.StdEncoding.EncodeToString(keyFile),
		})
	})
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
			writeJSON(w, http.StatusOK, map[string]any{"keyId": "k", "keyDetails": "%%"})
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
	var deleted []string
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/keys/_search"):
			writeJSON(w, http.StatusOK, map[string]any{"result": []map[string]string{{"id": "k1"}, {"id": "k2"}}})
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/pats/_search"):
			writeJSON(w, http.StatusOK, map[string]any{"result": []map[string]string{{"id": "p1"}}})
		case r.Method == http.MethodDelete:
			deleted = append(deleted, r.URL.Path)
			writeJSON(w, http.StatusOK, map[string]any{})
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
	})
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
	want := "/management/v1/users/machine-1/keys/k1,/management/v1/users/machine-1/pats/p 1"
	if strings.Join(deleted, ",") != want {
		t.Errorf("deleted = %v", deleted)
	}
}

func TestHTTPClient_ListIDsFailures(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "keys") {
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
