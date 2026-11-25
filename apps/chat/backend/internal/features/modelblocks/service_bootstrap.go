package modelblocks

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	"alfheim/chat/internal/shared/llm"
)

// bootstrapStateKey identifies the one-time ENV-seeded bootstrap model block in the
// bootstrap_state tracking table. Bumping this would allow re-seeding under a new
// key; the current value must not change without a matching migration/data plan.
const bootstrapStateKey = "model_block_bootstrap_v1"

// bootstrapOwnerUserID marks a model block as system-seeded rather than personally
// owned. Such blocks are read-only for API users, see ModelBlock.CanModify.
const bootstrapOwnerUserID = "system"

func (s *service) EnsureBootstrap(ctx context.Context, seed BootstrapSeed) error {
	if seed.OllamaBaseURL == "" || seed.OllamaModel == "" {
		return nil
	}

	alreadyApplied, err := s.repo.HasBootstrapRun(ctx, bootstrapStateKey)
	if err != nil {
		return fmt.Errorf("failed to check bootstrap state: %w", err)
	}
	if alreadyApplied {
		s.log.Debug("bootstrap model block already applied, skipping")
		return nil
	}

	providerType := seed.Provider
	if providerType == "" {
		providerType = llm.ProviderTypeOllama
	}

	encryptedKey, err := s.encryptAPIKey(nonEmptyPtr(seed.APIKey))
	if err != nil {
		return err
	}

	m := &ModelBlock{
		ID:              uuid.NewString(),
		OwnerUserID:     bootstrapOwnerUserID,
		Visibility:      VisibilityPrivate,
		ProviderType:    providerType,
		DisplayName:     "Bootstrap " + providerType,
		BaseURL:         &seed.OllamaBaseURL,
		ModelIdentifier: seed.OllamaModel,
		APIKeyEncrypted: encryptedKey,
		APIKeyKeyID:     s.encryptionKeyID,
		ConfigJSON:      json.RawMessage("{}"),
		HealthStatus:    HealthStatusUnknown,
		IsBootstrap:     true,
	}

	if err := s.repo.CreateBootstrap(ctx, bootstrapStateKey, m); err != nil {
		return fmt.Errorf("failed to create bootstrap model block: %w", err)
	}

	s.log.Info("seeded bootstrap model block from environment configuration",
		slog.String("id", m.ID), slog.String("provider_type", providerType), slog.String("model_identifier", seed.OllamaModel))
	return nil
}
