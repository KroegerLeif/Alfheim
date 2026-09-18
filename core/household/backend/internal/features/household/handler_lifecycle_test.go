package household

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"alfheim/household/internal/shared/middleware"
	"github.com/go-chi/chi/v5"
)

// newTestRouter mounts all household routes behind a fake auth middleware that
// injects claims for "user-1" unless noAuth is set.
func newTestRouter(svc Service, noAuth bool) http.Handler {
	r := chi.NewRouter()
	NewHandler(svc).RegisterRoutes(r, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if !noAuth {
				req = req.WithContext(context.WithValue(req.Context(), middleware.UserContextKey, &middleware.UserClaims{Subject: "user-1"}))
			}
			next.ServeHTTP(w, req)
		})
	})
	return r
}

type routeCase struct {
	name       string
	method     string
	path       string
	body       string
	svc        *mockService
	noAuth     bool
	wantStatus int
	wantSubstr string
}

func runRouteCases(t *testing.T, cases []routeCase) {
	t.Helper()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := tc.svc
			if svc == nil {
				svc = &mockService{}
			}
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			// Clients still send these headers; they must never influence authorization.
			req.Header.Set("X-Household-ID", "some-other-household")
			req.Header.Set("X-Household-Role", "OWNER")
			rec := httptest.NewRecorder()
			newTestRouter(svc, tc.noAuth).ServeHTTP(rec, req)
			if rec.Code != tc.wantStatus {
				t.Errorf("expected status %d, got %d (body %q)", tc.wantStatus, rec.Code, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), tc.wantSubstr) {
				t.Errorf("expected body to contain %q, got %q", tc.wantSubstr, rec.Body.String())
			}
		})
	}
}

func TestHouseholdHandler_RenameHousehold(t *testing.T) {
	const path = "/api/v1/households/hh-1"
	runRouteCases(t, []routeCase{
		{name: "unauthorized", method: http.MethodPatch, path: path, body: `{"name":"x"}`, noAuth: true, wantStatus: http.StatusUnauthorized, wantSubstr: "unauthorized"},
		{name: "invalid json", method: http.MethodPatch, path: path, body: `{`, wantStatus: http.StatusBadRequest, wantSubstr: "invalid json payload"},
		{
			name: "invalid name", method: http.MethodPatch, path: path, body: `{"name":""}`,
			svc: &mockService{renameHouseholdFn: func(ctx context.Context, requesterID, householdID string, req RenameHouseholdRequest) (*HouseholdResponse, error) {
				return nil, ErrInvalidHouseholdName
			}},
			wantStatus: http.StatusBadRequest, wantSubstr: "household name",
		},
		{
			name: "forbidden for member", method: http.MethodPatch, path: path, body: `{"name":"New"}`,
			svc: &mockService{renameHouseholdFn: func(ctx context.Context, requesterID, householdID string, req RenameHouseholdRequest) (*HouseholdResponse, error) {
				return nil, ErrUnauthorizedHouseholdAccess
			}},
			wantStatus: http.StatusForbidden, wantSubstr: "forbidden",
		},
		{
			name: "not found", method: http.MethodPatch, path: path, body: `{"name":"New"}`,
			svc: &mockService{renameHouseholdFn: func(ctx context.Context, requesterID, householdID string, req RenameHouseholdRequest) (*HouseholdResponse, error) {
				return nil, ErrHouseholdNotFound
			}},
			wantStatus: http.StatusNotFound, wantSubstr: "household not found",
		},
		{
			name: "internal error", method: http.MethodPatch, path: path, body: `{"name":"New"}`,
			svc: &mockService{renameHouseholdFn: func(ctx context.Context, requesterID, householdID string, req RenameHouseholdRequest) (*HouseholdResponse, error) {
				return nil, errors.New("db down")
			}},
			wantStatus: http.StatusInternalServerError, wantSubstr: "failed to rename household",
		},
		{
			name: "success", method: http.MethodPatch, path: path, body: `{"name":"New"}`,
			svc: &mockService{renameHouseholdFn: func(ctx context.Context, requesterID, householdID string, req RenameHouseholdRequest) (*HouseholdResponse, error) {
				if requesterID != "user-1" || householdID != "hh-1" || req.Name != "New" {
					t.Errorf("unexpected args %s %s %+v", requesterID, householdID, req)
				}
				return &HouseholdResponse{ID: "hh-1", Name: "New"}, nil
			}},
			wantStatus: http.StatusOK, wantSubstr: `"name":"New"`,
		},
	})
}

