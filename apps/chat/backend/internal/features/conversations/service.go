package conversations

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"alfheim/chat/internal/shared/llm"
)

// ModelBlockResolver is the subset of modelblocks.Service this package depends on,
// defined here (the consumer) rather than in the modelblocks package, per this
// monorepo's Go conventions. modelblocks.Service satisfies this interface structurally.
type ModelBlockResolver interface {
	ResolveProvider(ctx context.Context, userID, householdID, modelBlockID string) (llm.Provider, error)
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
	// conversation's last (pending) user message. The returned channel is closed
	// once the stream ends; the caller (the SSE handler) is expected to forward
	// every chunk to the client as it arrives.
	StreamAssistantReply(ctx context.Context, userID, householdID, conversationID string) (<-chan llm.StreamChunk, error)
}

type service struct {
	repo        Repository
	modelBlocks ModelBlockResolver
	log         *slog.Logger
}

// NewService creates a conversations service instance.
func NewService(repo Repository, modelBlocks ModelBlockResolver, log *slog.Logger) Service {
	return &service{repo: repo, modelBlocks: modelBlocks, log: log}
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
	if req.Content == "" {
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
	if err := s.repo.CreateMessage(ctx, m); err != nil {
		return MessageResponseDTO{}, err
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

	provider, err := s.modelBlocks.ResolveProvider(ctx, userID, householdID, *c.ModelBlockID)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrModelBlockUnavailable, err)
	}

	providerChunks, err := provider.ChatStream(ctx, llm.ChatRequest{
		Messages: toLLMMessages(history),
		Stream:   true,
	})
	if err != nil {
		return nil, err
	}

	out := make(chan llm.StreamChunk)
	go s.relayAndPersist(conversationID, providerChunks, out)
	return out, nil
}

// relayAndPersist forwards every chunk from the provider to out as it arrives, then
// persists the fully assembled assistant reply once the stream completes. It
// deliberately uses a fresh, request-independent context for the final DB write so a
// canceled HTTP request context (e.g. the client closing the connection right as the
// stream finishes) cannot cause a completed reply to be silently lost.
func (s *service) relayAndPersist(conversationID string, providerChunks <-chan llm.StreamChunk, out chan<- llm.StreamChunk) {
	defer close(out)

	var text strings.Builder
	var usage *llm.Usage
	var streamErr error

	for chunk := range providerChunks {
		out <- chunk
		if chunk.DeltaText != "" {
			text.WriteString(chunk.DeltaText)
		}
		if chunk.Usage != nil {
			usage = chunk.Usage
		}
		if chunk.Err != nil {
			streamErr = chunk.Err
		}
	}

	if streamErr != nil {
		s.log.Warn("assistant stream ended with an error; not persisting a partial reply",
			slog.String("conversation_id", conversationID), slog.String("error", streamErr.Error()))
		return
	}

	content := text.String()
	if content == "" {
		// A tool-call-only turn (no assistant text yet): nothing to persist here.
		// Executing tool calls and continuing the conversation lands with the MCP bridge.
		return
	}

	persistCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var tokenUsageJSON json.RawMessage
	if usage != nil {
		if raw, err := json.Marshal(usage); err == nil {
			tokenUsageJSON = raw
		}
	}

	msg := &Message{
		ID:             uuid.NewString(),
		ConversationID: conversationID,
		Role:           RoleAssistant,
		Content:        content,
		TokenUsageJSON: tokenUsageJSON,
	}

	if err := s.repo.AppendMessageAndTouchConversation(persistCtx, msg); err != nil {
		s.log.Error("failed to persist assistant reply", slog.String("conversation_id", conversationID), slog.String("error", err.Error()))
	}
}

func toLLMMessages(messages []*Message) []llm.Message {
	out := make([]llm.Message, 0, len(messages))
	for _, m := range messages {
		out = append(out, llm.Message{Role: llm.Role(m.Role), Content: m.Content})
	}
	return out
}

func derefOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
