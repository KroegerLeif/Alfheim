package apps_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/dashboard/internal/features/apps"
	"alfheim/dashboard/internal/shared/middleware"
)

type mockAppService struct {
	getDashboardAppsFn      func(ctx context.Context, userID string, userRoles []string) (*apps.DashboardAppsResponse, error)
	getUserPreferencesFn    func(ctx context.Context, userID string) (*apps.UserPreferences, error)
	updateUserPreferencesFn func(ctx context.Context, userID string, hiddenAppIDs []string) (*apps.UserPreferences, error)
	createUserLinkFn        func(ctx context.Context, userID string, req apps.CreateUserLinkRequest) (*apps.AppItem, error)
	updateUserLinkFn        func(ctx context.Context, userID string, id string, req apps.UpdateUserLinkRequest) (*apps.AppItem, error)
	deleteUserLinkFn        func(ctx context.Context, userID string, id string) error
}

func (m *mockAppService) GetDashboardApps(ctx context.Context, userID string, userRoles []string) (*apps.DashboardAppsResponse, error) {
	if m.getDashboardAppsFn != nil {
		return m.getDashboardAppsFn(ctx, userID, userRoles)
	}
	return &apps.DashboardAppsResponse{}, nil
}

func (m *mockAppService) GetUserPreferences(ctx context.Context, userID string) (*apps.UserPreferences, error) {
	if m.getUserPreferencesFn != nil {
		return m.getUserPreferencesFn(ctx, userID)
	}
	return &apps.UserPreferences{}, nil
}

func (m *mockAppService) UpdateUserPreferences(ctx context.Context, userID string, hiddenAppIDs []string) (*apps.UserPreferences, error) {
	if m.updateUserPreferencesFn != nil {
		return m.updateUserPreferencesFn(ctx, userID, hiddenAppIDs)
	}
	return &apps.UserPreferences{}, nil
}

func (m *mockAppService) CreateUserLink(ctx context.Context, userID string, req apps.CreateUserLinkRequest) (*apps.AppItem, error) {
	if m.createUserLinkFn != nil {
		return m.createUserLinkFn(ctx, userID, req)
	}
	return &apps.AppItem{ID: "link-1", Title: req.Title}, nil
}

func (m *mockAppService) UpdateUserLink(ctx context.Context, userID string, id string, req apps.UpdateUserLinkRequest) (*apps.AppItem, error) {
	if m.updateUserLinkFn != nil {
		return m.updateUserLinkFn(ctx, userID, id, req)
	}
	return &apps.AppItem{ID: id, Title: req.Title}, nil
}

func (m *mockAppService) DeleteUserLink(ctx context.Context, userID string, id string) error {
	if m.deleteUserLinkFn != nil {
		return m.deleteUserLinkFn(ctx, userID, id)
	}
	return nil
}

func withAuthClaims(ctx context.Context, subject string) context.Context {
	claims := &middleware.UserClaims{
		Subject: subject,
		Roles:   []string{"user"},
	}
	return context.WithValue(ctx, middleware.UserContextKey, claims)
}

func TestAppsHandler_CreateUserLink_SanitizedErrors(t *testing.T) {
	t.Run("returns 400 bad request on ErrInvalidLinkInputs", func(t *testing.T) {
		service := &mockAppService{
			createUserLinkFn: func(ctx context.Context, userID string, req apps.CreateUserLinkRequest) (*apps.AppItem, error) {
				return nil, apps.ErrInvalidLinkInputs
			},
		}

		handler := apps.NewHandler(service)
		reqBody := `{"title":"","url":""}`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/user/links", bytes.NewBufferString(reqBody))
		req = req.WithContext(withAuthClaims(req.Context(), "user-123"))

		rec := httptest.NewRecorder()
		handler.CreateUserLink(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), `"error":"bad_request"`) {
			t.Errorf("expected response to contain bad_request, got %s", rec.Body.String())
		}
	})

	t.Run("returns sanitized 500 on database error without leaking raw error", func(t *testing.T) {
		rawDbErr := errors.New("ERROR: relation \"user_links\" does not exist (SQLSTATE 42P01)")
		service := &mockAppService{
			createUserLinkFn: func(ctx context.Context, userID string, req apps.CreateUserLinkRequest) (*apps.AppItem, error) {
				return nil, rawDbErr
			},
		}

		handler := apps.NewHandler(service)
		reqBody := `{"title":"Test Link","url":"https://example.com"}`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/user/links", bytes.NewBufferString(reqBody))
		req = req.WithContext(withAuthClaims(req.Context(), "user-123"))

		rec := httptest.NewRecorder()
		handler.CreateUserLink(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
		}
		if strings.Contains(rec.Body.String(), "SQLSTATE") || strings.Contains(rec.Body.String(), "user_links") {
			t.Errorf("leaked internal database error details: %s", rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), `"error":"internal_server_error"`) {
			t.Errorf("expected response to contain internal_server_error, got %s", rec.Body.String())
		}
	})
}

