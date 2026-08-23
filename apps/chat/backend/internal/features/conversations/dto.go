package conversations

import (
	"encoding/json"
	"time"
)

// CreateConversationRequest is the payload for POST /api/v1/chat/conversations.
type CreateConversationRequest struct {
	ModelBlockID  *string         `json:"model_block_id"`
	SourceApp     *string         `json:"source_app,omitempty"`
	SourceContext json.RawMessage `json:"source_context,omitempty"`
	Title         *string         `json:"title,omitempty"`
}

// ConversationResponseDTO is the JSON serialization contract for a conversation.
type ConversationResponseDTO struct {
	ID            string          `json:"id"`
	OwnerUserID   string          `json:"owner_user_id"`
	HouseholdID   *string         `json:"household_id,omitempty"`
	SourceApp     *string         `json:"source_app,omitempty"`
	SourceContext json.RawMessage `json:"source_context,omitempty"`
	ModelBlockID  *string         `json:"model_block_id,omitempty"`
	Title         *string         `json:"title,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// ToConversationResponse converts a Conversation domain entity to its response DTO.
func ToConversationResponse(c *Conversation) ConversationResponseDTO {
	return ConversationResponseDTO{
		ID:            c.ID,
		OwnerUserID:   c.OwnerUserID,
		HouseholdID:   c.HouseholdID,
		SourceApp:     c.SourceApp,
		SourceContext: c.SourceContext,
		ModelBlockID:  c.ModelBlockID,
		Title:         c.Title,
		CreatedAt:     c.CreatedAt,
		UpdatedAt:     c.UpdatedAt,
	}
}

// CreateMessageRequest is the payload for POST /api/v1/chat/conversations/{id}/messages.
type CreateMessageRequest struct {
	Content string `json:"content"`
}

// MessageResponseDTO is the JSON serialization contract for a message.
type MessageResponseDTO struct {
	ID             string          `json:"id"`
	ConversationID string          `json:"conversation_id"`
	Role           Role            `json:"role"`
	Content        string          `json:"content"`
	ToolCallsJSON  json.RawMessage `json:"tool_calls,omitempty"`
	TokenUsageJSON json.RawMessage `json:"token_usage,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

// ToMessageResponse converts a Message domain entity to its response DTO.
func ToMessageResponse(m *Message) MessageResponseDTO {
	return MessageResponseDTO{
		ID:             m.ID,
		ConversationID: m.ConversationID,
		Role:           m.Role,
		Content:        m.Content,
		ToolCallsJSON:  m.ToolCallsJSON,
		TokenUsageJSON: m.TokenUsageJSON,
		CreatedAt:      m.CreatedAt,
	}
}
