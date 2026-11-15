package provisioning

import (
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

// rpcReply answers one fake v2 call with a status and a JSON body.
type rpcReply func(body map[string]any) (int, any)

// ok wraps a fixed 200 answer.
func ok(v any) rpcReply {
	return func(map[string]any) (int, any) { return http.StatusOK, v }
}

// identityRoutes answer the two calls that resolve the token's user and its
// organisation (u-machine in org-1).
func identityRoutes() map[string]rpcReply {
	return map[string]rpcReply{
		userinfoPath: ok(map[string]any{"sub": "u-machine"}),
		userService + "GetUserByID": ok(map[string]any{
			"user": map[string]any{"userId": "u-machine", "details": map[string]any{"resourceOwner": "org-1"}},
		}),
	}
}

// v2Fake routes requests by exact path; an unknown path fails the test.
// Every request path is recorded in order.
func v2Fake(t *testing.T, routes map[string]rpcReply, seen *[]string) http.HandlerFunc {
	t.Helper()
	return func(w http.ResponseWriter, r *http.Request) {
		if seen != nil {
			*seen = append(*seen, r.URL.Path)
		}
		reply, found := routes[r.URL.Path]
		if !found {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			writeJSON(w, http.StatusNotFound, map[string]any{"code": "not_found"})
			return
		}
		if r.URL.Path != userinfoPath && r.Method != http.MethodPost {
			t.Errorf("%s must be a POST, got %s", r.URL.Path, r.Method)
		}
		raw, _ := io.ReadAll(r.Body)
		body := map[string]any{}
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, &body); err != nil {
				t.Errorf("%s: request body is not JSON: %v", r.URL.Path, err)
			}
		}
		status, v := reply(body)
		writeJSON(w, status, v)
	}
}

// merge returns the union of route sets; later sets win.
func merge(sets ...map[string]rpcReply) map[string]rpcReply {
	out := map[string]rpcReply{}
	for _, s := range sets {
		for k, v := range s {
			out[k] = v
		}
	}
	return out
}
