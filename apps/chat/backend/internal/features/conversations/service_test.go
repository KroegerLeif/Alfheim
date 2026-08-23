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

func (f *fakeRepository) CreateMessage(ctx context.Context, m *conversations.Message) error {
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
// deterministically in tests.
type fakeProvider struct {
	chunks []llm.StreamChunk
}

func (p *fakeProvider) Name() string { return "fake" }

func (p *fakeProvider) ChatStream(ctx context.Context, req llm.ChatRequest) (<-chan llm.StreamChunk, error) {
	out := make(chan llm.StreamChunk, len(p.chunks))
	for _, c := range p.chunks {
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
	err      error
}

func (r *fakeResolver) ResolveProvider(ctx context.Context, userID, householdID, modelBlockID string) (llm.Provider, error) {
	return r.provider, r.err
}

func newTestService(repo conversations.Repository, resolver conversations.ModelBlockResolver) conversations.Service {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return conversations.NewService(repo, resolver, log)
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

	msg, err := svc.PostMessage(ctx, "user-1", created.ID, conversations.CreateMessageRequest{Content: "hello"})
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
		provider := &fakeProvider{chunks: []llm.StreamChunk{
			{DeltaText: "Hel"},
			{DeltaText: "lo"},
			{Done: true, Usage: &llm.Usage{PromptTokens: 1, CompletionTokens: 2, TotalTokens: 3}},
		}}
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
		provider := &fakeProvider{chunks: []llm.StreamChunk{
			{DeltaText: "partial"},
			{Done: true, Err: errors.New("boom")},
		}}
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
