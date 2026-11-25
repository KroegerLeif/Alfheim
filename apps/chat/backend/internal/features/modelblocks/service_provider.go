package modelblocks

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"alfheim/chat/internal/shared/llm"
	"alfheim/go-shared/crypto"
)

func (s *service) TriggerHealthCheck(ctx context.Context, userID, householdID, id string) (ResponseDTO, error) {
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ResponseDTO{}, err
	}
	if !m.IsVisibleTo(userID, householdID) {
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
	if (m.ProviderType == llm.ProviderTypeOllama || m.ProviderType == "ollama") && strings.TrimSpace(baseURL) == "" {
		baseURL = llm.DefaultOllamaBaseURL
	}

	return llm.NewProvider(m.ProviderType, baseURL, m.ModelIdentifier, apiKey, llm.WithHTTPClient(s.httpClient))
}

// runProviderHealthCheck delegates to the configured llm.Provider. Decryption or
// provider construction failures are surfaced as an "unknown" health result rather
// than an API error, since they are a real, displayable health signal about this
// specific model block's configuration.
func (s *service) runProviderHealthCheck(ctx context.Context, m *ModelBlock) llm.HealthResult {
	provider, err := s.buildProvider(m)
	if err != nil {
		s.log.Warn("failed to build provider for health check", slog.String("id", m.ID), slog.String("error", err.Error()))
		return llm.HealthResult{Status: llm.HealthStatusUnknown, Detail: "model block configuration could not be loaded"}
	}
	return provider.HealthCheck(ctx)
}

func (s *service) ResolveProvider(ctx context.Context, userID, householdID, id string) (llm.Provider, llm.ProviderPolicy, error) {
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, llm.ProviderPolicy{}, err
	}
	if !m.IsVisibleTo(userID, householdID) {
		return nil, llm.ProviderPolicy{}, ErrForbidden
	}

	provider, err := s.buildProvider(m)
	if err != nil {
		return nil, llm.ProviderPolicy{}, err
	}

	return provider, parseProviderPolicy(m.ConfigJSON), nil
}

// parseProviderPolicy reads the optional "tool_round_limit" (number) and
// "allowed_mcp_apps" (string array) fields from a model block's config_json,
// falling back to sane defaults for any field that is absent or malformed.
func parseProviderPolicy(configJSON json.RawMessage) llm.ProviderPolicy {
	policy := llm.ProviderPolicy{ToolRoundLimit: defaultToolRoundLimit}

	var parsed struct {
		ToolRoundLimit *int     `json:"tool_round_limit"`
		AllowedMCPApps []string `json:"allowed_mcp_apps"`
	}
	if len(configJSON) == 0 {
		return policy
	}
	if err := json.Unmarshal(configJSON, &parsed); err != nil {
		return policy
	}

	if parsed.ToolRoundLimit != nil && *parsed.ToolRoundLimit > 0 {
		policy.ToolRoundLimit = *parsed.ToolRoundLimit
	}
	policy.AllowedMCPApps = parsed.AllowedMCPApps
	return policy
}
