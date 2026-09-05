package modelblocks_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/chat/internal/features/modelblocks"
	"alfheim/chat/internal/shared/llm"
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

func TestHandler_GetModelBlock(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	claims := &middleware.UserClaims{Subject: "user-1", HouseholdID: "hh-1"}
	router := newTestRouter(svc, claims)

	created, err := svc.Create(context.Background(), "user-1", "hh-1", modelblocks.CreateRequest{
		ProviderType:    "ollama",
		DisplayName:     "My Block",
		ModelIdentifier: "llama3.1:8b",
		Visibility:      modelblocks.VisibilityShared,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/model-blocks/"+created.ID, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var res modelblocks.ResponseDTO
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res.ID != created.ID {
		t.Errorf("expected ID %s, got %s", created.ID, res.ID)
	}
}

func TestHandler_DeleteForbiddenForNonOwner(t *testing.T) {
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

	intruder := &middleware.UserClaims{Subject: "intruder"}
	router := newTestRouter(svc, intruder)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/chat/model-blocks/"+created.ID, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d", rec.Code)
	}
}

func TestHandler_TriggerHealthCheck(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	claims := &middleware.UserClaims{Subject: "user-1", HouseholdID: "hh-1"}
	router := newTestRouter(svc, claims)

	created, err := svc.Create(context.Background(), claims.Subject, "hh-1", modelblocks.CreateRequest{
		ProviderType:    "anthropic", // still unimplemented as of Phase 5 -> deterministic "unknown" result
		DisplayName:     "External",
		ModelIdentifier: "claude-3",
		Visibility:      modelblocks.VisibilityShared,
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

func TestHandler_DiscoverModels(t *testing.T) {
	mockOllama := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/tags" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"models": []map[string]any{
				{"name": "gemma2:9b"},
				{"name": "qwen2.5-coder:7b"},
			},
		})
	}))
	defer mockOllama.Close()

	repo := newFakeRepository()
	svc := newTestService(repo)
	claims := &middleware.UserClaims{Subject: "user-1", HouseholdID: "hh-1"}
	router := newTestRouter(svc, claims)

	body, _ := json.Marshal(modelblocks.DiscoverRequest{
		ProviderType: "ollama",
		BaseURL:      &mockOllama.URL,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/models/discover", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp modelblocks.DiscoverResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode discover response: %v", err)
	}

	if len(resp.Models) != 2 || resp.Models[0] != "gemma2:9b" || resp.Models[1] != "qwen2.5-coder:7b" {
		t.Errorf("unexpected models returned: %+v", resp.Models)
	}
}

func TestHandler_UnauthorizedRequests(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	router := newTestRouter(svc, nil) // no claims

	endpoints := []struct {
		method string
		path   string
		body   []byte
	}{
		{http.MethodGet, "/api/v1/chat/model-blocks", nil},
		{http.MethodGet, "/api/v1/chat/model-blocks/b1", nil},
		{http.MethodPost, "/api/v1/chat/model-blocks", []byte(`{}`)},
		{http.MethodPatch, "/api/v1/chat/model-blocks/b1", []byte(`{}`)},
		{http.MethodDelete, "/api/v1/chat/model-blocks/b1", nil},
		{http.MethodPost, "/api/v1/chat/model-blocks/b1/health-check", nil},
		{http.MethodPost, "/api/v1/chat/models/discover", []byte(`{}`)},
	}

	for _, ep := range endpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			var body io.Reader
			if ep.body != nil {
				body = bytes.NewReader(ep.body)
			}
			req := httptest.NewRequest(ep.method, ep.path, body)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("expected 401 Unauthorized for %s %s, got %d", ep.method, ep.path, rec.Code)
			}
		})
	}
}