func TestHouseholdHandler_DeleteHousehold(t *testing.T) {
	const path = "/api/v1/households/hh-1"
	runRouteCases(t, []routeCase{
		{name: "unauthorized", method: http.MethodDelete, path: path, noAuth: true, wantStatus: http.StatusUnauthorized, wantSubstr: "unauthorized"},
		{
			name: "forbidden for non-owner", method: http.MethodDelete, path: path,
			svc: &mockService{deleteHouseholdFn: func(ctx context.Context, requesterID, householdID string) error {
				return ErrUnauthorizedHouseholdAccess
			}},
			wantStatus: http.StatusForbidden, wantSubstr: "forbidden",
		},
		{
			name: "internal error", method: http.MethodDelete, path: path,
			svc:        &mockService{deleteHouseholdFn: func(ctx context.Context, requesterID, householdID string) error { return errors.New("db") }},
			wantStatus: http.StatusInternalServerError, wantSubstr: "failed to delete household",
		},
		{name: "success", method: http.MethodDelete, path: path, wantStatus: http.StatusOK, wantSubstr: "household deleted successfully"},
	})
}

func TestHouseholdHandler_TransferOwnership(t *testing.T) {
	const path = "/api/v1/households/hh-1/transfer-ownership"
	runRouteCases(t, []routeCase{
		{name: "unauthorized", method: http.MethodPost, path: path, body: `{"user_id":"u2"}`, noAuth: true, wantStatus: http.StatusUnauthorized, wantSubstr: "unauthorized"},
		{name: "invalid json", method: http.MethodPost, path: path, body: `nope`, wantStatus: http.StatusBadRequest, wantSubstr: "invalid json payload"},
		{
			name: "invalid target", method: http.MethodPost, path: path, body: `{"user_id":""}`,
			svc: &mockService{transferOwnershipFn: func(ctx context.Context, requesterID, householdID, targetUserID string) (*HouseholdResponse, error) {
				return nil, ErrInvalidTransferTarget
			}},
			wantStatus: http.StatusBadRequest, wantSubstr: "user_id must be another member",
		},
		{
			name: "target not a member", method: http.MethodPost, path: path, body: `{"user_id":"stranger"}`,
			svc: &mockService{transferOwnershipFn: func(ctx context.Context, requesterID, householdID, targetUserID string) (*HouseholdResponse, error) {
				return nil, ErrMemberNotFound
			}},
			wantStatus: http.StatusNotFound, wantSubstr: "member not found",
		},
		{
			name: "forbidden for admin", method: http.MethodPost, path: path, body: `{"user_id":"u2"}`,
			svc: &mockService{transferOwnershipFn: func(ctx context.Context, requesterID, householdID, targetUserID string) (*HouseholdResponse, error) {
				return nil, ErrUnauthorizedHouseholdAccess
			}},
			wantStatus: http.StatusForbidden, wantSubstr: "forbidden",
		},
		{
			name: "success", method: http.MethodPost, path: path, body: `{"user_id":"u2"}`,
			svc: &mockService{transferOwnershipFn: func(ctx context.Context, requesterID, householdID, targetUserID string) (*HouseholdResponse, error) {
				if targetUserID != "u2" {
					t.Errorf("expected target u2, got %s", targetUserID)
				}
				return &HouseholdResponse{ID: "hh-1", OwnerID: "u2", Role: "ADMIN"}, nil
			}},
			wantStatus: http.StatusOK, wantSubstr: `"owner_id":"u2"`,
		},
	})
}

