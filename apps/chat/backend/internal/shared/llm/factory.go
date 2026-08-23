package llm

import "fmt"

// Supported provider_type values for model blocks.
const (
	ProviderTypeOllama           = "ollama"
	ProviderTypeOpenAICompatible = "openai_compatible"
	ProviderTypeAnthropic        = "anthropic"
)

// NewProvider constructs a Provider for the given provider type.
//
// It intentionally takes primitive parameters rather than a model block domain
// entity, so internal/shared/llm has no dependency on internal/features/modelblocks
// (features depend on shared, never the reverse).
func NewProvider(providerType, baseURL, model, apiKey string) (Provider, error) {
	switch providerType {
	case ProviderTypeOllama:
		return NewOllamaProvider(baseURL, model, apiKey), nil
	case ProviderTypeOpenAICompatible:
		return nil, fmt.Errorf("provider type %q is not implemented yet (planned for a later phase)", providerType)
	case ProviderTypeAnthropic:
		return nil, fmt.Errorf("provider type %q is not implemented yet (planned for a later phase)", providerType)
	default:
		return nil, fmt.Errorf("unknown provider type %q", providerType)
	}
}
