package llm

import (
	"fmt"
	"slices"
)

// Supported provider_type values for model blocks.
const (
	ProviderTypeOllama           = "ollama"
	ProviderTypeOpenAICompatible = "openai_compatible"
	ProviderTypeAnthropic        = "anthropic"
)

// SupportedProviderTypes lists the provider_type values NewProvider can build.
// Model blocks with any other provider type are rejected at creation (#632).
// OpenRouter and other OpenAI-compatible gateways use ProviderTypeOpenAICompatible.
var SupportedProviderTypes = []string{ProviderTypeOllama, ProviderTypeOpenAICompatible}

// IsSupportedProviderType reports whether NewProvider can build a provider for providerType.
func IsSupportedProviderType(providerType string) bool {
	return slices.Contains(SupportedProviderTypes, providerType)
}

// NewProvider constructs a Provider for the given provider type.
//
// It intentionally takes primitive parameters rather than a model block domain
// entity, so internal/shared/llm has no dependency on internal/features/modelblocks
// (features depend on shared, never the reverse).
func NewProvider(providerType, baseURL, model, apiKey string, opts ...ProviderOption) (Provider, error) {
	switch providerType {
	case ProviderTypeOllama:
		return NewOllamaProvider(baseURL, model, apiKey, opts...), nil
	case ProviderTypeOpenAICompatible:
		return NewOpenAICompatibleProvider(baseURL, model, apiKey, opts...), nil
	case ProviderTypeAnthropic:
		return nil, fmt.Errorf("provider type %q is not implemented yet (planned for a later phase)", providerType)
	default:
		return nil, fmt.Errorf("unknown provider type %q", providerType)
	}
}
