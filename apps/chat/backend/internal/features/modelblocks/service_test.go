package modelblocks_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"alfheim/chat/internal/features/modelblocks"
	"alfheim/chat/internal/shared/crypto"
	"alfheim/chat/internal/shared/llm"
)

// fakeRepository is an in-memory Repository double used to unit-test the service
// layer without a real Postgres instance.
type fakeRepository struct {
	blocks        map[string]*modelblocks.ModelBlock
	bootstrapKeys map[string]bool
}

func newFakeRepository() *fakeRepository {
	return &fakeRepository{
		blocks:        make(map[string]*modelblocks.ModelBlock),
		bootstrapKeys: make(map[string]bool),
	}
}

func (f *fakeRepository) Create(ctx context.Context, m *modelblocks.ModelBlock) error {
	now := time.Now()
	m.CreatedAt = now
	m.UpdatedAt = now
	f.blocks[m.ID] = m
	return nil
}

func (f *fakeRepository) GetByID(ctx context.Context, id string) (*modelblocks.ModelBlock, error) {
	m, ok := f.blocks[id]
	if !ok {
		return nil, modelblocks.ErrNotFound
	}
	return m, nil
}

func (f *fakeRepository) ListVisibleTo(ctx context.Context, userID, householdID string) ([]*modelblocks.ModelBlock, error) {
	var out []*modelblocks.ModelBlock
	for _, m := range f.blocks {
		if m.IsVisibleTo(userID, householdID) {
			out = append(out, m)
		}
	}
	return out, nil
}

func (f *fakeRepository) Update(ctx context.Context, m *modelblocks.ModelBlock) error {
	if _, ok := f.blocks[m.ID]; !ok {
		return modelblocks.ErrNotFound
	}
	f.blocks[m.ID] = m
	return nil
}

func (f *fakeRepository) Delete(ctx context.Context, id string) error {
	if _, ok := f.blocks[id]; !ok {
		return modelblocks.ErrNotFound
	}
	delete(f.blocks, id)
	return nil
}

func (f *fakeRepository) UpdateHealth(ctx context.Context, id string, status modelblocks.HealthStatus, detail *string, checkedAt time.Time) error {
	m, ok := f.blocks[id]
	if !ok {
		return modelblocks.ErrNotFound
	}
	m.HealthStatus = status
	m.HealthDetail = detail
	m.HealthCheckedAt = &checkedAt
	return nil
}

func (f *fakeRepository) HasBootstrapRun(ctx context.Context, key string) (bool, error) {
	return f.bootstrapKeys[key], nil
}

func (f *fakeRepository) CreateBootstrap(ctx context.Context, key string, m *modelblocks.ModelBlock) error {
	if f.bootstrapKeys[key] {
		return nil
	}
	f.bootstrapKeys[key] = true
	return f.Create(ctx, m)
}

func testEncryptionKey() []byte {
	key := make([]byte, crypto.KeySize)
	for i := range key {
		key[i] = byte(i)
	}
	return key
}

func newTestService(repo modelblocks.Repository) modelblocks.Service {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return modelblocks.NewService(repo, testEncryptionKey(), "v1", log)
}

