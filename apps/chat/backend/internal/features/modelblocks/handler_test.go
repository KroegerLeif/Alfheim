package modelblocks_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/chat/internal/features/modelblocks"
	"alfheim/chat/internal/shared/middleware"
)

// withClaims returns a fake auth middleware that injects fixed UserClaims into the
// request context, standing in for the real Keycloak JWT authenticator in tests.
func withClaims(claims *middleware.UserClaims) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func newTestRouter(svc modelblocks.Service, claims *middleware.UserClaims) http.Handler {
	r := chi.NewRouter()
	handler := modelblocks.NewHandler(svc)
	handler.RegisterRoutes(r, withClaims(claims))
	return r
}

func TestHandler_CreateAndListModelBlocks(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	claims := &middleware.UserClaims{Subject: "user-1", HouseholdID: "hh-1"}
	router := newTestRouter(svc, claims)

	createBody, _ := json.Marshal(modelblocks.CreateRequest{
		ProviderType:    "ollama",
		DisplayName:     "Local Llama",
		ModelIdentifier: "llama3.1:8b",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/model-blocks", bytes.NewReader(createBody))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var created modelblocks.ResponseDTO
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if created.DisplayName != "Local Llama" {
		t.Errorf("expected display name Local Llama, got %s", created.DisplayName)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/chat/model-blocks", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", listRec.Code)
	}

	var listed []modelblocks.ResponseDTO
	if err := json.Unmarshal(listRec.Body.Bytes(), &listed); err != nil {
		t.Fatalf("failed to decode list response: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("expected 1 model block in list, got %d", len(listed))
	}
}

func TestHandler_UpdateForbiddenForNonOwner(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	owner := &middleware.UserClaims{Subject: "owner-1"}

	created, err := svc.Create(context.Background(), owner.Subject, "", modelblocks.CreateRequest{
		ProviderType:    "ollama",
		DisplayName:     "Mine",
		ModelIdentifier: "llama3.1:8b",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	otherUser := &middleware.UserClaims{Subject: "intruder"}
	router := newTestRouter(svc, otherUser)

	newName := "Hijacked"
	body, _ := json.Marshal(modelblocks.UpdateRequest{DisplayName: &newName})

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/chat/model-blocks/"+created.ID, bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_DeleteNotFound(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	claims := &middleware.UserClaims{Subject: "user-1"}
	router := newTestRouter(svc, claims)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/chat/model-blocks/does-not-exist", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_CreateRejectsMissingHouseholdForSharedVisibility(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	claims := &middleware.UserClaims{Subject: "user-1"} // no household id
	router := newTestRouter(svc, claims)

	body, _ := json.Marshal(modelblocks.CreateRequest{
		ProviderType:    "ollama",
		DisplayName:     "Shared",
		ModelIdentifier: "llama3.1:8b",
		Visibility:      modelblocks.VisibilityShared,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/model-blocks", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_TriggerHealthCheck(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	claims := &middleware.UserClaims{Subject: "user-1"}
	router := newTestRouter(svc, claims)

	created, err := svc.Create(context.Background(), claims.Subject, "", modelblocks.CreateRequest{
		ProviderType:    "openai_compatible", // not yet implemented -> deterministic "unknown" result
		DisplayName:     "External",
		ModelIdentifier: "gpt-4.1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/model-blocks/"+created.ID+"/health-check", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var result modelblocks.ResponseDTO
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if result.HealthStatus != modelblocks.HealthStatusUnknown {
		t.Errorf("expected unknown health status, got %s", result.HealthStatus)
	}
}
