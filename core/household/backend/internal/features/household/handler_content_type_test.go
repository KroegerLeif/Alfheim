package household

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/household/internal/shared/httpjson"
	"alfheim/household/internal/shared/middleware"
)

// Error bodies must be labelled application/json: the frontend's HTTP client
// only parses JSON bodies, so a text/plain label hid the backend's message
// behind a raw JSON string (issue #574).
func TestHouseholdHandler_ErrorBodiesAreJSON(t *testing.T) {
	failing := errors.New("db down")
	svc := &mockService{
		joinHouseholdFn: func(ctx context.Context, claims *middleware.UserClaims, token string) (*HouseholdResponse, error) {
			return nil, ErrMemberAlreadyExists
		},
		createHouseholdFn: func(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error) {
			return nil, ErrHouseholdSlugExists
		},
		transferOwnershipFn: func(ctx context.Context, requesterID, householdID, targetUserID string) (*HouseholdResponse, error) {
			return nil, ErrInvalidTransferTarget
		},
		getUserHouseholdsFn: func(ctx context.Context, userID string) ([]HouseholdResponse, error) {
			return nil, failing
		},
	}
	r := chi.NewRouter()
	NewHandler(svc).RegisterRoutes(r, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, withUserClaims(req, &middleware.UserClaims{Subject: "user-1"}))
		})
	})

	cases := []struct {
		method, path, body string
		status             int
		code, message      string
	}{
		{http.MethodPost, "/api/v1/households/join", `{"token":"t"}`, http.StatusConflict, "conflict", "you are already a member of this household"},
		{http.MethodPost, "/api/v1/households", `{"name":"Home"}`, http.StatusConflict, "conflict", "household slug already in use"},
		{http.MethodPost, "/api/v1/households/hh-1/transfer-ownership", `{"user_id":"u"}`, http.StatusBadRequest, "bad_request", "user_id must be another member of the household"},
		{http.MethodPost, "/api/v1/households", `{`, http.StatusBadRequest, "bad_request", "invalid json payload"},
		{http.MethodGet, "/api/v1/households/me", ``, http.StatusInternalServerError, "internal_server_error", "failed to fetch user households"},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, bytes.NewBufferString(tc.body)))

			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d", rec.Code, tc.status)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Fatalf("content type = %q, want application/json", ct)
			}
			var body httpjson.ErrorBody
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if body.Error != tc.code || body.Message != tc.message {
				t.Fatalf("body = %+v", body)
			}
		})
	}
}

func TestHouseholdHandler_MissingClaimsIsJSONUnauthorized(t *testing.T) {
	rec := httptest.NewRecorder()
	NewHandler(&mockService{}).GetMyHouseholds(rec, httptest.NewRequest(http.MethodGet, "/api/v1/households/me", nil))

	var body httpjson.ErrorBody
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if rec.Code != http.StatusUnauthorized || body.Error != "unauthorized" || body.Message == "" {
		t.Fatalf("unexpected response %d %+v", rec.Code, body)
	}
}
