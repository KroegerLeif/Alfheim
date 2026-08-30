package conversations

import (
	"strings"
	"testing"

	"alfheim/chat/internal/shared/llm"
)

func TestGetAlfiSystemPrompt(t *testing.T) {
	prompt := GetAlfiSystemPrompt()
	if prompt == "" {
		t.Fatal("expected non-empty ALFI system prompt")
	}

	if !strings.Contains(prompt, "ALFI") {
		t.Errorf("expected prompt to mention ALFI, got: %s", prompt)
	}

	if !strings.Contains(prompt, "Melmac") {
		t.Errorf("expected prompt to include Melmac easter egg trait, got: %s", prompt)
	}

	if !strings.Contains(prompt, "German") || !strings.Contains(prompt, "English") {
		t.Errorf("expected prompt to specify multilingual i18n instructions, got: %s", prompt)
	}
}

func TestBuildLLMMessagesPrependsSystemPrompt(t *testing.T) {
	history := []*Message{
		{
			ID:      "msg-1",
			Role:    RoleUser,
			Content: "Hello ALFI!",
		},
	}

	llmMsgs := BuildLLMMessages(history)
	if len(llmMsgs) != 2 {
		t.Fatalf("expected 2 messages (system + user), got %d", len(llmMsgs))
	}

	if llmMsgs[0].Role != llm.RoleSystem {
		t.Errorf("expected first message to be RoleSystem, got %s", llmMsgs[0].Role)
	}
	if !strings.Contains(llmMsgs[0].Content, "ALFI") {
		t.Errorf("expected first message to have ALFI persona prompt, got: %s", llmMsgs[0].Content)
	}

	if llmMsgs[1].Role != llm.RoleUser || llmMsgs[1].Content != "Hello ALFI!" {
		t.Errorf("expected second message to be user message, got %+v", llmMsgs[1])
	}
}

func TestBuildLLMMessagesPreservesExistingSystemPrompt(t *testing.T) {
	history := []*Message{
		{
			ID:      "msg-0",
			Role:    RoleSystem,
			Content: "Custom system instructions",
		},
		{
			ID:      "msg-1",
			Role:    RoleUser,
			Content: "Hello ALFI!",
		},
	}

	llmMsgs := BuildLLMMessages(history)
	if len(llmMsgs) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(llmMsgs))
	}

	if llmMsgs[0].Content != "Custom system instructions" {
		t.Errorf("expected existing system prompt to be preserved, got %s", llmMsgs[0].Content)
	}
}