func TestAppsHandler_UpdateUserLink_SanitizedErrors(t *testing.T) {
	t.Run("returns 404 on ErrLinkNotFound", func(t *testing.T) {
		service := &mockAppService{
			updateUserLinkFn: func(ctx context.Context, userID string, id string, req apps.UpdateUserLinkRequest) (*apps.AppItem, error) {
				return nil, apps.ErrLinkNotFound
			},
		}

		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		r.Put("/api/v1/user/links/{id}", handler.UpdateUserLink)

		reqBody := `{"title":"Updated"}`
		req := httptest.NewRequest(http.MethodPut, "/api/v1/user/links/link-999", bytes.NewBufferString(reqBody))
		req = req.WithContext(withAuthClaims(req.Context(), "user-123"))

		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected status %d, got %d", http.StatusNotFound, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), `"error":"not_found"`) {
			t.Errorf("expected response to contain not_found, got %s", rec.Body.String())
		}
	})

	t.Run("returns sanitized 500 on database error", func(t *testing.T) {
		rawDbErr := errors.New("pgx: connection refused / query error")
		service := &mockAppService{
			updateUserLinkFn: func(ctx context.Context, userID string, id string, req apps.UpdateUserLinkRequest) (*apps.AppItem, error) {
				return nil, rawDbErr
			},
		}

		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		r.Put("/api/v1/user/links/{id}", handler.UpdateUserLink)

		reqBody := `{"title":"Updated"}`
		req := httptest.NewRequest(http.MethodPut, "/api/v1/user/links/link-1", bytes.NewBufferString(reqBody))
		req = req.WithContext(withAuthClaims(req.Context(), "user-123"))

		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
		}
		if strings.Contains(rec.Body.String(), "pgx") || strings.Contains(rec.Body.String(), "connection refused") {
			t.Errorf("leaked internal database error details: %s", rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), `"error":"internal_server_error"`) {
			t.Errorf("expected response to contain internal_server_error, got %s", rec.Body.String())
		}
	})
}

func TestAppsHandler_DeleteUserLink_SanitizedErrors(t *testing.T) {
	t.Run("returns 404 on ErrLinkNotFound", func(t *testing.T) {
		service := &mockAppService{
			deleteUserLinkFn: func(ctx context.Context, userID string, id string) error {
				return apps.ErrLinkNotFound
			},
		}

		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		r.Delete("/api/v1/user/links/{id}", handler.DeleteUserLink)

		req := httptest.NewRequest(http.MethodDelete, "/api/v1/user/links/link-999", nil)
		req = req.WithContext(withAuthClaims(req.Context(), "user-123"))

		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected status %d, got %d", http.StatusNotFound, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), `"error":"not_found"`) {
			t.Errorf("expected response to contain not_found, got %s", rec.Body.String())
		}
	})

	t.Run("returns sanitized 500 on database error", func(t *testing.T) {
		rawDbErr := errors.New("fatal postgresql connection error")
		service := &mockAppService{
			deleteUserLinkFn: func(ctx context.Context, userID string, id string) error {
				return rawDbErr
			},
		}

		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		r.Delete("/api/v1/user/links/{id}", handler.DeleteUserLink)

		req := httptest.NewRequest(http.MethodDelete, "/api/v1/user/links/link-1", nil)
		req = req.WithContext(withAuthClaims(req.Context(), "user-123"))

		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
		}
		if strings.Contains(rec.Body.String(), "postgresql") {
			t.Errorf("leaked internal error details: %s", rec.Body.String())
		}
		var errResp map[string]string
		if err := json.Unmarshal(rec.Body.Bytes(), &errResp); err != nil {
			t.Fatalf("failed to parse json error response: %v", err)
		}
		if errResp["error"] != "internal_server_error" || errResp["message"] != "failed to delete user link" {
			t.Errorf("unexpected error payload: %v", errResp)
		}
	})
}
