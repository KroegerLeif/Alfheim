package modelblocks

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"alfheim/chat/internal/shared/crypto"
	"alfheim/chat/internal/shared/llm"
)

// bootstrapStateKey identifies the one-time ENV-seeded bootstrap model block in the
// bootstrap_state tracking table. Bumping this would allow re-seeding under a new
// key; the current value must not change without a matching migration/data plan.
const bootstrapStateKey = "model_block_bootstrap_v1"

// bootstrapOwnerUserID marks a model block as system-seeded rather than personally
// owned. See ModelBlock.CanModify for how this interacts with edit permissions.
const bootstrapOwnerUserID = "system"

// BootstrapSeed carries the ENV-configured fallback model, decoupled from the
// application-wide config.Config type so this feature package has no dependency on it.
type BootstrapSeed struct {
	Provider      string
	OllamaBaseURL string
	OllamaModel   string
	APIKey        string
}

// Service defines domain logic for model block management.
type Service interface {
	List(ctx context.Context, userID, householdID string) ([]ResponseDTO, error)
	Create(ctx context.Context, userID, householdID string, req CreateRequest) (ResponseDTO, error)
	Update(ctx context.Context, userID, householdID, id string, req UpdateRequest) (ResponseDTO, error)
	Delete(ctx context.Context, userID, id string) error
	TriggerHealthCheck(ctx context.Context, userID, id string) (ResponseDTO, error)
	// EnsureBootstrap seeds the ENV-configured fallback model block exactly once,
	// on the very first successful call; subsequent calls (e.g. on every restart)
	// are no-ops even if the seeded block was since edited or deleted by a user.
	EnsureBootstrap(ctx context.Context, seed BootstrapSeed) error
	// ResolveProvider loads a model block, checks the caller may use it (owner, or a
	// shared block within the caller's household), decrypts its API key if any, and
	// constructs a ready-to-use llm.Provider. Unlike TriggerHealthCheck/Update/Delete,
	// this uses the broader "usable" visibility rule, not the owner-only edit rule,
	// since household members are allowed to chat with shared model blocks.
	ResolveProvider(ctx context.Context, userID, householdID, id string) (llm.Provider, error)
}

type service struct {
	repo            Repository
	encryptionKey   []byte
	encryptionKeyID string
	log             *slog.Logger
}

// NewService creates a model block service instance. encryptionKey may be nil/empty
// if CHAT_ENCRYPTION_KEY is not configured; attempting to store an API key in that
// case fails with ErrEncryptionKeyMissing rather than silently storing plaintext.
func NewService(repo Repository, encryptionKey []byte, encryptionKeyID string, log *slog.Logger) Service {
	return &service{
		repo:            repo,
		encryptionKey:   encryptionKey,
		encryptionKeyID: encryptionKeyID,
		log:             log,
	}
}

func (s *service) List(ctx context.Context, userID, householdID string) ([]ResponseDTO, error) {
	blocks, err := s.repo.ListVisibleTo(ctx, userID, householdID)
	if err != nil {
		return nil, err
	}

	out := make([]ResponseDTO, 0, len(blocks))
	for _, m := range blocks {
		out = append(out, ToResponse(m, userID))
	}
	return out, nil
}

