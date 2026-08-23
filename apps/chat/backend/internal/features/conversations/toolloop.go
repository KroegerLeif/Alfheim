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
