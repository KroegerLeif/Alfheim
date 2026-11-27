package modelblocks

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"

	"alfheim/chat/internal/shared/llm"
	"alfheim/go-shared/crypto"
)

func (s *service) Create(ctx context.Context, userID, householdID string, req CreateRequest) (ResponseDTO, error) {
	if !llm.IsSupportedProviderType(req.ProviderType) {
		return ResponseDTO{}, ErrInvalidProviderType
	}

	visibility := req.Visibility
	if visibility == "" {
		visibility = VisibilityPrivate
	}
	if visibility != VisibilityPrivate && visibility != VisibilityShared {
		return ResponseDTO{}, ErrInvalidVisibility
	}

	var scopedHouseholdID *string
	if visibility == VisibilityShared {
		if householdID == "" {
			return ResponseDTO{}, ErrMissingHouseholdID
		}
		scopedHouseholdID = &householdID
	}

	encryptedKey, err := s.encryptAPIKey(req.APIKey)
	if err != nil {
		return ResponseDTO{}, err
	}

	baseURL := req.BaseURL
	if req.ProviderType == llm.ProviderTypeOllama || req.ProviderType == "ollama" {
		if baseURL == nil || strings.TrimSpace(*baseURL) == "" {
			defaultURL := llm.DefaultOllamaBaseURL
			baseURL = &defaultURL
		} else {
			normalized := llm.NormalizeOllamaBaseURL(*baseURL)
			baseURL = &normalized
		}
	}
	if err := s.validateBaseURL(ctx, baseURL); err != nil {
		return ResponseDTO{}, err
	}

	m := &ModelBlock{
		ID:              uuid.NewString(),
		OwnerUserID:     userID,
		HouseholdID:     scopedHouseholdID,
		Visibility:      visibility,
		ProviderType:    req.ProviderType,
		DisplayName:     req.DisplayName,
		BaseURL:         baseURL,
		ModelIdentifier: req.ModelIdentifier,
		APIKeyEncrypted: encryptedKey,
		APIKeyKeyID:     s.encryptionKeyID,
		ConfigJSON:      normalizeConfigJSON(req.ConfigJSON),
		HealthStatus:    HealthStatusUnknown,
	}

	if err := s.repo.Create(ctx, m); err != nil {
		return ResponseDTO{}, err
	}

	s.log.Info("created model block", slog.String("id", m.ID), slog.String("owner_user_id", userID), slog.String("provider_type", m.ProviderType))
	return ToResponse(m, userID), nil
}

func (s *service) Delete(ctx context.Context, userID, id string) error {
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if m.IsBootstrap {
		return ErrBootstrapReadOnly
	}
	if !m.CanModify(userID) {
		return ErrForbidden
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.log.Info("deleted model block", slog.String("id", id), slog.String("actor_user_id", userID))
	return nil
}

// encryptAPIKey encrypts a plaintext API key if provided. A nil or empty apiKey
// yields a nil ciphertext (no key stored) without error.
func (s *service) encryptAPIKey(apiKey *string) ([]byte, error) {
	if apiKey == nil || *apiKey == "" {
		return nil, nil
	}
	if len(s.encryptionKey) == 0 {
		return nil, ErrEncryptionKeyMissing
	}
	ciphertext, err := crypto.Encrypt(s.encryptionKey, *apiKey)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt api key: %w", err)
	}
	return ciphertext, nil
}

func normalizeConfigJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage("{}")
	}
	return raw
}
func nonEmptyPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
