package modelblocks_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"alfheim/chat/internal/features/modelblocks"
	"alfheim/chat/internal/shared/crypto"
	"alfheim/chat/internal/shared/middleware"
)

func seedBootstrapBlock(t *testing.T, repo *fakeRepository, baseURL string) *modelblocks.ModelBlock {
	t.Helper()
	ciphertext, err := crypto.Encrypt(testEncryptionKey(), "operator-secret-key")
	if err != nil {
		t.Fatalf("failed to encrypt: %v", err)
	}
	m := &modelblocks.ModelBlock{
		ID:              "bootstrap-1",
		OwnerUserID:     "system",
		Visibility:      modelblocks.VisibilityPrivate,
		ProviderType:    "openai_compatible",
		DisplayName:     "Bootstrap",
		BaseURL:         &baseURL,
		ModelIdentifier: "m",
		APIKeyEncrypted: ciphertext,
		IsBootstrap:     true,
	}
	if err := repo.Create(context.Background(), m); err != nil {
		t.Fatalf("failed to seed: %v", err)
	}
	return m
}

func TestBootstrapBlockIsReadOnlyForEveryUser(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	ctx := context.Background()
	m := seedBootstrapBlock(t, repo, "https://api.openai.com/v1")

	if m.CanModify("system") || m.CanModify("attacker") {
		t.Fatal("bootstrap block must not be modifiable by any user")
	}

	attackerURL := "https://api.openai.com/attacker"
	if _, err := svc.Update(ctx, "attacker", "", m.ID, modelblocks.UpdateRequest{BaseURL: &attackerURL}); !errors.Is(err, modelblocks.ErrBootstrapReadOnly) {
		t.Errorf("expected ErrBootstrapReadOnly on update, got %v", err)
	}
	if err := svc.Delete(ctx, "attacker", m.ID); !errors.Is(err, modelblocks.ErrBootstrapReadOnly) {
		t.Errorf("expected ErrBootstrapReadOnly on delete, got %v", err)
	}
	if got := repo.blocks[m.ID]; *got.BaseURL != "https://api.openai.com/v1" || !got.HasAPIKey() {
		t.Errorf("bootstrap block was changed: %+v", got)
	}

	// Bootstrap blocks stay usable and visible.
	if _, err := svc.Get(ctx, "attacker", "", m.ID); err != nil {
		t.Errorf("bootstrap block must stay visible: %v", err)
	}
	if _, _, err := svc.ResolveProvider(ctx, "attacker", "", m.ID); err != nil {
		t.Errorf("bootstrap block must stay usable: %v", err)
	}
}

