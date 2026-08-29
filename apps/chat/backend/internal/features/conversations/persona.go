package conversations

import (
	_ "embed"
	"strings"

	"alfheim/chat/internal/shared/llm"
)

//go:embed prompts/alfi_system.md
var embeddedAlfiPrompt string

// GetAlfiSystemPrompt returns the canonical system prompt defining the ALFI persona,
// traits, smart-home domain rules, and multilingual i18n instructions.
func GetAlfiSystemPrompt() string {
	trimmed := strings.TrimSpace(embeddedAlfiPrompt)
	if trimmed != "" {
		return trimmed
	}
	return "You are ALFI, the intelligent and witty smart-home assistant for Alfheim. Answer helpfully and directly in the language of the user."
}

// BuildLLMMessages converts database conversation messages to provider-ready llm.Message items,
// ensuring the ALFI persona system prompt is prepended if the conversation history does not
// already contain an explicit system prompt.
func BuildLLMMessages(messages []*Message) []llm.Message {
	hasSystemPrompt := false
	for _, m := range messages {
		if m.Role == RoleSystem {
			hasSystemPrompt = true
			break
		}
	}

	capacity := len(messages)
	if !hasSystemPrompt {
		capacity++
	}

	out := make([]llm.Message, 0, capacity)
	if !hasSystemPrompt {
		out = append(out, llm.Message{
			Role:    llm.RoleSystem,
			Content: GetAlfiSystemPrompt(),
		})
	}

	for _, m := range toLLMMessages(messages) {
		out = append(out, m)
	}

	return out
}
