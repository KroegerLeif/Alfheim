package conversations_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"alfheim/chat/internal/features/conversations"
	"alfheim/chat/internal/shared/llm"
	"alfheim/chat/internal/shared/mcp"
)

// fakeRepository is an in-memory Repository double for unit-testing the service
// layer without a real Postgres instance.
type fakeRepository struct {
	convos   map[string]*conversations.Conversation
	messages map[string][]*conversations.Message
}

func newFakeRepository() *fakeRepository {
	return &fakeRepository{
		convos:   make(map[string]*conversations.Conversation),
		messages: make(map[string][]*conversations.Message),
	}
}

func (f *fakeRepository) CreateConversation(ctx context.Context, c *conversations.Conversation) error {
	now := time.Now()
	c.CreatedAt = now
	c.UpdatedAt = now
	f.convos[c.ID] = c
	return nil
}

func (f *fakeRepository) GetConversationByID(ctx context.Context, id string) (*conversations.Conversation, error) {
	c, ok := f.convos[id]
	if !ok {
		return nil, conversations.ErrNotFound
	}
	return c, nil
}

func (f *fakeRepository) ListConversationsByOwner(ctx context.Context, ownerUserID string) ([]*conversations.Conversation, error) {
	var out []*conversations.Conversation
	for _, c := range f.convos {
		if c.OwnerUserID == ownerUserID {
			out = append(out, c)
		}
	}
	return out, nil
}

func (f *fakeRepository) DeleteConversation(ctx context.Context, id string) error {
	if _, ok := f.convos[id]; !ok {
		return conversations.ErrNotFound
	}
	delete(f.convos, id)
	delete(f.messages, id)
	return nil
}

func (f *fakeRepository) CreateMessage(ctx context.Context, m *conversations.Message, attachmentIDs ...string) error {
	m.CreatedAt = time.Now()
	f.messages[m.ConversationID] = append(f.messages[m.ConversationID], m)
	return nil
}

func (f *fakeRepository) ListMessages(ctx context.Context, conversationID string) ([]*conversations.Message, error) {
	return f.messages[conversationID], nil
}

func (f *fakeRepository) AppendMessageAndTouchConversation(ctx context.Context, m *conversations.Message) error {
	c, ok := f.convos[m.ConversationID]
	if !ok {
		return conversations.ErrNotFound
	}
	m.CreatedAt = time.Now()
	f.messages[m.ConversationID] = append(f.messages[m.ConversationID], m)
	c.UpdatedAt = m.CreatedAt
	return nil
}

// fakeProvider is a scripted llm.Provider used to drive StreamAssistantReply
// deterministically in tests. Each call to ChatStream consumes the next entry in
// rounds (or repeats the single entry if only one round was scripted), so tests can
// script a multi-round tool-calling exchange.
type fakeProvider struct {
	rounds    [][]llm.StreamChunk
	callCount int
}

// fakeProviderOnce is a convenience constructor for tests that only need a single
// round of scripted chunks (the common case before Phase 4's tool loop existed).
func fakeProviderOnce(chunks []llm.StreamChunk) *fakeProvider {
	return &fakeProvider{rounds: [][]llm.StreamChunk{chunks}}
}

func (p *fakeProvider) Name() string { return "fake" }

func (p *fakeProvider) ChatStream(ctx context.Context, req llm.ChatRequest) (<-chan llm.StreamChunk, error) {
	idx := p.callCount
	if idx >= len(p.rounds) {
		idx = len(p.rounds) - 1
	}
	p.callCount++

	chunks := p.rounds[idx]
	out := make(chan llm.StreamChunk, len(chunks))
	for _, c := range chunks {
		out <- c
	}
	close(out)
	return out, nil
}

func (p *fakeProvider) HealthCheck(ctx context.Context) llm.HealthResult {
	return llm.HealthResult{Status: llm.HealthStatusOK}
}

// fakeResolver is a scripted ModelBlockResolver used to hand a fakeProvider (or an
// error) to the service under test without depending on the modelblocks package.
type fakeResolver struct {
	provider llm.Provider
	policy   llm.ProviderPolicy
	err      error
}

func (r *fakeResolver) ResolveProvider(ctx context.Context, userID, householdID, modelBlockID string) (llm.Provider, llm.ProviderPolicy, error) {
	return r.provider, r.policy, r.err
}

