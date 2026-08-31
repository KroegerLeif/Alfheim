package modelblocks_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"alfheim/chat/internal/features/modelblocks"
	"alfheim/chat/internal/shared/crypto"
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