func TestHouseholdHandler_LeaveHousehold(t *testing.T) {
	const path = "/api/v1/households/hh-1/leave"
	runRouteCases(t, []routeCase{
		{name: "unauthorized", method: http.MethodPost, path: path, noAuth: true, wantStatus: http.StatusUnauthorized, wantSubstr: "unauthorized"},
		{
			name: "owner cannot leave", method: http.MethodPost, path: path,
			svc:        &mockService{leaveHouseholdFn: func(ctx context.Context, requesterID, householdID string) error { return ErrOwnerCannotLeave }},
			wantStatus: http.StatusBadRequest, wantSubstr: "transfer ownership",
		},
		{
			name: "non member", method: http.MethodPost, path: path,
			svc: &mockService{leaveHouseholdFn: func(ctx context.Context, requesterID, householdID string) error {
				return ErrUnauthorizedHouseholdAccess
			}},
			wantStatus: http.StatusForbidden, wantSubstr: "forbidden",
		},
		{
			name: "internal error", method: http.MethodPost, path: path,
			svc:        &mockService{leaveHouseholdFn: func(ctx context.Context, requesterID, householdID string) error { return errors.New("db") }},
			wantStatus: http.StatusInternalServerError, wantSubstr: "failed to leave household",
		},
		{name: "success", method: http.MethodPost, path: path, wantStatus: http.StatusOK, wantSubstr: "left household successfully"},
	})
}

func TestHouseholdHandler_SetDefaultHousehold(t *testing.T) {
	const path = "/api/v1/households/hh-1/default"
	runRouteCases(t, []routeCase{
		{name: "unauthorized", method: http.MethodPut, path: path, noAuth: true, wantStatus: http.StatusUnauthorized, wantSubstr: "unauthorized"},
		{
			name: "non member", method: http.MethodPut, path: path,
			svc: &mockService{setDefaultHouseholdFn: func(ctx context.Context, requesterID, householdID string) error {
				return ErrUnauthorizedHouseholdAccess
			}},
			wantStatus: http.StatusForbidden, wantSubstr: "forbidden",
		},
		{
			name: "internal error", method: http.MethodPut, path: path,
			svc:        &mockService{setDefaultHouseholdFn: func(ctx context.Context, requesterID, householdID string) error { return errors.New("db") }},
			wantStatus: http.StatusInternalServerError, wantSubstr: "failed to set default household",
		},
		{name: "success", method: http.MethodPut, path: path, wantStatus: http.StatusOK, wantSubstr: "default household updated successfully"},
	})
}

func TestHouseholdHandler_ListInvites(t *testing.T) {
	const path = "/api/v1/households/hh-1/invites"
	runRouteCases(t, []routeCase{
		{name: "unauthorized", method: http.MethodGet, path: path, noAuth: true, wantStatus: http.StatusUnauthorized, wantSubstr: "unauthorized"},
		{
			name: "forbidden for member", method: http.MethodGet, path: path,
			svc: &mockService{listInvitesFn: func(ctx context.Context, requesterID, householdID string) ([]InviteResponse, error) {
				return nil, ErrUnauthorizedHouseholdAccess
			}},
			wantStatus: http.StatusForbidden, wantSubstr: "forbidden",
		},
		{
			name: "internal error", method: http.MethodGet, path: path,
			svc: &mockService{listInvitesFn: func(ctx context.Context, requesterID, householdID string) ([]InviteResponse, error) {
				return nil, errors.New("db")
			}},
			wantStatus: http.StatusInternalServerError, wantSubstr: "failed to list invites",
		},
		{name: "empty list", method: http.MethodGet, path: path, wantStatus: http.StatusOK, wantSubstr: "[]"},
		{
			name: "success", method: http.MethodGet, path: path,
			svc: &mockService{listInvitesFn: func(ctx context.Context, requesterID, householdID string) ([]InviteResponse, error) {
				return []InviteResponse{{Token: "tok-1", HouseholdID: "hh-1", Role: "MEMBER"}}, nil
			}},
			wantStatus: http.StatusOK, wantSubstr: `"token":"tok-1"`,
		},
	})
}

