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
	"alfheim/chat/internal/shared/mcp"
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

// runToolLoop drives the multi-turn tool-calling loop for a single assistant reply:
//  1. drain the current round's provider stream, forwarding text/tool_call chunks live;
//  2. if the model made no tool calls, persist the final text reply and emit a
//     terminal Done chunk, ending the SSE response;
//  3. otherwise execute each requested tool call against its MCP server, persist the
//     assistant's tool-call turn and each tool result, append them to the in-memory
//     message history, and start another round — up to roundLimit rounds total.
//
// Only the very last round's Done/Err chunk is forwarded verbatim to the client;
// intermediate rounds' per-round completion is not forwarded, since it does not mean
// the overall assistant turn (and the SSE response) is finished yet.
func (s *service) runToolLoop(
	conversationID string,
	provider llm.Provider,
	tools []llm.ToolDefinition,
	toolServers map[string]mcp.ServerRef,
	messages []llm.Message,
	firstRoundChunks <-chan llm.StreamChunk,
	roundLimit int,
	out chan<- llm.StreamChunk,
) {
	defer close(out)

	currentRoundChunks := firstRoundChunks

	for round := 1; round <= roundLimit; round++ {
		var text strings.Builder
		var toolCalls []llm.ToolCallRequest
		var usage *llm.Usage

		for chunk := range currentRoundChunks {
			if chunk.Err != nil {
				out <- chunk
				return
			}
			if chunk.ToolCall != nil {
				out <- chunk
				toolCalls = append(toolCalls, *chunk.ToolCall)
			}
			if chunk.DeltaText != "" {
				out <- chunk
				text.WriteString(chunk.DeltaText)
			}
			if chunk.Usage != nil {
				usage = chunk.Usage
			}
			// chunk.Done from an individual round is intentionally not forwarded: it
			// only means this round's generation finished, not the whole SSE turn.
		}

		if len(toolCalls) == 0 {
			s.finishTurn(conversationID, text.String(), usage, out)
			return
		}

		s.persistToolRound(conversationID, text.String(), toolCalls)

		assistantMsg := llm.Message{Role: llm.RoleAssistant, Content: text.String(), ToolCalls: toolCalls}
		messages = append(messages, assistantMsg)

		for _, call := range toolCalls {
			resultText := s.executeToolCall(conversationID, call, toolServers)
			messages = append(messages, llm.Message{Role: llm.RoleTool, Content: resultText, ToolCallID: call.ID})
		}

		if round == roundLimit {
			break
		}

		nextChunks, err := provider.ChatStream(context.Background(), llm.ChatRequest{Messages: messages, Tools: tools, Stream: true})
		if err != nil {
			out <- llm.StreamChunk{Done: true, Err: fmt.Errorf("failed to continue tool-calling round: %w", err)}
			return
		}
		currentRoundChunks = nextChunks
	}

	out <- llm.StreamChunk{Done: true, Err: fmt.Errorf("tool round limit (%d) exceeded without a final answer", roundLimit)}
}

// executeToolCall dispatches a single tool call to its MCP server and returns the
// result text fed back to the model. Any failure (unknown tool, transport error, or
// the tool itself reporting isError) becomes readable error text rather than
// aborting the loop, so the model can react to it instead of the whole turn crashing.
func (s *service) executeToolCall(conversationID string, call llm.ToolCallRequest, toolServers map[string]mcp.ServerRef) string {
	server, ok := toolServers[call.ToolName]
	if !ok {
		return fmt.Sprintf("tool error: unknown tool %q", call.ToolName)
	}

	client := s.mcpPool.Get(server.EndpointURL)
	resultText, isError, err := client.CallTool(context.Background(), call.ToolName, call.Arguments)
	if err != nil {
		s.log.Warn("mcp tool call failed", slog.String("tool_name", call.ToolName), slog.String("app_slug", server.Slug), slog.String("error", err.Error()))
		return fmt.Sprintf("tool error: %v", err)
	}
	if isError {
		s.log.Debug("mcp tool call reported an error result", slog.String("tool_name", call.ToolName), slog.String("app_slug", server.Slug))
	}

	serverID := server.ID
	msg := &Message{
		ID:             uuid.NewString(),
		ConversationID: conversationID,
		Role:           RoleTool,
		Content:        resultText,
		MCPServerID:    &serverID,
	}
	if err := s.repo.CreateMessage(context.Background(), msg); err != nil {
		s.log.Error("failed to persist tool result message", slog.String("conversation_id", conversationID), slog.String("error", err.Error()))
	}

	return resultText
}

// persistToolRound stores the assistant's tool-call request turn (the text, if any,
// plus the structured tool calls for audit/replay) as its own message.
func (s *service) persistToolRound(conversationID, content string, toolCalls []llm.ToolCallRequest) {
	toolCallsJSON, err := json.Marshal(toolCalls)
	if err != nil {
		s.log.Error("failed to marshal tool calls for persistence", slog.String("conversation_id", conversationID), slog.String("error", err.Error()))
		toolCallsJSON = nil
	}

	msg := &Message{
		ID:             uuid.NewString(),
		ConversationID: conversationID,
		Role:           RoleAssistant,
		Content:        content,
		ToolCallsJSON:  toolCallsJSON,
	}
	if err := s.repo.CreateMessage(context.Background(), msg); err != nil {
		s.log.Error("failed to persist assistant tool-call message", slog.String("conversation_id", conversationID), slog.String("error", err.Error()))
	}
}

// finishTurn persists the final assistant text reply (transactionally bumping the
// conversation's updated_at) and emits the terminal Done chunk that ends the SSE
// response. It deliberately uses a fresh, request-independent context for the DB
// write so a canceled HTTP request context (e.g. the client closing the connection
// right as the stream finishes) cannot cause a completed reply to be silently lost.
func (s *service) finishTurn(conversationID, content string, usage *llm.Usage, out chan<- llm.StreamChunk) {
	if content != "" {
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

	out <- llm.StreamChunk{Done: true, Usage: usage}
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