// fakeServerLister is a scripted MCPServerLister.
type fakeServerLister struct {
	servers []mcp.ServerRef
}

func (f *fakeServerLister) ListEnabledServers(ctx context.Context) ([]mcp.ServerRef, error) {
	return f.servers, nil
}

// fakeToolCaller is a scripted mcp.ToolCaller for a single MCP server.
type fakeToolCaller struct {
	tools       []mcp.Tool
	callResults map[string]string // toolName -> result text
	calls       []string          // records every tool name invoked, for assertions
}

func (f *fakeToolCaller) ListTools(ctx context.Context) ([]mcp.Tool, error) {
	return f.tools, nil
}

func (f *fakeToolCaller) CallTool(ctx context.Context, toolName string, arguments map[string]any) (string, bool, error) {
	f.calls = append(f.calls, toolName)
	if result, ok := f.callResults[toolName]; ok {
		return result, false, nil
	}
	return "", false, nil
}

func (f *fakeToolCaller) Ping(ctx context.Context) mcp.DiagnosticResult {
	return mcp.DiagnosticResult{Reachable: true, ToolsCount: len(f.tools)}
}

// fakeClientPool hands out a fixed set of fakeToolCaller instances by endpoint URL.
type fakeClientPool struct {
	byURL map[string]mcp.ToolCaller
}

func (f *fakeClientPool) Get(endpointURL string) mcp.ToolCaller {
	return f.byURL[endpointURL]
}

func newTestService(repo conversations.Repository, resolver conversations.ModelBlockResolver) conversations.Service {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	emptyLister := &fakeServerLister{}
	emptyPool := &fakeClientPool{byURL: map[string]mcp.ToolCaller{}}
	return conversations.NewService(repo, resolver, emptyLister, emptyPool, log)
}

func newTestServiceWithTools(
	repo conversations.Repository,
	resolver conversations.ModelBlockResolver,
	lister conversations.MCPServerLister,
	pool conversations.MCPClientPool,
) conversations.Service {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return conversations.NewService(repo, resolver, lister, pool, log)
}

func drainChunks(t *testing.T, ch <-chan llm.StreamChunk, timeout time.Duration) []llm.StreamChunk {
	t.Helper()
	var chunks []llm.StreamChunk
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for {
		select {
		case chunk, ok := <-ch:
			if !ok {
				return chunks
			}
			chunks = append(chunks, chunk)
		case <-timer.C:
			t.Fatal("timed out waiting for stream chunks")
			return chunks
		}
	}
}

