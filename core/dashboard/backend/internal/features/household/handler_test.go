package household

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"alfheim/dashboard/internal/shared/middleware"
	"github.com/go-chi/chi/v5"
)

type mockService struct {
	createHouseholdFn        func(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error)
	getUserHouseholdsFn      func(ctx context.Context, userID string) ([]HouseholdResponse, error)
	getHouseholdDetailsFn    func(ctx context.Context, requesterID string, householdID string) (*HouseholdResponse, error)
	createInviteFn           func(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error)
	joinHouseholdFn          func(ctx context.Context, userID string, token string) (*HouseholdResponse, error)
	removeMemberFn           func(ctx context.Context, requesterID string, householdID string, targetUserID string) error
	updateMemberRoleFn       func(ctx context.Context, requesterID string, householdID string, targetUserID string, newRole HouseholdRole) error
	updateHouseholdAddressFn func(ctx context.Context, requesterID string, householdID string, req UpdateHouseholdAddressRequest) error
}

func (m *mockService) CreateHousehold(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error) {
	if m.createHouseholdFn != nil {
		return m.createHouseholdFn(ctx, claims, req)
	}
	return nil, nil
}

func (m *mockService) GetUserHouseholds(ctx context.Context, userID string) ([]HouseholdResponse, error) {
	if m.getUserHouseholdsFn != nil {
		return m.getUserHouseholdsFn(ctx, userID)
	}
	return nil, nil
}

func (m *mockService) GetHouseholdDetails(ctx context.Context, requesterID string, householdID string) (*HouseholdResponse, error) {
	if m.getHouseholdDetailsFn != nil {
		return m.getHouseholdDetailsFn(ctx, requesterID, householdID)
	}
	return nil, nil
}

func (m *mockService) CreateInvite(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error) {
	if m.createInviteFn != nil {
		return m.createInviteFn(ctx, requesterID, req)
	}
	return nil, nil
}

func (m *mockService) JoinHousehold(ctx context.Context, userID string, token string) (*HouseholdResponse, error) {
	if m.joinHouseholdFn != nil {
		return m.joinHouseholdFn(ctx, userID, token)
	}
	return nil, nil
}

func (m *mockService) RemoveMember(ctx context.Context, requesterID string, householdID string, targetUserID string) error {
	if m.removeMemberFn != nil {
		return m.removeMemberFn(ctx, requesterID, householdID, targetUserID)
	}
	return nil
}

func (m *mockService) UpdateMemberRole(ctx context.Context, requesterID string, householdID string, targetUserID string, newRole HouseholdRole) error {
	if m.updateMemberRoleFn != nil {
		return m.updateMemberRoleFn(ctx, requesterID, householdID, targetUserID, newRole)
	}
	return nil
}

func (m *mockService) UpdateHouseholdAddress(ctx context.Context, requesterID string, householdID string, req UpdateHouseholdAddressRequest) error {
	if m.updateHouseholdAddressFn != nil {
		return m.updateHouseholdAddressFn(ctx, requesterID, householdID, req)
	}
	return nil
}

func withUserClaims(req *http.Request, claims *middleware.UserClaims) *http.Request {
	ctx := context.WithValue(req.Context(), middleware.UserContextKey, claims)
	return req.WithContext(ctx)
}

