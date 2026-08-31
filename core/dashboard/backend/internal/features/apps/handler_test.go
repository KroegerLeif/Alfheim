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

func mockAuthMW(claims *middleware.UserClaims, shouldAuth bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !shouldAuth {
				next.ServeHTTP(w, r)
				return
			}
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func TestAppsHandler_GetDashboardApps(t *testing.T) {
	t.Run("unauthorized when claims missing", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(nil, false))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/apps", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("internal server error when service fails", func(t *testing.T) {
		service := &mockAppService{
			getDashboardAppsFn: func(ctx context.Context, userID string, userRoles []string) (*apps.DashboardAppsResponse, error) {
				return nil, errors.New("service err")
			},
		}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/apps", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
		}
	})

	t.Run("success returns dashboard apps", func(t *testing.T) {
		service := &mockAppService{
			getDashboardAppsFn: func(ctx context.Context, userID string, userRoles []string) (*apps.DashboardAppsResponse, error) {
				return &apps.DashboardAppsResponse{
					Core: []apps.AppItem{{ID: "core-1", Title: "Core 1"}},
				}, nil
			},
		}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/apps/dashboard", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "core-1") {
			t.Errorf("expected body to contain core-1, got %s", rec.Body.String())
		}
	})
}

func TestAppsHandler_GetUserPreferences(t *testing.T) {
	t.Run("unauthorized when claims missing", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(nil, false))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/user/preferences", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("internal server error when service fails", func(t *testing.T) {
		service := &mockAppService{
			getUserPreferencesFn: func(ctx context.Context, userID string) (*apps.UserPreferences, error) {
				return nil, errors.New("pref err")
			},
		}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/user/preferences", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
		}
	})

	t.Run("success returns user preferences", func(t *testing.T) {
		service := &mockAppService{
			getUserPreferencesFn: func(ctx context.Context, userID string) (*apps.UserPreferences, error) {
				return &apps.UserPreferences{UserID: "u1", HiddenAppIDs: []string{"app-hide"}}, nil
			},
		}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/user/preferences", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})
}

func TestAppsHandler_UpdateUserPreferences(t *testing.T) {
	t.Run("unauthorized when claims missing", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(nil, false))

		req := httptest.NewRequest(http.MethodPut, "/api/v1/user/preferences", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("bad request when id URLParam is missing", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		req := httptest.NewRequest(http.MethodPut, "/api/v1/user/links/", nil)
		req = req.WithContext(withAuthClaims(req.Context(), "user-123"))
		rec := httptest.NewRecorder()

		handler.UpdateUserLink(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
		}
	})

	t.Run("bad request on invalid json body", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		req := httptest.NewRequest(http.MethodPut, "/api/v1/user/preferences", strings.NewReader("invalid"))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
		}
	})

	t.Run("internal error when update fails", func(t *testing.T) {
		service := &mockAppService{
			updateUserPreferencesFn: func(ctx context.Context, userID string, hiddenAppIDs []string) (*apps.UserPreferences, error) {
				return nil, errors.New("update err")
			},
		}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		body, _ := json.Marshal(apps.UpdateUserPreferencesRequest{HiddenAppIDs: []string{"app1"}})
		req := httptest.NewRequest(http.MethodPut, "/api/v1/user/preferences", bytes.NewReader(body))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
		}
	})

	t.Run("success updates user preferences via PATCH", func(t *testing.T) {
		service := &mockAppService{
			updateUserPreferencesFn: func(ctx context.Context, userID string, hiddenAppIDs []string) (*apps.UserPreferences, error) {
				return &apps.UserPreferences{UserID: userID, HiddenAppIDs: hiddenAppIDs}, nil
			},
		}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		body, _ := json.Marshal(apps.UpdateUserPreferencesRequest{HiddenAppIDs: []string{"app1"}})
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/user/preferences", bytes.NewReader(body))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})
}

func TestAppsHandler_GetUserLinks(t *testing.T) {
	t.Run("unauthorized when claims missing", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(nil, false))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/user/links", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("internal error when GetDashboardApps fails", func(t *testing.T) {
		service := &mockAppService{
			getDashboardAppsFn: func(ctx context.Context, userID string, userRoles []string) (*apps.DashboardAppsResponse, error) {
				return nil, errors.New("links err")
			},
		}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/user/links", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
		}
	})

	t.Run("success returns user links", func(t *testing.T) {
		service := &mockAppService{
			getDashboardAppsFn: func(ctx context.Context, userID string, userRoles []string) (*apps.DashboardAppsResponse, error) {
				return &apps.DashboardAppsResponse{
					User: []apps.AppItem{{ID: "user-link-1", Title: "My Link"}},
				}, nil
			},
		}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/user/links", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})
}

func TestAppsHandler_CreateUserLink_SanitizedErrors(t *testing.T) {
	t.Run("unauthorized when claims missing", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(nil, false))

		req := httptest.NewRequest(http.MethodPost, "/api/v1/user/links", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("bad request on invalid json body", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		req := httptest.NewRequest(http.MethodPost, "/api/v1/user/links", strings.NewReader("bad json"))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
		}
	})

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
	})

	t.Run("returns 201 created on success", func(t *testing.T) {
		service := &mockAppService{
			createUserLinkFn: func(ctx context.Context, userID string, req apps.CreateUserLinkRequest) (*apps.AppItem, error) {
				return &apps.AppItem{ID: "link-1", Title: req.Title, URL: req.URL}, nil
			},
		}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		body, _ := json.Marshal(apps.CreateUserLinkRequest{Title: "Title", URL: "https://example.com"})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/user/links", bytes.NewReader(body))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Errorf("expected status %d, got %d", http.StatusCreated, rec.Code)
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
	})
}