func TestHandler_BadJSONPayloads(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	claims := &middleware.UserClaims{Subject: "user-1", HouseholdID: "hh-1"}
	router := newTestRouter(svc, claims)

	t.Run("Create bad json", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/model-blocks", bytes.NewReader([]byte("{bad-json")))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("Update bad json", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/chat/model-blocks/b1", bytes.NewReader([]byte("{bad-json")))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("Discover bad json", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/models/discover", bytes.NewReader([]byte("{bad-json")))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})
}

// errorModelBlockService is a mock service for testing error mapping
type errorModelBlockService struct {
	err error
}

func (e *errorModelBlockService) List(ctx context.Context, userID, householdID string) ([]modelblocks.ResponseDTO, error) {
	return nil, e.err
}
func (e *errorModelBlockService) Get(ctx context.Context, userID, householdID, id string) (modelblocks.ResponseDTO, error) {
	return modelblocks.ResponseDTO{}, e.err
}
func (e *errorModelBlockService) Create(ctx context.Context, userID, householdID string, req modelblocks.CreateRequest) (modelblocks.ResponseDTO, error) {
	return modelblocks.ResponseDTO{}, e.err
}
func (e *errorModelBlockService) Update(ctx context.Context, userID, householdID, id string, req modelblocks.UpdateRequest) (modelblocks.ResponseDTO, error) {
	return modelblocks.ResponseDTO{}, e.err
}
func (e *errorModelBlockService) Delete(ctx context.Context, userID, id string) error {
	return e.err
}
func (e *errorModelBlockService) TriggerHealthCheck(ctx context.Context, userID, householdID, id string) (modelblocks.ResponseDTO, error) {
	return modelblocks.ResponseDTO{}, e.err
}
func (e *errorModelBlockService) DiscoverModels(ctx context.Context, req modelblocks.DiscoverRequest) (modelblocks.DiscoverResponse, error) {
	return modelblocks.DiscoverResponse{}, e.err
}
func (e *errorModelBlockService) EnsureBootstrap(ctx context.Context, seed modelblocks.BootstrapSeed) error {
	return e.err
}
func (e *errorModelBlockService) ResolveProvider(ctx context.Context, userID, householdID, id string) (llm.Provider, llm.ProviderPolicy, error) {
	return nil, llm.ProviderPolicy{}, e.err
}

func TestHandler_ServiceErrorsAndWriteServiceError(t *testing.T) {
	claims := &middleware.UserClaims{Subject: "user-1", HouseholdID: "hh-1"}

	tests := []struct {
		name     string
		err      error
		wantCode int
	}{
		{"NotFound", modelblocks.ErrNotFound, http.StatusNotFound},
		{"Forbidden", modelblocks.ErrForbidden, http.StatusForbidden},
		{"MissingHouseholdID", modelblocks.ErrMissingHouseholdID, http.StatusBadRequest},
		{"InvalidVisibility", modelblocks.ErrInvalidVisibility, http.StatusBadRequest},
		{"InvalidProviderType", modelblocks.ErrInvalidProviderType, http.StatusBadRequest},
		{"EncryptionKeyMissing", modelblocks.ErrEncryptionKeyMissing, http.StatusUnprocessableEntity},
		{"GenericError", errors.New("something went wrong"), http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run("Get "+tt.name, func(t *testing.T) {
			svc := &errorModelBlockService{err: tt.err}
			router := newTestRouter(svc, claims)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/model-blocks/b1", nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != tt.wantCode {
				t.Errorf("expected status %d, got %d", tt.wantCode, rec.Code)
			}
		})
	}

	t.Run("List service error", func(t *testing.T) {
		svc := &errorModelBlockService{err: errors.New("db error")}
		router := newTestRouter(svc, claims)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/model-blocks", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status 500, got %d", rec.Code)
		}
	})

	t.Run("Discover service error", func(t *testing.T) {
		svc := &errorModelBlockService{err: errors.New("discovery error")}
		router := newTestRouter(svc, claims)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/models/discover", bytes.NewReader([]byte(`{}`)))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadGateway {
			t.Errorf("expected status 502, got %d", rec.Code)
		}
	})

	t.Run("Delete generic service error", func(t *testing.T) {
		svc := &errorModelBlockService{err: errors.New("delete error")}
		router := newTestRouter(svc, claims)

		req := httptest.NewRequest(http.MethodDelete, "/api/v1/chat/model-blocks/b1", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusInternalServerError {
			t.Errorf("expected status 500, got %d", rec.Code)
		}
	})

	t.Run("TriggerHealthCheck service error", func(t *testing.T) {
		svc := &errorModelBlockService{err: modelblocks.ErrNotFound}
		router := newTestRouter(svc, claims)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/model-blocks/b1/health-check", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", rec.Code)
		}
	})
}

