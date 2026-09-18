package membership

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/household/internal/features/household"
)

const (
	token = "s3cret-internal-token"
	hhID  = "0b9f6c2e-4f5a-4c1d-9e0a-6a1c2b3d4e5f"
)

type fakeReader struct {
	roles map[string]household.HouseholdRole // key: household|user
	err   error
}

func (f *fakeReader) GetMemberRole(ctx context.Context, householdID, userID string) (household.HouseholdRole, error) {
	if f.err != nil {
		return "", f.err
	}
	role, ok := f.roles[householdID+"|"+userID]
	if !ok {
		return "", household.ErrUnauthorizedHouseholdAccess
	}
	return role, nil
}

func newRouter(reader Reader, internalToken string, logBuf *bytes.Buffer) http.Handler {
	var w io.Writer = io.Discard
	if logBuf != nil {
		w = logBuf
	}
	r := chi.NewRouter()
	NewHandler(reader, internalToken, slog.New(slog.NewTextHandler(w, nil))).RegisterRoutes(r)
	return r
}

func do(h http.Handler, path, auth string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestGetMembership(t *testing.T) {
	reader := &fakeReader{roles: map[string]household.HouseholdRole{hhID + "|user-sub-1": household.RoleAdmin}}
	h := newRouter(reader, token, nil)
	path := "/internal/v1/memberships/" + hhID + "/user-sub-1"

	t.Run("200 for a member", func(t *testing.T) {
		rec := do(h, path, "Bearer "+token)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		var got Response
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if got != (Response{HouseholdID: hhID, UserID: "user-sub-1", Role: "ADMIN"}) {
			t.Errorf("unexpected body %+v", got)
		}
	})

	t.Run("upper-case UUID is normalised", func(t *testing.T) {
		rec := do(h, "/internal/v1/memberships/"+strings.ToUpper(hhID)+"/user-sub-1", "bearer "+token)
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), hhID) {
			t.Errorf("expected 200 with normalised id, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("404 for non-member or missing household", func(t *testing.T) {
		if rec := do(h, "/internal/v1/memberships/"+hhID+"/stranger", "Bearer "+token); rec.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", rec.Code)
		}
		if rec := do(h, "/internal/v1/memberships/11111111-1111-1111-1111-111111111111/user-sub-1", "Bearer "+token); rec.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", rec.Code)
		}
	})

	t.Run("401 on missing or bad token", func(t *testing.T) {
		for _, auth := range []string{"", "Bearer", "Bearer wrong", "Basic " + token, token, "Bearer " + token + "x"} {
			if rec := do(h, path, auth); rec.Code != http.StatusUnauthorized {
				t.Errorf("auth %q: expected 401, got %d", auth, rec.Code)
			}
		}
	})

	t.Run("400 on non-UUID household id", func(t *testing.T) {
		if rec := do(h, "/internal/v1/memberships/not-a-uuid/user-sub-1", "Bearer "+token); rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("token is checked before input validation", func(t *testing.T) {
		if rec := do(h, "/internal/v1/memberships/not-a-uuid/user-sub-1", "Bearer wrong"); rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("500 on repository failure", func(t *testing.T) {
		failing := newRouter(&fakeReader{err: errors.New("db down")}, token, nil)
		if rec := do(failing, path, "Bearer "+token); rec.Code != http.StatusInternalServerError {
			t.Errorf("expected 500, got %d", rec.Code)
		}
	})
}

func TestGetMembership_DisabledWithoutToken(t *testing.T) {
	var logs bytes.Buffer
	h := newRouter(&fakeReader{}, "", &logs)
	if !strings.Contains(logs.String(), "ALFHEIM_INTERNAL_TOKEN") {
		t.Errorf("expected startup warning, got %q", logs.String())
	}
	for _, auth := range []string{"", "Bearer ", "Bearer anything"} {
		if rec := do(h, "/internal/v1/memberships/"+hhID+"/u", auth); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("auth %q: expected 503, got %d", auth, rec.Code)
		}
	}
}