func (s *service) Create(ctx context.Context, userID, householdID string, req CreateRequest) (ResponseDTO, error) {
	if req.ProviderType == "" {
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

	m := &ModelBlock{
		ID:              uuid.NewString(),
		OwnerUserID:     userID,
		HouseholdID:     scopedHouseholdID,
		Visibility:      visibility,
		ProviderType:    req.ProviderType,
		DisplayName:     req.DisplayName,
		BaseURL:         req.BaseURL,
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

func (s *service) Update(ctx context.Context, userID, householdID, id string, req UpdateRequest) (ResponseDTO, error) {
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ResponseDTO{}, err
	}
	if !m.CanModify(userID) {
		return ResponseDTO{}, ErrForbidden
	}

	if req.DisplayName != nil {
		m.DisplayName = *req.DisplayName
	}
	if req.BaseURL != nil {
		m.BaseURL = req.BaseURL
	}
	if req.ModelIdentifier != nil {
		m.ModelIdentifier = *req.ModelIdentifier
	}
	if req.ConfigJSON != nil {
		m.ConfigJSON = normalizeConfigJSON(req.ConfigJSON)
	}

	if req.Visibility != nil {
		switch *req.Visibility {
		case VisibilityPrivate:
			m.Visibility = VisibilityPrivate
			m.HouseholdID = nil
		case VisibilityShared:
			if householdID == "" {
				return ResponseDTO{}, ErrMissingHouseholdID
			}
			m.Visibility = VisibilityShared
			m.HouseholdID = &householdID
		default:
			return ResponseDTO{}, ErrInvalidVisibility
		}
	}

	switch {
	case req.APIKey != nil && *req.APIKey != "":
		encryptedKey, err := s.encryptAPIKey(req.APIKey)
		if err != nil {
			return ResponseDTO{}, err
		}
		m.APIKeyEncrypted = encryptedKey
		m.APIKeyKeyID = s.encryptionKeyID
	case req.ClearAPIKey:
		m.APIKeyEncrypted = nil
	}

	if err := s.repo.Update(ctx, m); err != nil {
		return ResponseDTO{}, err
	}

	s.log.Info("updated model block", slog.String("id", m.ID), slog.String("actor_user_id", userID))
	return ToResponse(m, userID), nil
}

func (s *service) Delete(ctx context.Context, userID, id string) error {
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
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

func (s *service) TriggerHealthCheck(ctx context.Context, userID, id string) (ResponseDTO, error) {
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ResponseDTO{}, err
	}
	if !m.CanModify(userID) {
		return ResponseDTO{}, ErrForbidden
	}

	result := s.runProviderHealthCheck(ctx, m)

	checkedAt := time.Now()
	var detail *string
	if result.Detail != "" {
		detail = &result.Detail
	}

	status := HealthStatus(result.Status)
	if err := s.repo.UpdateHealth(ctx, id, status, detail, checkedAt); err != nil {
		return ResponseDTO{}, err
	}

	m.HealthStatus = status
	m.HealthDetail = detail
	m.HealthCheckedAt = &checkedAt

	s.log.Info("model block health check completed", slog.String("id", id), slog.String("status", string(status)))
	return ToResponse(m, userID), nil
}

// decryptAPIKey decrypts the stored API key, if any. A model block with no stored
// key returns an empty string and no error.
func (s *service) decryptAPIKey(m *ModelBlock) (string, error) {
	if len(m.APIKeyEncrypted) == 0 {
		return "", nil
	}
	if len(s.encryptionKey) == 0 {
		return "", ErrEncryptionKeyMissing
	}
	decrypted, err := crypto.Decrypt(s.encryptionKey, m.APIKeyEncrypted)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt stored api key: %w", err)
	}
	return decrypted, nil
}

// buildProvider decrypts m's API key and constructs its configured llm.Provider.
func (s *service) buildProvider(m *ModelBlock) (llm.Provider, error) {
	apiKey, err := s.decryptAPIKey(m)
	if err != nil {
		return nil, err
	}

	baseURL := ""
	if m.BaseURL != nil {
		baseURL = *m.BaseURL
	}

	return llm.NewProvider(m.ProviderType, baseURL, m.ModelIdentifier, apiKey)
}

// runProviderHealthCheck delegates to the configured llm.Provider. Decryption or
// provider construction failures are surfaced as an "unknown" health result rather
// than an API error, since they are a real, displayable health signal about this
// specific model block's configuration.
func (s *service) runProviderHealthCheck(ctx context.Context, m *ModelBlock) llm.HealthResult {
	provider, err := s.buildProvider(m)
	if err != nil {
		return llm.HealthResult{Status: llm.HealthStatusUnknown, Detail: err.Error()}
	}
	return provider.HealthCheck(ctx)
}

func (s *service) ResolveProvider(ctx context.Context, userID, householdID, id string) (llm.Provider, error) {
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !m.IsVisibleTo(userID, householdID) {
		return nil, ErrForbidden
	}
	return s.buildProvider(m)
}

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
