package profile_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"alfheim/dashboard/internal/features/profile"
	"alfheim/dashboard/internal/shared/middleware"
)

type mockService struct {
	syncProfileFunc   func(ctx context.Context, claims *middleware.UserClaims) (*profile.Profile, error)
	getProfileFunc    func(ctx context.Context, id string) (*profile.Profile, error)
	updateProfileFunc func(ctx context.Context, id string, dto profile.UpdateDTO) (*profile.Profile, error)
}

func (m *mockService) SyncProfileFromClaims(ctx context.Context, claims *middleware.UserClaims) (*profile.Profile, error) {
	if m.syncProfileFunc != nil {
		return m.syncProfileFunc(ctx, claims)
	}
	return nil, nil
}

func (m *mockService) GetProfileByID(ctx context.Context, id string) (*profile.Profile, error) {
	if m.getProfileFunc != nil {
		return m.getProfileFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockService) UpdateProfile(ctx context.Context, id string, dto profile.UpdateDTO) (*profile.Profile, error) {
	if m.updateProfileFunc != nil {
		return m.updateProfileFunc(ctx, id, dto)
	}
	return nil, nil
}

func mockAuthMiddleware(claims *middleware.UserClaims, shouldAuth bool) func(http.Handler) http.Handler {
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

func TestHandler_GetMyProfile(t *testing.T) {
	t.Run("unauthorized when no user claims", func(t *testing.T) {
		svc := &mockService{}
		h := profile.NewHandler(svc)
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMiddleware(nil, false))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/profile/me", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("internal server error when sync fails", func(t *testing.T) {
		svc := &mockService{
			syncProfileFunc: func(ctx context.Context, claims *middleware.UserClaims) (*profile.Profile, error) {
				return nil, errors.New("db failed")
			},
		}
		h := profile.NewHandler(svc)
		claims := &middleware.UserClaims{Subject: "user-1"}
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMiddleware(claims, true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/profile/me", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
		}
	})

	t.Run("success returns profile dto", func(t *testing.T) {
		now := time.Now().Truncate(time.Second)
		p := &profile.Profile{
			ID:        "user-1",
			Email:     "user1@example.com",
			Username:  "user1",
			FirstName: "Alice",
			LastName:  "Smith",
			AvatarURL: "https://avatar.test/1.png",
			CreatedAt: now,
			UpdatedAt: now,
		}
		svc := &mockService{
			syncProfileFunc: func(ctx context.Context, claims *middleware.UserClaims) (*profile.Profile, error) {
				return p, nil
			},
		}
		h := profile.NewHandler(svc)
		claims := &middleware.UserClaims{Subject: "user-1"}
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMiddleware(claims, true))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/profile/me", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
		}

		var resp profile.ResponseDTO
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if resp.ID != p.ID || resp.Email != p.Email || resp.FirstName != p.FirstName {
			t.Errorf("unexpected profile response DTO: %+v", resp)
		}
	})
}

func TestHandler_UpdateMyProfile(t *testing.T) {
	t.Run("unauthorized when no claims", func(t *testing.T) {
		svc := &mockService{}
		h := profile.NewHandler(svc)
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMiddleware(nil, false))

		req := httptest.NewRequest(http.MethodPut, "/api/v1/profile/me", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("bad request on invalid json body", func(t *testing.T) {
		svc := &mockService{}
		h := profile.NewHandler(svc)
		claims := &middleware.UserClaims{Subject: "user-1"}
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMiddleware(claims, true))

		req := httptest.NewRequest(http.MethodPut, "/api/v1/profile/me", bytes.NewBufferString("invalid json"))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
		}
	})

	t.Run("not found when service returns ErrProfileNotFound", func(t *testing.T) {
		svc := &mockService{
			updateProfileFunc: func(ctx context.Context, id string, dto profile.UpdateDTO) (*profile.Profile, error) {
				return nil, profile.ErrProfileNotFound
			},
		}
		h := profile.NewHandler(svc)
		claims := &middleware.UserClaims{Subject: "user-1"}
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMiddleware(claims, true))

		body, _ := json.Marshal(profile.UpdateDTO{FirstName: "NewName"})
		req := httptest.NewRequest(http.MethodPut, "/api/v1/profile/me", bytes.NewBuffer(body))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected status %d, got %d", http.StatusNotFound, rec.Code)
		}
	})

	t.Run("internal server error on update error", func(t *testing.T) {
		svc := &mockService{
			updateProfileFunc: func(ctx context.Context, id string, dto profile.UpdateDTO) (*profile.Profile, error) {
				return nil, errors.New("update error")
			},
		}
		h := profile.NewHandler(svc)
		claims := &middleware.UserClaims{Subject: "user-1"}
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMiddleware(claims, true))

		body, _ := json.Marshal(profile.UpdateDTO{FirstName: "NewName"})
		req := httptest.NewRequest(http.MethodPut, "/api/v1/profile/me", bytes.NewBuffer(body))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
		}
	})

	t.Run("success updates profile", func(t *testing.T) {
		updatedProfile := &profile.Profile{
			ID:        "user-1",
			FirstName: "Bob",
			LastName:  "Marley",
		}
		svc := &mockService{
			updateProfileFunc: func(ctx context.Context, id string, dto profile.UpdateDTO) (*profile.Profile, error) {
				return updatedProfile, nil
			},
		}
		h := profile.NewHandler(svc)
		claims := &middleware.UserClaims{Subject: "user-1"}
		r := chi.NewRouter()
		h.RegisterRoutes(r, mockAuthMiddleware(claims, true))

		body, _ := json.Marshal(profile.UpdateDTO{FirstName: "Bob", LastName: "Marley"})
		req := httptest.NewRequest(http.MethodPut, "/api/v1/profile/me", bytes.NewBuffer(body))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
		}

		var resp profile.ResponseDTO
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if resp.FirstName != "Bob" {
			t.Errorf("expected first name Bob, got %s", resp.FirstName)
		}
	})
}