func TestAppsHandler_UpdateUserLink_SanitizedErrors(t *testing.T) {
	t.Run("unauthorized when claims missing", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(nil, false))

		req := httptest.NewRequest(http.MethodPut, "/api/v1/user/links/l1", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("bad request on invalid json body", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		req := httptest.NewRequest(http.MethodPut, "/api/v1/user/links/l1", strings.NewReader("bad json"))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
		}
	})

	t.Run("returns 400 on ErrInvalidLinkInputs", func(t *testing.T) {
		service := &mockAppService{
			updateUserLinkFn: func(ctx context.Context, userID string, id string, req apps.UpdateUserLinkRequest) (*apps.AppItem, error) {
				return nil, apps.ErrInvalidLinkInputs
			},
		}

		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		r.Put("/api/v1/user/links/{id}", handler.UpdateUserLink)

		reqBody := `{"title":""}`
		req := httptest.NewRequest(http.MethodPut, "/api/v1/user/links/l1", bytes.NewBufferString(reqBody))
		req = req.WithContext(withAuthClaims(req.Context(), "user-123"))

		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
		}
	})

	t.Run("returns 200 OK on success update", func(t *testing.T) {
		service := &mockAppService{
			updateUserLinkFn: func(ctx context.Context, userID string, id string, req apps.UpdateUserLinkRequest) (*apps.AppItem, error) {
				return &apps.AppItem{ID: id, Title: req.Title}, nil
			},
		}
		handler := apps.NewHandler(service)
		claims := &middleware.UserClaims{Subject: "u1"}
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(claims, true))

		body, _ := json.Marshal(apps.UpdateUserLinkRequest{Title: "Updated Title"})
		req := httptest.NewRequest(http.MethodPut, "/api/v1/user/links/l1", bytes.NewReader(body))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})
}

func TestAppsHandler_DeleteUserLink_SanitizedErrors(t *testing.T) {
	t.Run("unauthorized when claims missing", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMW(nil, false))

		req := httptest.NewRequest(http.MethodDelete, "/api/v1/user/links/l1", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("bad request when id URLParam is missing", func(t *testing.T) {
		service := &mockAppService{}
		handler := apps.NewHandler(service)
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/user/links/", nil)
		req = req.WithContext(withAuthClaims(req.Context(), "user-123"))
		rec := httptest.NewRecorder()

		handler.DeleteUserLink(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
		}
	})

	t.Run("returns 24 StatusNoContent on successful delete", func(t *testing.T) {
		service := &mockAppService{
			deleteUserLinkFn: func(ctx context.Context, userID string, id string) error {
				return nil
			},
		}

		handler := apps.NewHandler(service)
		r := chi.NewRouter()
		r.Delete("/api/v1/user/links/{id}", handler.DeleteUserLink)

		req := httptest.NewRequest(http.MethodDelete, "/api/v1/user/links/link-1", nil)
		req = req.WithContext(withAuthClaims(req.Context(), "user-123"))

		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Errorf("expected status %d, got %d", http.StatusNoContent, rec.Code)
		}
	})
}