func TestHouseholdHandler_CreateHousehold(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		body           string
		mockFn         func(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			body:           `{"name":"Test"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:           "bad request on invalid json",
			claims:         &middleware.UserClaims{Subject: "user-1"},
			body:           `{invalid}`,
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "invalid json payload",
		},
		{
			name:   "conflict when slug exists",
			claims: &middleware.UserClaims{Subject: "user-1"},
			body:   `{"name":"Test","slug":"exists"}`,
			mockFn: func(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error) {
				return nil, ErrHouseholdSlugExists
			},
			expectedStatus: http.StatusConflict,
			expectedSubstr: "household slug already in use",
		},
		{
			name:   "internal server error on service failure",
			claims: &middleware.UserClaims{Subject: "user-1"},
			body:   `{"name":"Test"}`,
			mockFn: func(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error) {
				return nil, errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to create household",
		},
		{
			name:   "success creating household",
			claims: &middleware.UserClaims{Subject: "user-1"},
			body:   `{"name":"Test Household"}`,
			mockFn: func(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error) {
				return &HouseholdResponse{ID: "hh-123", Name: req.Name}, nil
			},
			expectedStatus: http.StatusCreated,
			expectedSubstr: "hh-123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{createHouseholdFn: tt.mockFn}
			handler := NewHandler(svc)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/households", bytes.NewBufferString(tt.body))
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			handler.CreateHousehold(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestHouseholdHandler_GetMyHouseholds(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		mockFn         func(ctx context.Context, userID string) ([]HouseholdResponse, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:   "internal error on service error",
			claims: &middleware.UserClaims{Subject: "user-1"},
			mockFn: func(ctx context.Context, userID string) ([]HouseholdResponse, error) {
				return nil, errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to fetch user households",
		},
		{
			name:   "success returning households",
			claims: &middleware.UserClaims{Subject: "user-1"},
			mockFn: func(ctx context.Context, userID string) ([]HouseholdResponse, error) {
				return []HouseholdResponse{{ID: "hh-1", Name: "My House"}}, nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "My House",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{getUserHouseholdsFn: tt.mockFn}
			handler := NewHandler(svc)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/households/me", nil)
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			handler.GetMyHouseholds(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestHouseholdHandler_GetHouseholdDetails(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		urlParamID     string
		mockFn         func(ctx context.Context, requesterID string, householdID string) (*HouseholdResponse, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			urlParamID:     "hh-1",
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:       "not found when household missing",
			claims:     &middleware.UserClaims{Subject: "user-1"},
			urlParamID: "hh-missing",
			mockFn: func(ctx context.Context, requesterID, householdID string) (*HouseholdResponse, error) {
				return nil, ErrHouseholdNotFound
			},
			expectedStatus: http.StatusNotFound,
			expectedSubstr: "household not found",
		},
		{
			name:       "forbidden when user not member",
			claims:     &middleware.UserClaims{Subject: "user-1"},
			urlParamID: "hh-1",
			mockFn: func(ctx context.Context, requesterID, householdID string) (*HouseholdResponse, error) {
				return nil, ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "unauthorized access to household",
		},
		{
			name:       "internal error on generic service error",
			claims:     &middleware.UserClaims{Subject: "user-1"},
			urlParamID: "hh-1",
			mockFn: func(ctx context.Context, requesterID, householdID string) (*HouseholdResponse, error) {
				return nil, errors.New("db failure")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to fetch household details",
		},
		{
			name:       "success getting details",
			claims:     &middleware.UserClaims{Subject: "user-1"},
			urlParamID: "hh-1",
			mockFn: func(ctx context.Context, requesterID, householdID string) (*HouseholdResponse, error) {
				return &HouseholdResponse{ID: "hh-1", Name: "Detail House"}, nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "Detail House",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{getHouseholdDetailsFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Get("/api/v1/households/{id}", handler.GetHouseholdDetails)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/households/"+tt.urlParamID, nil)
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestHouseholdHandler_CreateInvite(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		body           string
		mockFn         func(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			body:           `{"household_id":"hh-1"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:           "bad request on invalid json",
			claims:         &middleware.UserClaims{Subject: "user-1"},
			body:           `{bad json}`,
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "invalid json payload",
		},
		{
			name:   "forbidden when unauthorized",
			claims: &middleware.UserClaims{Subject: "user-1"},
			body:   `{"household_id":"hh-1"}`,
			mockFn: func(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error) {
				return nil, ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "only owners and admins can create invite tokens",
		},
		{
			name:   "internal error on generic failure",
			claims: &middleware.UserClaims{Subject: "user-1"},
			body:   `{"household_id":"hh-1"}`,
			mockFn: func(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error) {
				return nil, errors.New("error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to create invite token",
		},
		{
			name:   "success creating invite",
			claims: &middleware.UserClaims{Subject: "user-1"},
			body:   `{"household_id":"hh-1","role":"MEMBER"}`,
			mockFn: func(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error) {
				return &InviteResponse{Token: "token-123", HouseholdID: req.HouseholdID}, nil
			},
			expectedStatus: http.StatusCreated,
			expectedSubstr: "token-123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{createInviteFn: tt.mockFn}
			handler := NewHandler(svc)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/households/invite", bytes.NewBufferString(tt.body))
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			handler.CreateInvite(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestHouseholdHandler_JoinHousehold(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		body           string
		mockFn         func(ctx context.Context, userID string, token string) (*HouseholdResponse, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			body:           `{"token":"token-123"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:           "bad request on empty token",
			claims:         &middleware.UserClaims{Subject: "user-1"},
			body:           `{"token":""}`,
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "invite token is required",
		},
		{
			name:   "bad request on invalid or expired invite token",
			claims: &middleware.UserClaims{Subject: "user-1"},
			body:   `{"token":"expired-token"}`,
			mockFn: func(ctx context.Context, userID, token string) (*HouseholdResponse, error) {
				return nil, ErrInviteExpiredOrInvalid
			},
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "invite token is invalid or expired",
		},
		{
			name:   "conflict when user already member",
			claims: &middleware.UserClaims{Subject: "user-1"},
			body:   `{"token":"valid-token"}`,
			mockFn: func(ctx context.Context, userID, token string) (*HouseholdResponse, error) {
				return nil, ErrMemberAlreadyExists
			},
			expectedStatus: http.StatusConflict,
			expectedSubstr: "you are already a member of this household",
		},
		{
			name:   "internal error on generic service error",
			claims: &middleware.UserClaims{Subject: "user-1"},
			body:   `{"token":"valid-token"}`,
			mockFn: func(ctx context.Context, userID, token string) (*HouseholdResponse, error) {
				return nil, errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to join household",
		},
		{
			name:   "success joining household",
			claims: &middleware.UserClaims{Subject: "user-1"},
			body:   `{"token":"valid-token"}`,
			mockFn: func(ctx context.Context, userID, token string) (*HouseholdResponse, error) {
				return &HouseholdResponse{ID: "hh-joined", Name: "Joined House"}, nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "Joined House",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{joinHouseholdFn: tt.mockFn}
			handler := NewHandler(svc)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/households/join", bytes.NewBufferString(tt.body))
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			handler.JoinHousehold(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestHouseholdHandler_UpdateMemberRole(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		targetUserID   string
		body           string
		mockFn         func(ctx context.Context, requesterID, householdID, targetUserID string, newRole HouseholdRole) error
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			targetUserID:   "user-2",
			body:           `{"role":"ADMIN"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:           "bad request on invalid json",
			claims:         &middleware.UserClaims{Subject: "user-1"},
			hhID:           "hh-1",
			targetUserID:   "user-2",
			body:           `{invalid}`,
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "invalid json body",
		},
		{
			name:         "forbidden on unauthorized access",
			claims:       &middleware.UserClaims{Subject: "user-1"},
			hhID:         "hh-1",
			targetUserID: "user-2",
			body:         `{"role":"ADMIN"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, targetUserID string, newRole HouseholdRole) error {
				return ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "unauthorized to update member role",
		},
		{
			name:         "not found when member missing",
			claims:       &middleware.UserClaims{Subject: "user-1"},
			hhID:         "hh-1",
			targetUserID: "user-2",
			body:         `{"role":"ADMIN"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, targetUserID string, newRole HouseholdRole) error {
				return ErrMemberNotFound
			},
			expectedStatus: http.StatusNotFound,
			expectedSubstr: "member not found",
		},
		{
			name:         "internal error on generic error",
			claims:       &middleware.UserClaims{Subject: "user-1"},
			hhID:         "hh-1",
			targetUserID: "user-2",
			body:         `{"role":"ADMIN"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, targetUserID string, newRole HouseholdRole) error {
				return errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to update member role",
		},
		{
			name:         "success updating member role",
			claims:       &middleware.UserClaims{Subject: "user-1"},
			hhID:         "hh-1",
			targetUserID: "user-2",
			body:         `{"role":"ADMIN"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, targetUserID string, newRole HouseholdRole) error {
				return nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "member role updated successfully",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{updateMemberRoleFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Put("/api/v1/households/{id}/members/{userID}/role", handler.UpdateMemberRole)

			url := "/api/v1/households/" + tt.hhID + "/members/" + tt.targetUserID + "/role"
			req := httptest.NewRequest(http.MethodPut, url, bytes.NewBufferString(tt.body))
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestHouseholdHandler_RemoveMember(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		targetUserID   string
		mockFn         func(ctx context.Context, requesterID, householdID, targetUserID string) error
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			targetUserID:   "user-2",
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:         "bad request when removing owner",
			claims:       &middleware.UserClaims{Subject: "user-1"},
			hhID:         "hh-1",
			targetUserID: "owner-id",
			mockFn: func(ctx context.Context, requesterID, householdID, targetUserID string) error {
				return ErrCannotRemoveOwner
			},
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "household owner cannot be removed",
		},
		{
			name:         "forbidden when unauthorized to remove",
			claims:       &middleware.UserClaims{Subject: "user-1"},
			hhID:         "hh-1",
			targetUserID: "user-2",
			mockFn: func(ctx context.Context, requesterID, householdID, targetUserID string) error {
				return ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "unauthorized to remove member",
		},
		{
			name:         "not found when member not found",
			claims:       &middleware.UserClaims{Subject: "user-1"},
			hhID:         "hh-1",
			targetUserID: "user-2",
			mockFn: func(ctx context.Context, requesterID, householdID, targetUserID string) error {
				return ErrMemberNotFound
			},
			expectedStatus: http.StatusNotFound,
			expectedSubstr: "member not found",
		},
		{
			name:         "internal error on generic failure",
			claims:       &middleware.UserClaims{Subject: "user-1"},
			hhID:         "hh-1",
			targetUserID: "user-2",
			mockFn: func(ctx context.Context, requesterID, householdID, targetUserID string) error {
				return errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to remove member",
		},
		{
			name:         "success removing member",
			claims:       &middleware.UserClaims{Subject: "user-1"},
			hhID:         "hh-1",
			targetUserID: "user-2",
			mockFn: func(ctx context.Context, requesterID, householdID, targetUserID string) error {
				return nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "member removed successfully",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{removeMemberFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Delete("/api/v1/households/{id}/members/{userID}", handler.RemoveMember)

			url := "/api/v1/households/" + tt.hhID + "/members/" + tt.targetUserID
			req := httptest.NewRequest(http.MethodDelete, url, nil)
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestHouseholdHandler_UpdateHouseholdAddress(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		body           string
		mockFn         func(ctx context.Context, requesterID, householdID string, req UpdateHouseholdAddressRequest) error
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			body:           `{"street":"Main St"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:           "bad request on invalid json",
			claims:         &middleware.UserClaims{Subject: "user-1"},
			hhID:           "hh-1",
			body:           `{invalid}`,
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "invalid json payload",
		},
		{
			name:   "not found when household missing",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-missing",
			body:   `{"street":"Main St"}`,
			mockFn: func(ctx context.Context, requesterID, householdID string, req UpdateHouseholdAddressRequest) error {
				return ErrHouseholdNotFound
			},
			expectedStatus: http.StatusNotFound,
			expectedSubstr: "household not found",
		},
		{
			name:   "forbidden when unauthorized",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			body:   `{"street":"Main St"}`,
			mockFn: func(ctx context.Context, requesterID, householdID string, req UpdateHouseholdAddressRequest) error {
				return ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "unauthorized access to household",
		},
		{
			name:   "internal error on service failure",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			body:   `{"street":"Main St"}`,
			mockFn: func(ctx context.Context, requesterID, householdID string, req UpdateHouseholdAddressRequest) error {
				return errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to update household address",
		},
		{
			name:   "success updating address",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			body:   `{"street":"Main St","city":"Zurich"}`,
			mockFn: func(ctx context.Context, requesterID, householdID string, req UpdateHouseholdAddressRequest) error {
				return nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "household address updated successfully",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{updateHouseholdAddressFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Put("/api/v1/households/{id}/address", handler.UpdateHouseholdAddress)

			url := "/api/v1/households/" + tt.hhID + "/address"
			req := httptest.NewRequest(http.MethodPut, url, bytes.NewBufferString(tt.body))
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestHouseholdHandler_RegisterRoutes(t *testing.T) {
	svc := &mockService{
		getUserHouseholdsFn: func(ctx context.Context, userID string) ([]HouseholdResponse, error) {
			return []HouseholdResponse{}, nil
		},
	}
	handler := NewHandler(svc)

	r := chi.NewRouter()
	authMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, &middleware.UserClaims{Subject: "user-1"})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	handler.RegisterRoutes(r, authMiddleware)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/households/me", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200 from registered route, got %d", rec.Code)
	}
}

func TestHouseholdHandler_MissingHouseholdID(t *testing.T) {
	handler := NewHandler(&mockService{})
	ctx := context.WithValue(context.Background(), middleware.UserContextKey, &middleware.UserClaims{Subject: "user-1"})

	t.Run("GetHouseholdDetails missing id", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/details", nil).WithContext(ctx)
		rec := httptest.NewRecorder()
		handler.GetHouseholdDetails(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("UpdateHouseholdAddress missing id", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/address", strings.NewReader(`{"city":"Test"}`)).WithContext(ctx)
		rec := httptest.NewRecorder()
		handler.UpdateHouseholdAddress(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})
}