func TestHouseholdHandler_RevokeInvite(t *testing.T) {
	const path = "/api/v1/households/hh-1/invites/tok-1"
	runRouteCases(t, []routeCase{
		{name: "unauthorized", method: http.MethodDelete, path: path, noAuth: true, wantStatus: http.StatusUnauthorized, wantSubstr: "unauthorized"},
		{
			name: "not found", method: http.MethodDelete, path: path,
			svc:        &mockService{revokeInviteFn: func(ctx context.Context, requesterID, householdID, token string) error { return ErrInviteNotFound }},
			wantStatus: http.StatusNotFound, wantSubstr: "invite not found",
		},
		{
			name: "forbidden", method: http.MethodDelete, path: path,
			svc: &mockService{revokeInviteFn: func(ctx context.Context, requesterID, householdID, token string) error {
				return ErrUnauthorizedHouseholdAccess
			}},
			wantStatus: http.StatusForbidden, wantSubstr: "forbidden",
		},
		{
			name: "success", method: http.MethodDelete, path: path,
			svc: &mockService{revokeInviteFn: func(ctx context.Context, requesterID, householdID, token string) error {
				if householdID != "hh-1" || token != "tok-1" {
					t.Errorf("unexpected args %s %s", householdID, token)
				}
				return nil
			}},
			wantStatus: http.StatusOK, wantSubstr: "invite revoked successfully",
		},
	})
}

func TestHouseholdHandler_CreateInviteRoleErrors(t *testing.T) {
	const path = "/api/v1/households/invite"
	runRouteCases(t, []routeCase{
		{
			name: "invalid role", method: http.MethodPost, path: path, body: `{"household_id":"hh-1","role":"root"}`,
			svc: &mockService{createInviteFn: func(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error) {
				return nil, ErrInvalidRole
			}},
			wantStatus: http.StatusBadRequest, wantSubstr: "role must be one of",
		},
		{
			name: "owner invite blocked", method: http.MethodPost, path: path, body: `{"household_id":"hh-1","role":"OWNER"}`,
			svc: &mockService{createInviteFn: func(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error) {
				return nil, ErrOwnerRoleNotAssignable
			}},
			wantStatus: http.StatusForbidden, wantSubstr: "transfer-ownership",
		},
	})
}

func TestHouseholdHandler_CreateHouseholdInvalidName(t *testing.T) {
	runRouteCases(t, []routeCase{{
		name: "invalid name", method: http.MethodPost, path: "/api/v1/households", body: `{"name":"   "}`,
		svc: &mockService{createHouseholdFn: func(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error) {
			return nil, ErrInvalidHouseholdName
		}},
		wantStatus: http.StatusBadRequest, wantSubstr: "household name",
	}})
}

func TestWriteServiceError_Mapping(t *testing.T) {
	cases := []struct {
		err    error
		status int
	}{
		{ErrInvalidRole, http.StatusBadRequest},
		{ErrInvalidHouseholdName, http.StatusBadRequest},
		{ErrInvalidTransferTarget, http.StatusBadRequest},
		{ErrOwnerCannotLeave, http.StatusBadRequest},
		{ErrCannotChangeOwnerRole, http.StatusBadRequest},
		{ErrCannotRemoveOwner, http.StatusBadRequest},
		{ErrOwnerRoleNotAssignable, http.StatusForbidden},
		{ErrUnauthorizedHouseholdAccess, http.StatusForbidden},
		{ErrHouseholdNotFound, http.StatusNotFound},
		{ErrMemberNotFound, http.StatusNotFound},
		{ErrInviteNotFound, http.StatusNotFound},
		{errors.New("boom"), http.StatusInternalServerError},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		writeServiceError(rec, c.err, "fallback")
		if rec.Code != c.status {
			t.Errorf("%v: expected %d, got %d", c.err, c.status, rec.Code)
		}
		if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
			t.Errorf("%v: expected JSON content type, got %q", c.err, ct)
		}
	}
}
