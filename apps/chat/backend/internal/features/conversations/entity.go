// Package conversations manages chat conversations and their messages, including the
// SSE-streamed assistant reply generated from the conversation's configured model block.
package conversations

import (
	"encoding/json"
	"time"
)

// Conversation is a single chat thread, either opened from the full chat app
// (SourceApp == nil) or embedded in another Fach-App via the chat widget.
type Conversation struct {
	ID          string
	OwnerUserID string
	HouseholdID *string
	// SourceApp identifies the host app the conversation was opened from (e.g. "pantry"),
	// nil when started from the standalone chat app.
	SourceApp *string
	// SourceContext is host-supplied context (entity type/id, etc.), passed through to
	// the model as-is; opaque to this package.
	SourceContext json.RawMessage
	ModelBlockID  *string
	Title         *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// IsOwnedBy reports whether userID owns this conversation. Conversations are always
// personal (unlike model blocks, there is no household-shared visibility).
func (c *Conversation) IsOwnedBy(userID string) bool {
	return c.OwnerUserID == userID
}

// Role identifies the author of a Message, mirroring llm.Role.
type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleSystem    Role = "system"
	RoleTool      Role = "tool"
)

// MessageAttachment carries metadata for an image attached to a chat message.
type MessageAttachment struct {
	ID         string
	MessageID  *string
	StorageKey string
	MimeType   string
	SizeBytes  int64
	URL        string
	CreatedAt  time.Time
}

// Message is a single turn within a Conversation.
type Message struct {
	ID             string
	ConversationID string
	Role           Role
	Content        string
	Attachments    []MessageAttachment
	// ToolCallsJSON records tool call requests/results for this turn (audit & replay);
	// populated starting with the MCP bridge in a later phase.
	ToolCallsJSON  json.RawMessage
	MCPServerID    *string
	TokenUsageJSON json.RawMessage
	CreatedAt      time.Time
}