func TestService_CreateListDeleteConversation(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo, &fakeResolver{})
	ctx := context.Background()

	modelBlockID := "mb-1"
	sourceApp := "pantry"

	t.Run("requires a model_block_id", func(t *testing.T) {
		_, err := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{})
		if err != conversations.ErrModelBlockRequired {
			t.Errorf("expected ErrModelBlockRequired, got %v", err)
		}
	})

	created, err := svc.CreateConversation(ctx, "user-1", "hh-1", conversations.CreateConversationRequest{
		ModelBlockID: &modelBlockID,
		SourceApp:    &sourceApp,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if created.HouseholdID == nil || *created.HouseholdID != "hh-1" {
		t.Errorf("expected household_id hh-1, got %v", created.HouseholdID)
	}

	t.Run("owner sees their conversation in the list", func(t *testing.T) {
		list, err := svc.ListConversations(ctx, "user-1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(list) != 1 {
			t.Fatalf("expected 1 conversation, got %d", len(list))
		}
	})

	t.Run("other users do not see it", func(t *testing.T) {
		list, err := svc.ListConversations(ctx, "user-2")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(list) != 0 {
			t.Errorf("expected 0 conversations for a different user, got %d", len(list))
		}
	})

	t.Run("non-owner cannot delete", func(t *testing.T) {
		if err := svc.DeleteConversation(ctx, "user-2", created.ID); err != conversations.ErrForbidden {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("owner can delete", func(t *testing.T) {
		if err := svc.DeleteConversation(ctx, "user-1", created.ID); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

func TestService_PostAndListMessages(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo, &fakeResolver{})
	ctx := context.Background()

	modelBlockID := "mb-1"
	created, err := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Run("rejects empty content", func(t *testing.T) {
		_, err := svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{})
		if err != conversations.ErrEmptyMessageContent {
			t.Errorf("expected ErrEmptyMessageContent, got %v", err)
		}
	})

	msg, err := svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hello", AttachmentIDs: []string{"att-1"}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if msg.Role != conversations.RoleUser {
		t.Errorf("expected role user, got %s", msg.Role)
	}

	t.Run("non-owner cannot post a message", func(t *testing.T) {
		_, err := svc.PostMessage(ctx, "user-2", created.ID, conversations.CreateMessageRequest{Content: "hijack"})
		if err != conversations.ErrForbidden {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("non-owner cannot list messages", func(t *testing.T) {
		_, err := svc.ListMessages(ctx, "user-2", created.ID)
		if err != conversations.ErrForbidden {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	list, err := svc.ListMessages(ctx, "user-1", created.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 message, got %d", len(list))
	}
}

func TestService_StreamAssistantReply(t *testing.T) {
	ctx := context.Background()

	t.Run("streams text deltas and persists the full assistant reply", func(t *testing.T) {
		repo := newFakeRepository()
		provider := fakeProviderOnce([]llm.StreamChunk{
			{DeltaText: "Hel"},
			{DeltaText: "lo"},
			{Done: true, Usage: &llm.Usage{PromptTokens: 1, CompletionTokens: 2, TotalTokens: 3}},
		})
		svc := newTestService(repo, &fakeResolver{provider: provider})

		modelBlockID := "mb-1"
		created, err := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, err := svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		chunks, err := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		received := drainChunks(t, chunks, 2*time.Second)
		if len(received) != 3 {
			t.Fatalf("expected 3 chunks forwarded, got %d", len(received))
		}

		// The persistence write races the test goroutine slightly (it happens after
		// the channel closes but on its own goroutine timeline internally); give it
		// a short moment since it uses a background context, not the test's.
		deadline := time.Now().Add(1 * time.Second)
		var messages []*conversations.Message
		for time.Now().Before(deadline) {
			messages = repo.messages[created.ID]
			if len(messages) == 2 {
				break
			}
			time.Sleep(10 * time.Millisecond)
		}

		if len(messages) != 2 {
			t.Fatalf("expected 2 messages (user + assistant), got %d", len(messages))
		}
		assistantMsg := messages[1]
		if assistantMsg.Role != conversations.RoleAssistant {
			t.Errorf("expected second message role assistant, got %s", assistantMsg.Role)
		}
		if assistantMsg.Content != "Hello" {
			t.Errorf("expected persisted content %q, got %q", "Hello", assistantMsg.Content)
		}
	})

	t.Run("does not persist anything when the stream ends in an error", func(t *testing.T) {
		repo := newFakeRepository()
		provider := fakeProviderOnce([]llm.StreamChunk{
			{DeltaText: "partial"},
			{Done: true, Err: errors.New("boom")},
		})
		svc := newTestService(repo, &fakeResolver{provider: provider})

		modelBlockID := "mb-1"
		created, err := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, err := svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		chunks, err := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		drainChunks(t, chunks, 2*time.Second)

		time.Sleep(50 * time.Millisecond)
		if len(repo.messages[created.ID]) != 1 {
			t.Errorf("expected only the original user message to remain, got %d messages", len(repo.messages[created.ID]))
		}
	})

	t.Run("rejects streaming when there is no pending user message", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo, &fakeResolver{provider: &fakeProvider{}})

		modelBlockID := "mb-1"
		created, err := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		_, err = svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		if err != conversations.ErrNoPendingUserMessage {
			t.Errorf("expected ErrNoPendingUserMessage, got %v", err)
		}
	})

	t.Run("rejects streaming for a non-owner", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo, &fakeResolver{provider: &fakeProvider{}})

		modelBlockID := "mb-1"
		created, err := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		_, err = svc.StreamAssistantReply(ctx, "user-2", "", created.ID)
		if err != conversations.ErrForbidden {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("wraps model block resolution failures", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo, &fakeResolver{err: errors.New("model block gone")})

		modelBlockID := "mb-1"
		created, err := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, err := svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		_, err = svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		if !errors.Is(err, conversations.ErrModelBlockUnavailable) {
			t.Errorf("expected ErrModelBlockUnavailable, got %v", err)
		}
	})
}

func TestService_ToolCallingLoop(t *testing.T) {
	ctx := context.Background()

	pantryServer := mcp.ServerRef{ID: "srv-pantry", Slug: "pantry", EndpointURL: "http://pantry-backend:8000/mcp"}
	pantryTools := &fakeToolCaller{
		tools:       []mcp.Tool{{Name: "get_stock", Description: "look up pantry stock", InputSchema: map[string]any{"type": "object"}}},
		callResults: map[string]string{"get_stock": "3 liters of milk"},
	}
	lister := &fakeServerLister{servers: []mcp.ServerRef{pantryServer}}
	pool := &fakeClientPool{byURL: map[string]mcp.ToolCaller{pantryServer.EndpointURL: pantryTools}}

	t.Run("executes a tool call and continues to a final answer", func(t *testing.T) {
		repo := newFakeRepository()
		provider := &fakeProvider{rounds: [][]llm.StreamChunk{
			{
				{ToolCall: &llm.ToolCallRequest{ID: "call_0", ToolName: "get_stock", Arguments: map[string]any{"item": "milk"}}},
				{Done: true},
			},
			{
				{DeltaText: "You have 3 liters of milk."},
				{Done: true, Usage: &llm.Usage{TotalTokens: 7}},
			},
		}}
		svc := newTestServiceWithTools(repo, &fakeResolver{provider: provider}, lister, pool)

		modelBlockID := "mb-1"
		created, err := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, err := svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "how much milk do we have?"}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		chunks, err := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		received := drainChunks(t, chunks, 2*time.Second)

		var toolCallChunks, doneChunks int
		var finalText string
		for _, c := range received {
			if c.ToolCall != nil {
				toolCallChunks++
			}
			if c.Done {
				doneChunks++
			}
			finalText += c.DeltaText
		}
		if toolCallChunks != 1 {
			t.Errorf("expected exactly 1 forwarded tool_call chunk, got %d", toolCallChunks)
		}
		if doneChunks != 1 {
			t.Errorf("expected exactly 1 terminal done chunk for the whole turn (not one per round), got %d", doneChunks)
		}
		if finalText != "You have 3 liters of milk." {
			t.Errorf("expected final text %q, got %q", "You have 3 liters of milk.", finalText)
		}

		if len(pantryTools.calls) != 1 || pantryTools.calls[0] != "get_stock" {
			t.Fatalf("expected get_stock to be called exactly once, got %+v", pantryTools.calls)
		}

		deadline := time.Now().Add(1 * time.Second)
		var messages []*conversations.Message
		for time.Now().Before(deadline) {
			messages = repo.messages[created.ID]
			if len(messages) == 4 {
				break
			}
			time.Sleep(10 * time.Millisecond)
		}
		if len(messages) != 4 {
			t.Fatalf("expected 4 messages (user, assistant tool-call, tool result, final assistant), got %d", len(messages))
		}
		if messages[1].Role != conversations.RoleAssistant || len(messages[1].ToolCallsJSON) == 0 {
			t.Errorf("expected message 2 to be the assistant's tool-call turn with recorded tool_calls_json, got %+v", messages[1])
		}
		if messages[2].Role != conversations.RoleTool || messages[2].Content != "3 liters of milk" {
			t.Errorf("expected message 3 to be the tool result, got %+v", messages[2])
		}
		if messages[3].Role != conversations.RoleAssistant || messages[3].Content != "You have 3 liters of milk." {
			t.Errorf("expected message 4 to be the final assistant answer, got %+v", messages[3])
		}
	})

	t.Run("stops at the tool round limit and reports an error instead of looping forever", func(t *testing.T) {
		repo := newFakeRepository()
		// Every round asks for another tool call, never producing a final answer.
		alwaysToolCallRound := []llm.StreamChunk{
			{ToolCall: &llm.ToolCallRequest{ID: "call_0", ToolName: "get_stock", Arguments: map[string]any{"item": "milk"}}},
			{Done: true},
		}
		provider := &fakeProvider{rounds: [][]llm.StreamChunk{alwaysToolCallRound}} // repeats via ChatStream's clamping

		svc := newTestServiceWithTools(repo, &fakeResolver{provider: provider, policy: llm.ProviderPolicy{ToolRoundLimit: 2}}, lister, pool)

		modelBlockID := "mb-1"
		created, err := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, err := svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "how much milk do we have?"}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		chunks, err := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		received := drainChunks(t, chunks, 2*time.Second)

		last := received[len(received)-1]
		if last.Err == nil || !last.Done {
			t.Fatalf("expected a terminal error chunk when the round limit is exceeded, got %+v", last)
		}
	})
}

func TestService_StreamAssistantReply_ChatStreamInitialFailure(t *testing.T) {
	repo := newFakeRepository()
	provider := &errorProvider{err: errors.New("connection refused")}
	svc := newTestService(repo, &fakeResolver{provider: provider})
	ctx := context.Background()

	modelBlockID := "mb-1"
	created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
	svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

	chunks, err := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
	if err != nil {
		t.Fatalf("unexpected synchronous error: %v", err)
	}

	received := drainChunks(t, chunks, 2*time.Second)
	if len(received) == 0 {
		t.Fatal("expected at least one chunk")
	}
	last := received[len(received)-1]
	if last.Err == nil {
		t.Error("expected error in last chunk")
	}
}

// errorProvider is an llm.Provider whose ChatStream always fails.
type errorProvider struct {
	err error
}

func (p *errorProvider) Name() string { return "error" }
func (p *errorProvider) ChatStream(ctx context.Context, req llm.ChatRequest) (<-chan llm.StreamChunk, error) {
	return nil, p.err
}
func (p *errorProvider) HealthCheck(ctx context.Context) llm.HealthResult {
	return llm.HealthResult{Status: llm.HealthStatusUnreachable}
}

func TestService_StreamAssistantReply_EmptyContent(t *testing.T) {
	repo := newFakeRepository()
	provider := fakeProviderOnce([]llm.StreamChunk{
		{Done: true, Usage: &llm.Usage{TotalTokens: 1}},
	})
	svc := newTestService(repo, &fakeResolver{provider: provider})
	ctx := context.Background()

	modelBlockID := "mb-1"
	created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
	svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

	chunks, err := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	received := drainChunks(t, chunks, 2*time.Second)
	if len(received) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(received))
	}
	if !received[0].Done {
		t.Error("expected done chunk")
	}

	time.Sleep(50 * time.Millisecond)
	if len(repo.messages[created.ID]) != 1 {
		t.Errorf("expected only user message, got %d messages", len(repo.messages[created.ID]))
	}
}

func TestService_DeleteConversation_RepoDeleteError(t *testing.T) {
	repo := &failingDeleteRepo{fakeRepository: newFakeRepository()}
	svc := newTestService(repo, &fakeResolver{})
	ctx := context.Background()

	modelBlockID := "mb-1"
	created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})

	err := svc.DeleteConversation(ctx, "user-1", created.ID)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

type failingDeleteRepo struct {
	*fakeRepository
}

func (f *failingDeleteRepo) DeleteConversation(ctx context.Context, id string) error {
	return errors.New("delete failed")
}

func TestService_BuildToolDefinitions_EdgeCases(t *testing.T) {
	ctx := context.Background()

	t.Run("lister error returns nil", func(t *testing.T) {
		repo := newFakeRepository()
		lister := &errorServerLister{err: errors.New("list error")}
		pool := &fakeClientPool{byURL: map[string]mcp.ToolCaller{}}
		svc := newTestServiceWithTools(repo, &fakeResolver{provider: fakeProviderOnce([]llm.StreamChunk{{Done: true}})}, lister, pool)

		modelBlockID := "mb-1"
		created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

		chunks, err := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		drainChunks(t, chunks, 2*time.Second)
	})

	t.Run("ListTools error skips server", func(t *testing.T) {
		repo := newFakeRepository()
		server := mcp.ServerRef{ID: "srv-1", Slug: "app1", EndpointURL: "http://app1/mcp"}
		lister := &fakeServerLister{servers: []mcp.ServerRef{server}}
		pool := &fakeClientPool{byURL: map[string]mcp.ToolCaller{
			server.EndpointURL: &errorToolCaller{err: errors.New("tool list error")},
		}}
		svc := newTestServiceWithTools(repo, &fakeResolver{provider: fakeProviderOnce([]llm.StreamChunk{{Done: true}})}, lister, pool)

		modelBlockID := "mb-1"
		created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

		chunks, err := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		drainChunks(t, chunks, 2*time.Second)
	})

	t.Run("duplicate tool name across servers keeps first", func(t *testing.T) {
		repo := newFakeRepository()
		srv1 := mcp.ServerRef{ID: "srv-1", Slug: "app1", EndpointURL: "http://app1/mcp"}
		srv2 := mcp.ServerRef{ID: "srv-2", Slug: "app2", EndpointURL: "http://app2/mcp"}
		lister := &fakeServerLister{servers: []mcp.ServerRef{srv1, srv2}}
		pool := &fakeClientPool{byURL: map[string]mcp.ToolCaller{
			srv1.EndpointURL: &fakeToolCaller{tools: []mcp.Tool{{Name: "dup_tool", Description: "first"}}},
			srv2.EndpointURL: &fakeToolCaller{tools: []mcp.Tool{{Name: "dup_tool", Description: "second"}}},
		}}
		svc := newTestServiceWithTools(repo, &fakeResolver{provider: fakeProviderOnce([]llm.StreamChunk{{Done: true}})}, lister, pool)

		modelBlockID := "mb-1"
		created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

		chunks, err := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		drainChunks(t, chunks, 2*time.Second)
	})

	t.Run("allowedApps filters servers", func(t *testing.T) {
		repo := newFakeRepository()
		srv1 := mcp.ServerRef{ID: "srv-1", Slug: "allowed", EndpointURL: "http://allowed/mcp"}
		srv2 := mcp.ServerRef{ID: "srv-2", Slug: "blocked", EndpointURL: "http://blocked/mcp"}
		lister := &fakeServerLister{servers: []mcp.ServerRef{srv1, srv2}}
		pool := &fakeClientPool{byURL: map[string]mcp.ToolCaller{
			srv1.EndpointURL: &fakeToolCaller{tools: []mcp.Tool{{Name: "allowed_tool", Description: "allowed"}}},
			srv2.EndpointURL: &fakeToolCaller{tools: []mcp.Tool{{Name: "blocked_tool", Description: "blocked"}}},
		}}
		resolver := &fakeResolver{
			provider: fakeProviderOnce([]llm.StreamChunk{{Done: true}}),
			policy:   llm.ProviderPolicy{AllowedMCPApps: []string{"allowed"}},
		}
		svc := newTestServiceWithTools(repo, resolver, lister, pool)

		modelBlockID := "mb-1"
		created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

		chunks, err := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		drainChunks(t, chunks, 2*time.Second)
	})
}

type errorServerLister struct {
	err error
}

func (e *errorServerLister) ListEnabledServers(ctx context.Context) ([]mcp.ServerRef, error) {
	return nil, e.err
}

type errorToolCaller struct {
	err error
}

func (e *errorToolCaller) ListTools(ctx context.Context) ([]mcp.Tool, error) {
	return nil, e.err
}
func (e *errorToolCaller) CallTool(ctx context.Context, toolName string, arguments map[string]any) (string, bool, error) {
	return "", false, e.err
}
func (e *errorToolCaller) Ping(ctx context.Context) mcp.DiagnosticResult {
	return mcp.DiagnosticResult{Reachable: false}
}

func TestService_ExecuteToolCall_EdgeCases(t *testing.T) {
	ctx := context.Background()

	t.Run("unknown tool returns error text", func(t *testing.T) {
		repo := newFakeRepository()
		provider := &fakeProvider{rounds: [][]llm.StreamChunk{
			{
				{ToolCall: &llm.ToolCallRequest{ID: "call_0", ToolName: "unknown_tool"}},
				{Done: true},
			},
			{{DeltaText: "OK"}, {Done: true}},
		}}
		lister := &fakeServerLister{servers: []mcp.ServerRef{}}
		pool := &fakeClientPool{byURL: map[string]mcp.ToolCaller{}}
		svc := newTestServiceWithTools(repo, &fakeResolver{provider: provider}, lister, pool)

		modelBlockID := "mb-1"
		created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

		chunks, _ := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		drainChunks(t, chunks, 2*time.Second)
	})

	t.Run("MCP call error returns error text", func(t *testing.T) {
		repo := newFakeRepository()
		srv := mcp.ServerRef{ID: "srv-1", Slug: "app1", EndpointURL: "http://app1/mcp"}
		provider := &fakeProvider{rounds: [][]llm.StreamChunk{
			{
				{ToolCall: &llm.ToolCallRequest{ID: "call_0", ToolName: "failing_tool"}},
				{Done: true},
			},
			{{DeltaText: "handled"}, {Done: true}},
		}}
		lister := &fakeServerLister{servers: []mcp.ServerRef{srv}}
		pool := &fakeClientPool{byURL: map[string]mcp.ToolCaller{
			srv.EndpointURL: &fakeToolCallerWithCallError{
				tools: []mcp.Tool{{Name: "failing_tool", Description: "fails"}},
				err:   errors.New("mcp error"),
			},
		}}
		svc := newTestServiceWithTools(repo, &fakeResolver{provider: provider}, lister, pool)

		modelBlockID := "mb-1"
		created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

		chunks, _ := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		drainChunks(t, chunks, 2*time.Second)
	})

	t.Run("MCP call isError result", func(t *testing.T) {
		repo := newFakeRepository()
		srv := mcp.ServerRef{ID: "srv-1", Slug: "app1", EndpointURL: "http://app1/mcp"}
		provider := &fakeProvider{rounds: [][]llm.StreamChunk{
			{
				{ToolCall: &llm.ToolCallRequest{ID: "call_0", ToolName: "error_tool"}},
				{Done: true},
			},
			{{DeltaText: "handled"}, {Done: true}},
		}}
		lister := &fakeServerLister{servers: []mcp.ServerRef{srv}}
		pool := &fakeClientPool{byURL: map[string]mcp.ToolCaller{
			srv.EndpointURL: &isErrorToolCaller{
				tools: []mcp.Tool{{Name: "error_tool", Description: "returns isError"}},
			},
		}}
		svc := newTestServiceWithTools(repo, &fakeResolver{provider: provider}, lister, pool)

		modelBlockID := "mb-1"
		created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

		chunks, _ := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		drainChunks(t, chunks, 2*time.Second)
	})

	t.Run("ChatStream fails on continuation round", func(t *testing.T) {
		repo := newFakeRepository()
		srv := mcp.ServerRef{ID: "srv-1", Slug: "app1", EndpointURL: "http://app1/mcp"}
		callCount := 0
		provider := &failOnSecondCallProvider{
			first: []llm.StreamChunk{
				{ToolCall: &llm.ToolCallRequest{ID: "call_0", ToolName: "my_tool"}},
				{Done: true},
			},
			callCount: &callCount,
		}
		lister := &fakeServerLister{servers: []mcp.ServerRef{srv}}
		pool := &fakeClientPool{byURL: map[string]mcp.ToolCaller{
			srv.EndpointURL: &fakeToolCaller{
				tools:       []mcp.Tool{{Name: "my_tool", Description: "tool"}},
				callResults: map[string]string{"my_tool": "result"},
			},
		}}
		svc := newTestServiceWithTools(repo, &fakeResolver{provider: provider}, lister, pool)

		modelBlockID := "mb-1"
		created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
		svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

		chunks, _ := svc.StreamAssistantReply(ctx, "user-1", "", created.ID)
		received := drainChunks(t, chunks, 2*time.Second)
		last := received[len(received)-1]
		if last.Err == nil || !last.Done {
			t.Fatalf("expected terminal error chunk, got %+v", last)
		}
	})
}

type fakeToolCallerWithCallError struct {
	tools []mcp.Tool
	err   error
}

func (f *fakeToolCallerWithCallError) ListTools(ctx context.Context) ([]mcp.Tool, error) {
	return f.tools, nil
}
func (f *fakeToolCallerWithCallError) CallTool(ctx context.Context, toolName string, arguments map[string]any) (string, bool, error) {
	return "", false, f.err
}
func (f *fakeToolCallerWithCallError) Ping(ctx context.Context) mcp.DiagnosticResult {
	return mcp.DiagnosticResult{Reachable: true}
}

type isErrorToolCaller struct {
	tools []mcp.Tool
}

func (f *isErrorToolCaller) ListTools(ctx context.Context) ([]mcp.Tool, error) {
	return f.tools, nil
}
func (f *isErrorToolCaller) CallTool(ctx context.Context, toolName string, arguments map[string]any) (string, bool, error) {
	return "tool reported error", true, nil
}
func (f *isErrorToolCaller) Ping(ctx context.Context) mcp.DiagnosticResult {
	return mcp.DiagnosticResult{Reachable: true}
}

type failOnSecondCallProvider struct {
	first     []llm.StreamChunk
	callCount *int
}

func (p *failOnSecondCallProvider) Name() string { return "fail-on-second" }
func (p *failOnSecondCallProvider) ChatStream(ctx context.Context, req llm.ChatRequest) (<-chan llm.StreamChunk, error) {
	*p.callCount++
	if *p.callCount > 1 {
		return nil, errors.New("connection lost")
	}
	out := make(chan llm.StreamChunk, len(p.first))
	for _, c := range p.first {
		out <- c
	}
	close(out)
	return out, nil
}
func (p *failOnSecondCallProvider) HealthCheck(ctx context.Context) llm.HealthResult {
	return llm.HealthResult{Status: llm.HealthStatusOK}
}

func TestToMessageResponse_WithAttachments(t *testing.T) {
	m := &conversations.Message{
		ID:             "m1",
		ConversationID: "c1",
		Role:           conversations.RoleUser,
		Content:        "hello",
		Attachments: []conversations.MessageAttachment{
			{ID: "a1", StorageKey: "key1", MimeType: "image/png", SizeBytes: 100, URL: "http://test/key1"},
		},
	}
	dto := conversations.ToMessageResponse(m)
	if len(dto.Attachments) != 1 {
		t.Errorf("expected 1 attachment, got %d", len(dto.Attachments))
	}
	if dto.Attachments[0].ID != "a1" {
		t.Errorf("expected attachment ID a1, got %s", dto.Attachments[0].ID)
	}
}

// failingListRepo always errors on ListConversationsByOwner and ListMessages.
type failingListRepo struct {
	*fakeRepository
}

func (f *failingListRepo) ListConversationsByOwner(ctx context.Context, ownerUserID string) ([]*conversations.Conversation, error) {
	return nil, errors.New("list convos error")
}

func (f *failingListRepo) ListMessages(ctx context.Context, conversationID string) ([]*conversations.Message, error) {
	return nil, errors.New("list messages error")
}

func TestService_ListConversations_RepoError(t *testing.T) {
	repo := &failingListRepo{fakeRepository: newFakeRepository()}
	svc := newTestService(repo, &fakeResolver{})

	_, err := svc.ListConversations(context.Background(), "user-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestService_ListMessages_RepoError(t *testing.T) {
	repo := &failingListRepo{fakeRepository: newFakeRepository()}
	svc := newTestService(repo, &fakeResolver{})
	ctx := context.Background()

	modelBlockID := "mb-1"
	created, _ := svc.CreateConversation(ctx, "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})

	_, err := svc.ListMessages(ctx, "user-1", created.ID)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// failingCreateRepo always errors on CreateConversation.
type failingCreateRepo struct {
	*fakeRepository
}

func (f *failingCreateRepo) CreateConversation(ctx context.Context, c *conversations.Conversation) error {
	return errors.New("create error")
}

func TestService_CreateConversation_RepoError(t *testing.T) {
	repo := &failingCreateRepo{fakeRepository: newFakeRepository()}
	svc := newTestService(repo, &fakeResolver{})

	modelBlockID := "mb-1"
	_, err := svc.CreateConversation(context.Background(), "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestService_DeleteConversation_NotFound(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo, &fakeResolver{})

	err := svc.DeleteConversation(context.Background(), "user-1", "nonexistent")
	if !errors.Is(err, conversations.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestService_PostMessage_NotFound(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo, &fakeResolver{})

	_, err := svc.PostMessage(context.Background(), "user-1", "nonexistent", conversations.CreateMessageRequest{Content: "hello"})
	if !errors.Is(err, conversations.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestBuildLLMMessages_WithToolCallsJSON(t *testing.T) {
	toolCallsJSON := []byte(`[{"ID":"call_1","ToolName":"foo","Arguments":{}}]`)
	messages := []*conversations.Message{
		{ID: "m1", Role: conversations.RoleUser, Content: "hello"},
		{ID: "m2", Role: conversations.RoleAssistant, Content: "let me check", ToolCallsJSON: toolCallsJSON},
	}

	result := conversations.BuildLLMMessages(messages)
	// Should have system prompt + user + assistant = 3 messages
	if len(result) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(result))
	}
	if result[0].Role != llm.RoleSystem {
		t.Errorf("expected system prompt as first message, got role %s", result[0].Role)
	}
}

func TestBuildLLMMessages_WithExistingSystemPrompt(t *testing.T) {
	messages := []*conversations.Message{
		{ID: "m0", Role: conversations.RoleSystem, Content: "custom system prompt"},
		{ID: "m1", Role: conversations.RoleUser, Content: "hello"},
	}

	result := conversations.BuildLLMMessages(messages)
	// Should NOT add a system prompt since one exists
	if len(result) != 2 {
		t.Fatalf("expected 2 messages (no extra system prompt), got %d", len(result))
	}
}
