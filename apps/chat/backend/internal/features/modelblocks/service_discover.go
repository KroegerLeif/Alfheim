package modelblocks

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"alfheim/chat/internal/shared/llm"
)

// maxDiscoverResponseBytes bounds the model list read from a discovery endpoint.
const maxDiscoverResponseBytes = 1 << 20

func (s *service) DiscoverModels(ctx context.Context, req DiscoverRequest) (DiscoverResponse, error) {
	providerType := req.ProviderType
	if providerType == "" {
		providerType = llm.ProviderTypeOllama
	}
	if providerType != llm.ProviderTypeOllama {
		return DiscoverResponse{Models: []string{}}, ErrDiscoveryUnsupported
	}

	baseURL := llm.DefaultOllamaBaseURL
	if req.BaseURL != nil && strings.TrimSpace(*req.BaseURL) != "" {
		baseURL = strings.TrimSpace(*req.BaseURL)
	}
	baseURL = strings.TrimRight(baseURL, "/")
	if err := s.validateBaseURL(ctx, &baseURL); err != nil {
		return DiscoverResponse{Models: []string{}}, err
	}

	models, err := s.fetchOllamaModels(ctx, baseURL, req.APIKey)
	if err != nil {
		s.log.Warn("failed to discover ollama models", slog.String("base_url", baseURL), slog.String("error", err.Error()))
		return DiscoverResponse{Models: []string{}}, ErrDiscoveryFailed
	}
	return DiscoverResponse{Models: models}, nil
}

// fetchOllamaModels lists models via /api/tags. It uses the guarded client, so the
// destination is re-checked at dial time and redirects are never followed. Errors may
// contain upstream details and must only be logged, never returned to clients.
func (s *service) fetchOllamaModels(ctx context.Context, baseURL string, apiKey *string) ([]string, error) {
	checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(checkCtx, http.MethodGet, baseURL+"/api/tags", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to construct discover request: %w", err)
	}
	if apiKey != nil && *apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+*apiKey)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to connect: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("/api/tags returned status %d", resp.StatusCode)
	}

	var tags struct {
		Models []struct {
			Name  string `json:"name"`
			Model string `json:"model"`
		} `json:"models"`
	}

	if err := json.NewDecoder(io.LimitReader(resp.Body, maxDiscoverResponseBytes)).Decode(&tags); err != nil {
		return nil, fmt.Errorf("failed to parse tags response: %w", err)
	}

	result := make([]string, 0, len(tags.Models))
	for _, m := range tags.Models {
		name := m.Name
		if name == "" {
			name = m.Model
		}
		if name != "" {
			result = append(result, name)
		}
	}
	return result, nil
}
