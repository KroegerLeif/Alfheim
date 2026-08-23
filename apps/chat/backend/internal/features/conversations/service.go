package conversations

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	"alfheim/chat/internal/shared/llm"
)

// ModelBlockResolver is the subset of modelblocks.Service this package depends on,
// defined here (the consumer) rather than in the modelblocks package, per this
// monorepo's Go conventions. modelblocks.Service satisfies this interface structurally.
type ModelBlockResolver interface {
	ResolveProvider(ctx context.Context, userID, householdID, modelBlockID string) (llm.Provider, llm.ProviderPolicy, error)
}

// Service defines domain logic for conversations, messages, and streamed assistant replies.
type Service interface {
	ListConversations(ctx context.Context, userID string) ([]ConversationResponseDTO, error)
	CreateConversation(ctx context.Context, userID, householdID string, req CreateConversationRequest) (ConversationResponseDTO, error)
	DeleteConversation(ctx context.Context, userID, id string) error

	ListMessages(ctx context.Context, userID, conversationID string) ([]MessageResponseDTO, error)
	PostMessage(ctx context.Context, userID, conversationID string, req CreateMessageRequest) (MessageResponseDTO, error)

	// StreamAssistantReply verifies ownership, resolves the conversation's model
	// block into a live llm.Provider, and starts streaming a reply to the
	// conversation's last (pending) user message — running as many tool-calling
	// rounds as the model requests, up to the model block's tool_round_limit. The
	// returned channel is closed once the stream ends; the caller (the SSE handler)
	// is expected to forward every chunk to the client as it arrives.
	StreamAssistantReply(ctx context.Context, userID, householdID, conversationID string) (<-chan llm.StreamChunk, error)
}

type service struct {
	repo        Repository
	modelBlocks ModelBlockResolver
	mcpServers  MCPServerLister
	mcpPool     MCPClientPool
	log         *slog.Logger
}

// NewService creates a conversations service instance.
func NewService(repo Repository, modelBlocks ModelBlockResolver, mcpServers MCPServerLister, mcpPool MCPClientPool, log *slog.Logger) Service {
	return &service{repo: repo, modelBlocks: modelBlocks, mcpServers: mcpServers, mcpPool: mcpPool, log: log}
}

func (s *service) ListConversations(ctx context.Context, userID string) ([]ConversationResponseDTO, error) {
	convos, err := s.repo.ListConversationsByOwner(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]ConversationResponseDTO, 0, len(convos))
	for _, c := range convos {
		out = append(out, ToConversationResponse(c))
	}
	return out, nil
}

func (s *service) CreateConversation(ctx context.Context, userID, householdID string, req CreateConversationRequest) (ConversationResponseDTO, error) {
	if req.ModelBlockID == nil || *req.ModelBlockID == "" {
		return ConversationResponseDTO{}, ErrModelBlockRequired
	}

	c := &Conversation{
		ID:            uuid.NewString(),
		OwnerUserID:   userID,
		SourceApp:     req.SourceApp,
		SourceContext: req.SourceContext,
		ModelBlockID:  req.ModelBlockID,
		Title:         req.Title,
	}
	if householdID != "" {
		c.HouseholdID = &householdID
	}

	if err := s.repo.CreateConversation(ctx, c); err != nil {
		return ConversationResponseDTO{}, err
	}

	s.log.Info("created conversation", slog.String("id", c.ID), slog.String("owner_user_id", userID), slog.String("source_app", derefOrEmpty(c.SourceApp)))
	return ToConversationResponse(c), nil
}

func (s *service) DeleteConversation(ctx context.Context, userID, id string) error {
	c, err := s.repo.GetConversationByID(ctx, id)
	if err != nil {
		return err
	}
	if !c.IsOwnedBy(userID) {
		return ErrForbidden
	}
	if err := s.repo.DeleteConversation(ctx, id); err != nil {
		return err
	}
	s.log.Info("deleted conversation", slog.String("id", id), slog.String("owner_user_id", userID))
	return nil
}

func (s *service) ListMessages(ctx context.Context, userID, conversationID string) ([]MessageResponseDTO, error) {
	c, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if !c.IsOwnedBy(userID) {
		return nil, ErrForbidden
	}

	messages, err := s.repo.ListMessages(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	out := make([]MessageResponseDTO, 0, len(messages))
	for _, m := range messages {
		out = append(out, ToMessageResponse(m))
	}
	return out, nil
}

func (s *service) PostMessage(ctx context.Context, userID, conversationID string, req CreateMessageRequest) (MessageResponseDTO, error) {
	if req.Content == "" && len(req.AttachmentIDs) == 0 {
		return MessageResponseDTO{}, ErrEmptyMessageContent
	}

	c, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return MessageResponseDTO{}, err
	}
	if !c.IsOwnedBy(userID) {
		return MessageResponseDTO{}, ErrForbidden
	}

	m := &Message{
		ID:             uuid.NewString(),
		ConversationID: conversationID,
		Role:           RoleUser,
		Content:        req.Content,
	}
	if err := s.repo.CreateMessage(ctx, m, req.AttachmentIDs...); err != nil {
		return MessageResponseDTO{}, err
	}

	// If attachments were linked, reload messages to include full attachment details
	if len(req.AttachmentIDs) > 0 {
		msgs, err := s.repo.ListMessages(ctx, conversationID)
		if err == nil {
			for _, item := range msgs {
				if item.ID == m.ID {
					return ToMessageResponse(item), nil
				}
			}
		}
	}

	return ToMessageResponse(m), nil
}

func (s *service) StreamAssistantReply(ctx context.Context, userID, householdID, conversationID string) (<-chan llm.StreamChunk, error) {
	c, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if !c.IsOwnedBy(userID) {
		return nil, ErrForbidden
	}
	if c.ModelBlockID == nil || *c.ModelBlockID == "" {
		return nil, ErrModelBlockRequired
	}

	history, err := s.repo.ListMessages(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if len(history) == 0 || history[len(history)-1].Role != RoleUser {
		return nil, ErrNoPendingUserMessage
	}

	provider, policy, err := s.modelBlocks.ResolveProvider(ctx, userID, householdID, *c.ModelBlockID)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrModelBlockUnavailable, err)
	}

	tools, toolServers := buildToolDefinitions(ctx, s.mcpServers, s.mcpPool, policy.AllowedMCPApps, s.log)
	messages := toLLMMessages(history)

	// The first round runs synchronously so a provider connection failure surfaces
	// as a normal JSON error response (headers not sent yet), matching the
	// single-round behavior before this phase; later rounds run inside the
	// goroutine, where errors must instead become SSE "error" events.
	firstRoundChunks, err := provider.ChatStream(ctx, llm.ChatRequest{Messages: messages, Tools: tools, Stream: true})
	if err != nil {
		return nil, err
	}

	roundLimit := policy.ToolRoundLimit
	if roundLimit <= 0 {
		roundLimit = 8
	}

	out := make(chan llm.StreamChunk)
	go s.runToolLoop(conversationID, provider, tools, toolServers, messages, firstRoundChunks, roundLimit, out)
	return out, nil
}

func toLLMMessages(messages []*Message) []llm.Message {
	out := make([]llm.Message, 0, len(messages))
	for _, m := range messages {
		msg := llm.Message{Role: llm.Role(m.Role), Content: m.Content}
		if m.Role == RoleAssistant && len(m.ToolCallsJSON) > 0 {
			_ = json.Unmarshal(m.ToolCallsJSON, &msg.ToolCalls) // best-effort; malformed history just loses replay context
		}
		out = append(out, msg)
	}
	return out
}

func derefOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