func TestUpdate_BaseURLChangeDoesNotReuseStoredAPIKey(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	ctx := context.Background()

	baseURL := "https://api.openai.com/v1"
	key := "sk-owner-key"
	created, err := svc.Create(ctx, "owner", "", modelblocks.CreateRequest{
		ProviderType: "openai_compatible", DisplayName: "n", ModelIdentifier: "m", BaseURL: &baseURL, APIKey: &key,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	newURL := "https://api.openai.com/other"
	t.Run("rejected without a new key", func(t *testing.T) {
		_, err := svc.Update(ctx, "owner", "", created.ID, modelblocks.UpdateRequest{BaseURL: &newURL})
		if !errors.Is(err, modelblocks.ErrAPIKeyRequiredForBaseURLChange) {
			t.Fatalf("expected ErrAPIKeyRequiredForBaseURLChange, got %v", err)
		}
		if got := repo.blocks[created.ID]; *got.BaseURL != baseURL || !got.HasAPIKey() {
			t.Errorf("block must be unchanged after the rejected update: %+v", got)
		}
	})

	t.Run("allowed with a replacement key", func(t *testing.T) {
		replacement := "sk-new"
		updated, err := svc.Update(ctx, "owner", "", created.ID, modelblocks.UpdateRequest{BaseURL: &newURL, APIKey: &replacement})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !updated.HasAPIKey || *updated.BaseURL != newURL {
			t.Errorf("unexpected result: %+v", updated)
		}
	})

	t.Run("allowed when the key is cleared", func(t *testing.T) {
		again := "https://api.openai.com/third"
		updated, err := svc.Update(ctx, "owner", "", created.ID, modelblocks.UpdateRequest{BaseURL: &again, ClearAPIKey: true})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.HasAPIKey {
			t.Error("expected the stored key to be cleared")
		}
	})

	t.Run("unchanged url keeps the key", func(t *testing.T) {
		withKey := "sk-again"
		if _, err := svc.Update(ctx, "owner", "", created.ID, modelblocks.UpdateRequest{APIKey: &withKey}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		same := "HTTPS://api.openai.com/third/"
		name := "renamed"
		updated, err := svc.Update(ctx, "owner", "", created.ID, modelblocks.UpdateRequest{BaseURL: &same, DisplayName: &name})
		if err != nil {
			t.Fatalf("unexpected error for equivalent url: %v", err)
		}
		if !updated.HasAPIKey {
			t.Error("key must be kept when the endpoint did not change")
		}
	})
}

func TestBaseURLGuard_CreateUpdateDiscover(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	ctx := context.Background()

	blocked := []string{
		"http://169.254.169.254/latest/meta-data",
		"http://10.1.2.3:8080",
		"http://192.168.0.10",
		"http://[::1]:11434",
		"file:///etc/passwd",
		"ftp://example.com",
		"http://0.0.0.0",
	}
	for _, u := range blocked {
		t.Run(u, func(t *testing.T) {
			url := u
			_, err := svc.Create(ctx, "owner", "", modelblocks.CreateRequest{
				ProviderType: "openai_compatible", DisplayName: "n", ModelIdentifier: "m", BaseURL: &url,
			})
			if !errors.Is(err, modelblocks.ErrInvalidBaseURL) {
				t.Errorf("create: expected ErrInvalidBaseURL, got %v", err)
			}
			if _, err := svc.DiscoverModels(ctx, modelblocks.DiscoverRequest{ProviderType: "ollama", BaseURL: &url}); !errors.Is(err, modelblocks.ErrInvalidBaseURL) {
				t.Errorf("discover: expected ErrInvalidBaseURL, got %v", err)
			}
		})
	}

	good := "https://api.openai.com/v1"
	created, err := svc.Create(ctx, "owner", "", modelblocks.CreateRequest{
		ProviderType: "openai_compatible", DisplayName: "n", ModelIdentifier: "m", BaseURL: &good,
	})
	if err != nil {
		t.Fatalf("create with public url failed: %v", err)
	}
	metadata := "http://169.254.169.254/"
	if _, err := svc.Update(ctx, "owner", "", created.ID, modelblocks.UpdateRequest{BaseURL: &metadata, ClearAPIKey: true}); !errors.Is(err, modelblocks.ErrInvalidBaseURL) {
		t.Errorf("update: expected ErrInvalidBaseURL, got %v", err)
	}
	if *repo.blocks[created.ID].BaseURL != good {
		t.Error("blocked update must not be persisted")
	}
}

func TestDiscover_DoesNotFollowRedirects(t *testing.T) {
	var internalHits atomic.Int32
	internal := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		internalHits.Add(1)
		_, _ = w.Write([]byte(`{"models":[{"name":"secret-internal"}]}`))
	}))
	defer internal.Close()

	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, internal.URL+"/api/tags", http.StatusFound)
	}))
	defer redirector.Close()

	svc := newTestService(newFakeRepository())
	url := redirector.URL
	resp, err := svc.DiscoverModels(context.Background(), modelblocks.DiscoverRequest{ProviderType: "ollama", BaseURL: &url})
	if !errors.Is(err, modelblocks.ErrDiscoveryFailed) {
		t.Fatalf("expected ErrDiscoveryFailed, got %v", err)
	}
	if len(resp.Models) != 0 || internalHits.Load() != 0 {
		t.Errorf("redirect was followed: models=%v hits=%d", resp.Models, internalHits.Load())
	}
}

func TestHandler_DiscoverErrorsAreGeneric(t *testing.T) {
	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal-stack-trace db at 10.9.9.9", http.StatusInternalServerError)
	}))
	defer failing.Close()

	router := newTestRouter(newTestService(newFakeRepository()), &middleware.UserClaims{Subject: "u1"})

	post := func(body map[string]any) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/models/discover", bytes.NewReader(raw))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	rec := post(map[string]any{"provider_type": "ollama", "base_url": failing.URL})
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d", rec.Code)
	}
	for _, leaked := range []string{"10.9.9.9", "stack-trace", "127.0.0.1", "status 500"} {
		if strings.Contains(rec.Body.String(), leaked) {
			t.Errorf("response leaks upstream detail %q: %s", leaked, rec.Body.String())
		}
	}

	rec = post(map[string]any{"provider_type": "ollama", "base_url": "http://169.254.169.254"})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for blocked url, got %d", rec.Code)
	}
}

func TestHandler_BootstrapMutationReturnsForbidden(t *testing.T) {
	repo := newFakeRepository()
	m := seedBootstrapBlock(t, repo, "https://api.openai.com/v1")
	router := newTestRouter(newTestService(repo), &middleware.UserClaims{Subject: "u1"})

	for _, method := range []string{http.MethodPatch, http.MethodDelete} {
		req := httptest.NewRequest(method, "/api/v1/chat/model-blocks/"+m.ID, strings.NewReader(`{"base_url":"https://evil.example"}`))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "bootstrap_read_only") {
			t.Errorf("%s: expected 403 bootstrap_read_only, got %d %s", method, rec.Code, rec.Body.String())
		}
	}
}