func TestService_CreateAndList(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	ctx := context.Background()

	t.Run("creates a private model block without an api key", func(t *testing.T) {
		created, err := svc.Create(ctx, "user-1", "", modelblocks.CreateRequest{
			ProviderType:    "ollama",
			DisplayName:     "Local Llama",
			ModelIdentifier: "llama3.1:8b",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if created.Visibility != modelblocks.VisibilityPrivate {
			t.Errorf("expected private visibility by default, got %s", created.Visibility)
		}
		if created.HasAPIKey {
			t.Errorf("expected has_api_key false, got true")
		}
		if !created.IsOwner {
			t.Errorf("expected creator to be owner")
		}
	})

	t.Run("creates a shared model block requiring a household id", func(t *testing.T) {
		_, err := svc.Create(ctx, "user-1", "", modelblocks.CreateRequest{
			ProviderType:    "ollama",
			DisplayName:     "Shared Llama",
			ModelIdentifier: "llama3.1:8b",
			Visibility:      modelblocks.VisibilityShared,
		})
		if err != modelblocks.ErrMissingHouseholdID {
			t.Errorf("expected ErrMissingHouseholdID, got %v", err)
		}

		created, err := svc.Create(ctx, "user-1", "hh-1", modelblocks.CreateRequest{
			ProviderType:    "ollama",
			DisplayName:     "Shared Llama",
			ModelIdentifier: "llama3.1:8b",
			Visibility:      modelblocks.VisibilityShared,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if created.HouseholdID == nil || *created.HouseholdID != "hh-1" {
			t.Errorf("expected household_id hh-1, got %v", created.HouseholdID)
		}
	})

	t.Run("rejects an empty provider type", func(t *testing.T) {
		_, err := svc.Create(ctx, "user-1", "", modelblocks.CreateRequest{DisplayName: "No Provider"})
		if err != modelblocks.ErrInvalidProviderType {
			t.Errorf("expected ErrInvalidProviderType, got %v", err)
		}
	})

	t.Run("encrypts a supplied api key and never exposes it", func(t *testing.T) {
		key := "sk-super-secret"
		created, err := svc.Create(ctx, "user-2", "", modelblocks.CreateRequest{
			ProviderType:    "openai_compatible",
			DisplayName:     "External",
			ModelIdentifier: "gpt-4.1",
			APIKey:          &key,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !created.HasAPIKey {
			t.Errorf("expected has_api_key true")
		}

		stored := repo.blocks[created.ID]
		if string(stored.APIKeyEncrypted) == key {
			t.Fatalf("api key must not be stored in plaintext")
		}
		decrypted, err := crypto.Decrypt(testEncryptionKey(), stored.APIKeyEncrypted)
		if err != nil {
			t.Fatalf("expected stored ciphertext to decrypt: %v", err)
		}
		if decrypted != key {
			t.Errorf("expected decrypted key %q, got %q", key, decrypted)
		}
	})

	t.Run("list only returns blocks visible to the requesting user", func(t *testing.T) {
		visible, err := svc.List(ctx, "user-1", "hh-1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, v := range visible {
			if v.OwnerUserID != "user-1" && v.Visibility != modelblocks.VisibilityShared {
				t.Errorf("user-1 should not see private block owned by %s", v.OwnerUserID)
			}
		}

		visibleToOther, err := svc.List(ctx, "user-3", "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, v := range visibleToOther {
			if v.OwnerUserID != "user-3" {
				t.Errorf("user-3 with no household should not see other users' blocks, saw %s", v.ID)
			}
		}
	})
}

func TestService_ResolveProviderAndPolicy(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	ctx := context.Background()

	configJSON := json.RawMessage(`{"tool_round_limit":12,"allowed_mcp_apps":["budget","calendar"]}`)
	created, err := svc.Create(ctx, "user-1", "hh-1", modelblocks.CreateRequest{
		ProviderType:    "ollama",
		DisplayName:     "Ollama Policy",
		ModelIdentifier: "llama3.2",
		Visibility:      modelblocks.VisibilityShared,
		ConfigJSON:      configJSON,
	})
	if err != nil {
		t.Fatalf("unexpected error creating model block: %v", err)
	}

	provider, policy, err := svc.ResolveProvider(ctx, "user-1", "hh-1", created.ID)
	if err != nil {
		t.Fatalf("unexpected error resolving provider: %v", err)
	}
	if provider == nil {
		t.Fatal("expected non-nil provider")
	}
	if policy.ToolRoundLimit != 12 {
		t.Errorf("expected tool_round_limit 12, got %d", policy.ToolRoundLimit)
	}
	if len(policy.AllowedMCPApps) != 2 || policy.AllowedMCPApps[0] != "budget" {
		t.Errorf("unexpected allowed mcp apps: %+v", policy.AllowedMCPApps)
	}

	// Test ResolveProvider forbidden for user in another household
	_, _, err = svc.ResolveProvider(ctx, "other-user", "hh-99", created.ID)
	if err != modelblocks.ErrForbidden {
		t.Errorf("expected ErrForbidden, got %v", err)
	}
}

func TestService_UpdateOwnershipRules(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	ctx := context.Background()

	created, err := svc.Create(ctx, "owner-1", "", modelblocks.CreateRequest{
		ProviderType:    "ollama",
		DisplayName:     "Mine",
		ModelIdentifier: "llama3.1:8b",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Run("owner can update", func(t *testing.T) {
		newName := "Renamed"
		updated, err := svc.Update(ctx, "owner-1", "", created.ID, modelblocks.UpdateRequest{DisplayName: &newName})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.DisplayName != "Renamed" {
			t.Errorf("expected display name Renamed, got %s", updated.DisplayName)
		}
	})

	t.Run("non-owner cannot update a private block", func(t *testing.T) {
		newName := "Hijacked"
		_, err := svc.Update(ctx, "someone-else", "", created.ID, modelblocks.UpdateRequest{DisplayName: &newName})
		if err != modelblocks.ErrForbidden {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("non-owner cannot update a shared block either", func(t *testing.T) {
		shared, err := svc.Create(ctx, "owner-1", "hh-1", modelblocks.CreateRequest{
			ProviderType:    "ollama",
			DisplayName:     "Shared",
			ModelIdentifier: "llama3.1:8b",
			Visibility:      modelblocks.VisibilityShared,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		newName := "Hijacked"
		_, err = svc.Update(ctx, "household-member-2", "hh-1", shared.ID, modelblocks.UpdateRequest{DisplayName: &newName})
		if err != modelblocks.ErrForbidden {
			t.Errorf("expected ErrForbidden for shared block edit by non-owner, got %v", err)
		}
	})

	t.Run("non-owner cannot delete", func(t *testing.T) {
		err := svc.Delete(ctx, "someone-else", created.ID)
		if err != modelblocks.ErrForbidden {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("owner can delete", func(t *testing.T) {
		if err := svc.Delete(ctx, "owner-1", created.ID); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, err := svc.Update(ctx, "owner-1", "", created.ID, modelblocks.UpdateRequest{}); err != modelblocks.ErrNotFound {
			t.Errorf("expected ErrNotFound after deletion, got %v", err)
		}
	})
}

func TestService_GetAndVisibility(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	ctx := context.Background()

	shared, err := svc.Create(ctx, "owner-1", "hh-1", modelblocks.CreateRequest{
		ProviderType:    "ollama",
		DisplayName:     "Shared Llama",
		ModelIdentifier: "llama3.1:8b",
		Visibility:      modelblocks.VisibilityShared,
	})
	if err != nil {
		t.Fatalf("unexpected error creating shared block: %v", err)
	}

	private, err := svc.Create(ctx, "owner-1", "", modelblocks.CreateRequest{
		ProviderType:    "ollama",
		DisplayName:     "Private Llama",
		ModelIdentifier: "llama3.1:8b",
		Visibility:      modelblocks.VisibilityPrivate,
	})
	if err != nil {
		t.Fatalf("unexpected error creating private block: %v", err)
	}

	t.Run("owner can get private and shared block", func(t *testing.T) {
		res, err := svc.Get(ctx, "owner-1", "hh-1", shared.ID)
		if err != nil {
			t.Fatalf("expected owner to get shared block, got: %v", err)
		}
		if !res.IsOwner {
			t.Errorf("expected IsOwner true for owner")
		}

		resPriv, err := svc.Get(ctx, "owner-1", "", private.ID)
		if err != nil {
			t.Fatalf("expected owner to get private block, got: %v", err)
		}
		if !resPriv.IsOwner {
			t.Errorf("expected IsOwner true for owner")
		}
	})

	t.Run("household member can get shared block but IsOwner is false", func(t *testing.T) {
		res, err := svc.Get(ctx, "member-2", "hh-1", shared.ID)
		if err != nil {
			t.Fatalf("expected household member to get shared block, got: %v", err)
		}
		if res.IsOwner {
			t.Errorf("expected IsOwner false for household member")
		}
	})

	t.Run("household member cannot get private block", func(t *testing.T) {
		_, err := svc.Get(ctx, "member-2", "hh-1", private.ID)
		if err != modelblocks.ErrForbidden {
			t.Errorf("expected ErrForbidden for private block access by other user, got: %v", err)
		}
	})

	t.Run("user in different household cannot get shared block", func(t *testing.T) {
		_, err := svc.Get(ctx, "other-user", "hh-2", shared.ID)
		if err != modelblocks.ErrForbidden {
			t.Errorf("expected ErrForbidden for foreign household, got: %v", err)
		}
	})
}

func TestService_TriggerHealthCheck(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	ctx := context.Background()

	t.Run("marks unknown health for an unimplemented provider", func(t *testing.T) {
		created, err := svc.Create(ctx, "user-1", "", modelblocks.CreateRequest{
			ProviderType:    "anthropic",
			DisplayName:     "External",
			ModelIdentifier: "claude-3",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		result, err := svc.TriggerHealthCheck(ctx, "user-1", "", created.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.HealthStatus != modelblocks.HealthStatusUnknown {
			t.Errorf("expected unknown health status for unimplemented provider, got %s", result.HealthStatus)
		}
		if result.HealthCheckedAt == nil {
			t.Errorf("expected health_checked_at to be set")
		}
	})

	t.Run("non-owner with no household cannot trigger health check on private block", func(t *testing.T) {
		created, err := svc.Create(ctx, "user-1", "", modelblocks.CreateRequest{
			ProviderType:    "ollama",
			DisplayName:     "Mine",
			ModelIdentifier: "llama3.1:8b",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		_, err = svc.TriggerHealthCheck(ctx, "someone-else", "", created.ID)
		if err != modelblocks.ErrForbidden {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("authorized household member can trigger health check on shared block", func(t *testing.T) {
		shared, err := svc.Create(ctx, "owner-1", "hh-1", modelblocks.CreateRequest{
			ProviderType:    "anthropic",
			DisplayName:     "Shared Anthropic",
			ModelIdentifier: "claude-3",
			Visibility:      modelblocks.VisibilityShared,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		res, err := svc.TriggerHealthCheck(ctx, "member-2", "hh-1", shared.ID)
		if err != nil {
			t.Fatalf("expected household member to trigger health check on shared block, got %v", err)
		}
		if res.HealthStatus != modelblocks.HealthStatusUnknown {
			t.Errorf("expected unknown health status, got %s", res.HealthStatus)
		}
	})
}

func TestService_EnsureBootstrap(t *testing.T) {
	ctx := context.Background()

	t.Run("does nothing when no bootstrap ollama config is provided", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo)

		if err := svc.EnsureBootstrap(ctx, modelblocks.BootstrapSeed{}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(repo.blocks) != 0 {
			t.Errorf("expected no model blocks to be created, got %d", len(repo.blocks))
		}
	})

	t.Run("seeds exactly one bootstrap block on first run and skips thereafter", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo)

		seed := modelblocks.BootstrapSeed{
			Provider:      "ollama",
			OllamaBaseURL: "http://ollama:11434",
			OllamaModel:   "llama3.1:8b",
		}

		if err := svc.EnsureBootstrap(ctx, seed); err != nil {
			t.Fatalf("unexpected error on first bootstrap: %v", err)
		}
		if len(repo.blocks) != 1 {
			t.Fatalf("expected exactly 1 bootstrap model block, got %d", len(repo.blocks))
		}

		var bootstrapID string
		for id, m := range repo.blocks {
			bootstrapID = id
			if !m.IsBootstrap {
				t.Errorf("expected seeded block to be marked is_bootstrap")
			}
		}

		// Simulate the user deleting the bootstrap block, then restarting the server.
		delete(repo.blocks, bootstrapID)

		if err := svc.EnsureBootstrap(ctx, seed); err != nil {
			t.Fatalf("unexpected error on second bootstrap call: %v", err)
		}
		if len(repo.blocks) != 0 {
			t.Errorf("expected bootstrap to stay deleted after the first run, got %d blocks", len(repo.blocks))
		}
	})
}

func TestService_EncryptionKeyMissing(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	repo := newFakeRepository()
	svc := modelblocks.NewService(repo, nil, "", log)
	ctx := context.Background()

	apiKey := "sk-test"
	_, err := svc.Create(ctx, "user-1", "", modelblocks.CreateRequest{
		ProviderType:    "openai_compatible",
		DisplayName:     "External",
		ModelIdentifier: "gpt-4.1",
		APIKey:          &apiKey,
	})
	if err != modelblocks.ErrEncryptionKeyMissing {
		t.Errorf("expected ErrEncryptionKeyMissing, got %v", err)
	}
}

func TestService_DiscoverModels(t *testing.T) {
	mockOllama := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/tags" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"models": []map[string]any{
				{"name": "llama3.2:3b"},
				{"name": "deepseek-r1:8b"},
			},
		})
	}))
	defer mockOllama.Close()

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	repo := newFakeRepository()
	svc := modelblocks.NewService(repo, nil, "", log)
	ctx := context.Background()

	t.Run("successful discovery", func(t *testing.T) {
		resp, err := svc.DiscoverModels(ctx, modelblocks.DiscoverRequest{
			ProviderType: "ollama",
			BaseURL:      &mockOllama.URL,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(resp.Models) != 2 || resp.Models[0] != "llama3.2:3b" || resp.Models[1] != "deepseek-r1:8b" {
			t.Errorf("unexpected models: %+v", resp.Models)
		}
	})

	t.Run("unsupported provider", func(t *testing.T) {
		_, err := svc.DiscoverModels(ctx, modelblocks.DiscoverRequest{
			ProviderType: "anthropic",
		})
		if err == nil {
			t.Fatal("expected error for unsupported provider, got nil")
		}
	})
}

func TestService_Update_AllBranches(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)
	ctx := context.Background()

	created, err := svc.Create(ctx, "user-1", "hh-1", modelblocks.CreateRequest{
		ProviderType:    "ollama",
		DisplayName:     "Original",
		ModelIdentifier: "llama3.1",
		Visibility:      modelblocks.VisibilityShared,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Run("update baseURL empty string resets to default ollama URL", func(t *testing.T) {
		emptyURL := "   "
		updated, err := svc.Update(ctx, "user-1", "hh-1", created.ID, modelblocks.UpdateRequest{
			BaseURL: &emptyURL,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.BaseURL == nil || *updated.BaseURL != llm.DefaultOllamaBaseURL {
			t.Errorf("expected default ollama url, got %v", updated.BaseURL)
		}
	})

	t.Run("update baseURL non-empty normalizes ollama URL", func(t *testing.T) {
		customURL := "http://my-ollama:11434/"
		updated, err := svc.Update(ctx, "user-1", "hh-1", created.ID, modelblocks.UpdateRequest{
			BaseURL: &customURL,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.BaseURL == nil || *updated.BaseURL != "http://my-ollama:11434" {
			t.Errorf("expected normalized url, got %v", updated.BaseURL)
		}
	})

	t.Run("update modelIdentifier and configJSON", func(t *testing.T) {
		newModel := "llama3.2:1b"
		newCfg := json.RawMessage(`{"tool_round_limit":5}`)
		updated, err := svc.Update(ctx, "user-1", "hh-1", created.ID, modelblocks.UpdateRequest{
			ModelIdentifier: &newModel,
			ConfigJSON:      newCfg,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.ModelIdentifier != newModel {
			t.Errorf("expected model %s, got %s", newModel, updated.ModelIdentifier)
		}
	})

	t.Run("update visibility to private", func(t *testing.T) {
		priv := modelblocks.VisibilityPrivate
		updated, err := svc.Update(ctx, "user-1", "hh-1", created.ID, modelblocks.UpdateRequest{
			Visibility: &priv,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.Visibility != modelblocks.VisibilityPrivate || updated.HouseholdID != nil {
			t.Errorf("expected private visibility and nil household, got %+v", updated)
		}
	})

	t.Run("update visibility to shared without household ID", func(t *testing.T) {
		shared := modelblocks.VisibilityShared
		_, err := svc.Update(ctx, "user-1", "", created.ID, modelblocks.UpdateRequest{
			Visibility: &shared,
		})
		if !errors.Is(err, modelblocks.ErrMissingHouseholdID) {
			t.Errorf("expected ErrMissingHouseholdID, got %v", err)
		}
	})

	t.Run("update visibility with invalid string", func(t *testing.T) {
		invalid := modelblocks.Visibility("public")
		_, err := svc.Update(ctx, "user-1", "hh-1", created.ID, modelblocks.UpdateRequest{
			Visibility: &invalid,
		})
		if !errors.Is(err, modelblocks.ErrInvalidVisibility) {
			t.Errorf("expected ErrInvalidVisibility, got %v", err)
		}
	})

	t.Run("update apiKey and clear apiKey", func(t *testing.T) {
		key := "sk-new-key"
		updated, err := svc.Update(ctx, "user-1", "hh-1", created.ID, modelblocks.UpdateRequest{
			APIKey: &key,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !updated.HasAPIKey {
			t.Errorf("expected has_api_key true")
		}

		// Now clear API key
		updated2, err := svc.Update(ctx, "user-1", "hh-1", created.ID, modelblocks.UpdateRequest{
			ClearAPIKey: true,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated2.HasAPIKey {
			t.Errorf("expected has_api_key false after clearing")
		}
	})

	t.Run("update on non-ollama provider sets baseURL directly", func(t *testing.T) {
		nonOllama, err := svc.Create(ctx, "user-1", "", modelblocks.CreateRequest{
			ProviderType:    "openai_compatible",
			DisplayName:     "OpenAI",
			ModelIdentifier: "gpt-4",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		customURL := "https://api.openai.com/v1"
		updated, err := svc.Update(ctx, "user-1", "", nonOllama.ID, modelblocks.UpdateRequest{
			BaseURL: &customURL,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.BaseURL == nil || *updated.BaseURL != customURL {
			t.Errorf("expected %s, got %v", customURL, updated.BaseURL)
		}
	})

	t.Run("update encryption error when key missing", func(t *testing.T) {
		noKeySvc := modelblocks.NewService(repo, nil, "", slog.New(slog.NewTextHandler(io.Discard, nil)))
		key := "sk-fail"
		_, err := noKeySvc.Update(ctx, "user-1", "", created.ID, modelblocks.UpdateRequest{
			APIKey: &key,
		})
		if !errors.Is(err, modelblocks.ErrEncryptionKeyMissing) {
			t.Errorf("expected ErrEncryptionKeyMissing, got %v", err)
		}
	})

	t.Run("update not found in repo", func(t *testing.T) {
		_, err := svc.Update(ctx, "user-1", "", "nonexistent", modelblocks.UpdateRequest{})
		if !errors.Is(err, modelblocks.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

// failingRepo mocks repository failures
type failingRepo struct {
	*fakeRepository
	listErr         error
	getErr          error
	createErr       error
	updateErr       error
	deleteErr       error
	updateHealthErr error
	hasBootstrapErr error
	createBootErr   error
}

func (f *failingRepo) ListVisibleTo(ctx context.Context, userID, householdID string) ([]*modelblocks.ModelBlock, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.fakeRepository.ListVisibleTo(ctx, userID, householdID)
}

func (f *failingRepo) GetByID(ctx context.Context, id string) (*modelblocks.ModelBlock, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.fakeRepository.GetByID(ctx, id)
}

func (f *failingRepo) Create(ctx context.Context, m *modelblocks.ModelBlock) error {
	if f.createErr != nil {
		return f.createErr
	}
	return f.fakeRepository.Create(ctx, m)
}

func (f *failingRepo) Update(ctx context.Context, m *modelblocks.ModelBlock) error {
	if f.updateErr != nil {
		return f.updateErr
	}
	return f.fakeRepository.Update(ctx, m)
}

func (f *failingRepo) Delete(ctx context.Context, id string) error {
	if f.deleteErr != nil {
		return f.deleteErr
	}
	return f.fakeRepository.Delete(ctx, id)
}

func (f *failingRepo) UpdateHealth(ctx context.Context, id string, status modelblocks.HealthStatus, detail *string, checkedAt time.Time) error {
	if f.updateHealthErr != nil {
		return f.updateHealthErr
	}
	return f.fakeRepository.UpdateHealth(ctx, id, status, detail, checkedAt)
}

func (f *failingRepo) HasBootstrapRun(ctx context.Context, key string) (bool, error) {
	if f.hasBootstrapErr != nil {
		return false, f.hasBootstrapErr
	}
	return f.fakeRepository.HasBootstrapRun(ctx, key)
}

func (f *failingRepo) CreateBootstrap(ctx context.Context, key string, m *modelblocks.ModelBlock) error {
	if f.createBootErr != nil {
		return f.createBootErr
	}
	return f.fakeRepository.CreateBootstrap(ctx, key, m)
}

func TestService_RepoErrorPropagation(t *testing.T) {
	ctx := context.Background()

	t.Run("List repo error", func(t *testing.T) {
		repo := &failingRepo{fakeRepository: newFakeRepository(), listErr: errors.New("list failed")}
		svc := newTestService(repo)
		_, err := svc.List(ctx, "u1", "")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("Get repo error", func(t *testing.T) {
		repo := &failingRepo{fakeRepository: newFakeRepository(), getErr: errors.New("get failed")}
		svc := newTestService(repo)
		_, err := svc.Get(ctx, "u1", "", "b1")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("Create repo error", func(t *testing.T) {
		repo := &failingRepo{fakeRepository: newFakeRepository(), createErr: errors.New("create failed")}
		svc := newTestService(repo)
		_, err := svc.Create(ctx, "u1", "", modelblocks.CreateRequest{
			ProviderType: "ollama",
			DisplayName:  "Test",
		})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("Update repo error", func(t *testing.T) {
		baseRepo := newFakeRepository()
		svcInit := newTestService(baseRepo)
		created, _ := svcInit.Create(ctx, "u1", "", modelblocks.CreateRequest{
			ProviderType: "ollama",
			DisplayName:  "Test",
		})
		repo := &failingRepo{fakeRepository: baseRepo, updateErr: errors.New("update failed")}
		svc := newTestService(repo)
		newName := "New"
		_, err := svc.Update(ctx, "u1", "", created.ID, modelblocks.UpdateRequest{DisplayName: &newName})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("Delete repo GetByID error and Delete error", func(t *testing.T) {
		repo := &failingRepo{fakeRepository: newFakeRepository(), getErr: errors.New("get failed")}
		svc := newTestService(repo)
		if err := svc.Delete(ctx, "u1", "b1"); err == nil {
			t.Fatal("expected error, got nil")
		}

		baseRepo := newFakeRepository()
		svcInit := newTestService(baseRepo)
		created, _ := svcInit.Create(ctx, "u1", "", modelblocks.CreateRequest{
			ProviderType: "ollama",
			DisplayName:  "Test",
		})
		repo2 := &failingRepo{fakeRepository: baseRepo, deleteErr: errors.New("delete failed")}
		svc2 := newTestService(repo2)
		if err := svc2.Delete(ctx, "u1", created.ID); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("TriggerHealthCheck repo GetByID and UpdateHealth error", func(t *testing.T) {
		repo := &failingRepo{fakeRepository: newFakeRepository(), getErr: errors.New("get failed")}
		svc := newTestService(repo)
		if _, err := svc.TriggerHealthCheck(ctx, "u1", "", "b1"); err == nil {
			t.Fatal("expected error, got nil")
		}

		baseRepo := newFakeRepository()
		svcInit := newTestService(baseRepo)
		created, _ := svcInit.Create(ctx, "u1", "", modelblocks.CreateRequest{
			ProviderType: "ollama",
			DisplayName:  "Test",
		})
		repo2 := &failingRepo{fakeRepository: baseRepo, updateHealthErr: errors.New("health update failed")}
		svc2 := newTestService(repo2)
		if _, err := svc2.TriggerHealthCheck(ctx, "u1", "", created.ID); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("EnsureBootstrap HasBootstrapRun error and CreateBootstrap error", func(t *testing.T) {
		repo := &failingRepo{fakeRepository: newFakeRepository(), hasBootstrapErr: errors.New("check failed")}
		svc := newTestService(repo)
		seed := modelblocks.BootstrapSeed{OllamaBaseURL: "http://localhost:11434", OllamaModel: "llama3"}
		if err := svc.EnsureBootstrap(ctx, seed); err == nil {
			t.Fatal("expected error, got nil")
		}

		repo2 := &failingRepo{fakeRepository: newFakeRepository(), createBootErr: errors.New("create boot failed")}
		svc2 := newTestService(repo2)
		if err := svc2.EnsureBootstrap(ctx, seed); err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestService_DecryptAndBuildProvider_EdgeCases(t *testing.T) {
	ctx := context.Background()

	t.Run("decryptAPIKey with corrupted ciphertext", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo)
		mb := &modelblocks.ModelBlock{
			ID:              "corrupt",
			OwnerUserID:     "u1",
			ProviderType:    "ollama",
			DisplayName:     "Corrupt",
			APIKeyEncrypted: []byte("invalid-corrupted-ciphertext"),
			Visibility:      modelblocks.VisibilityPrivate,
		}
		repo.Create(ctx, mb)

		_, _, err := svc.ResolveProvider(ctx, "u1", "", mb.ID)
		if err == nil {
			t.Fatal("expected decryption error, got nil")
		}
	})

	t.Run("decryptAPIKey when encryption key is missing", func(t *testing.T) {
		repo := newFakeRepository()
		noKeySvc := modelblocks.NewService(repo, nil, "", slog.New(slog.NewTextHandler(io.Discard, nil)))
		mb := &modelblocks.ModelBlock{
			ID:              "encrypted-no-key",
			OwnerUserID:     "u1",
			ProviderType:    "ollama",
			DisplayName:     "Encrypted",
			APIKeyEncrypted: []byte("some-ciphertext"),
			Visibility:      modelblocks.VisibilityPrivate,
		}
		repo.Create(ctx, mb)

		_, _, err := noKeySvc.ResolveProvider(ctx, "u1", "", mb.ID)
		if !errors.Is(err, modelblocks.ErrEncryptionKeyMissing) {
			t.Errorf("expected ErrEncryptionKeyMissing, got %v", err)
		}
	})

	t.Run("ResolveProvider repo GetByID error", func(t *testing.T) {
		repo := &failingRepo{fakeRepository: newFakeRepository(), getErr: errors.New("get failed")}
		svc := newTestService(repo)
		_, _, err := svc.ResolveProvider(ctx, "u1", "", "nonexistent")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("buildProvider with Ollama and empty BaseURL falls back to default", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo)
		emptyBase := ""
		mb := &modelblocks.ModelBlock{
			ID:           "default-base",
			OwnerUserID:  "u1",
			ProviderType: "ollama",
			BaseURL:      &emptyBase,
			Visibility:   modelblocks.VisibilityPrivate,
		}
		repo.Create(ctx, mb)

		provider, _, err := svc.ResolveProvider(ctx, "u1", "", mb.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if provider == nil {
			t.Fatal("expected non-nil provider")
		}
	})
}

func TestService_ParseProviderPolicy_EdgeCases(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepository()
	svc := newTestService(repo)

	t.Run("malformed json uses defaults", func(t *testing.T) {
		mb := &modelblocks.ModelBlock{
			ID:           "malformed-cfg",
			OwnerUserID:  "u1",
			ProviderType: "ollama",
			ConfigJSON:   json.RawMessage(`{not-valid-json`),
			Visibility:   modelblocks.VisibilityPrivate,
		}
		repo.Create(ctx, mb)

		_, policy, err := svc.ResolveProvider(ctx, "u1", "", mb.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if policy.ToolRoundLimit != 8 {
			t.Errorf("expected default tool round limit 8, got %d", policy.ToolRoundLimit)
		}
	})

	t.Run("tool round limit <= 0 is ignored", func(t *testing.T) {
		mb := &modelblocks.ModelBlock{
			ID:           "zero-limit",
			OwnerUserID:  "u1",
			ProviderType: "ollama",
			ConfigJSON:   json.RawMessage(`{"tool_round_limit":0}`),
			Visibility:   modelblocks.VisibilityPrivate,
		}
		repo.Create(ctx, mb)

		_, policy, err := svc.ResolveProvider(ctx, "u1", "", mb.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if policy.ToolRoundLimit != 8 {
			t.Errorf("expected default tool round limit 8, got %d", policy.ToolRoundLimit)
		}
	})
}

func TestService_DiscoverAndFetchOllama_EdgeCases(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepository()
	svc := newTestService(repo)

	t.Run("server returns 500 error", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer srv.Close()

		_, err := svc.DiscoverModels(ctx, modelblocks.DiscoverRequest{
			BaseURL: &srv.URL,
		})
		if err == nil {
			t.Fatal("expected error for 500 response, got nil")
		}
	})

	t.Run("server returns invalid json", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{not-json`))
		}))
		defer srv.Close()

		_, err := svc.DiscoverModels(ctx, modelblocks.DiscoverRequest{
			BaseURL: &srv.URL,
		})
		if err == nil {
			t.Fatal("expected error for invalid json, got nil")
		}
	})

	t.Run("server returns models with model field instead of name", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"models": []map[string]any{
					{"model": "qwen2:latest"},
				},
			})
		}))
		defer srv.Close()

		resp, err := svc.DiscoverModels(ctx, modelblocks.DiscoverRequest{
			BaseURL: &srv.URL,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(resp.Models) != 1 || resp.Models[0] != "qwen2:latest" {
			t.Errorf("unexpected models: %+v", resp.Models)
		}
	})

	t.Run("with apiKey header", func(t *testing.T) {
		apiKeyHeaderReceived := false
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") == "Bearer my-ollama-key" {
				apiKeyHeaderReceived = true
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"models": []any{}})
		}))
		defer srv.Close()

		key := "my-ollama-key"
		_, err := svc.DiscoverModels(ctx, modelblocks.DiscoverRequest{
			BaseURL: &srv.URL,
			APIKey:  &key,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !apiKeyHeaderReceived {
			t.Error("expected Authorization header to be passed")
		}
	})
}

func TestToResponse_NilConfigJSON(t *testing.T) {
	mb := &modelblocks.ModelBlock{
		ID:           "b1",
		DisplayName:  "Test",
		ProviderType: "ollama",
		ConfigJSON:   nil, // nil config json
	}
	resp := modelblocks.ToResponse(mb, "u1")
	if string(resp.ConfigJSON) != "{}" {
		t.Errorf("expected {}, got %s", string(resp.ConfigJSON))
	}
}
