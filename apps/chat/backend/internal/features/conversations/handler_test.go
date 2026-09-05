package conversations_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/chat/internal/features/conversations"
	"alfheim/chat/internal/shared/llm"
	"alfheim/chat/internal/shared/middleware"
)

var errStreamFailed = errors.New("stream failed")

func withClaims(claims *middleware.UserClaims) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func newTestRouter(svc conversations.Service, claims *middleware.UserClaims) http.Handler {
	r := chi.NewRouter()
	handler := conversations.NewHandler(svc)
	handler.RegisterRoutes(r, withClaims(claims))
	return r
}

func TestHandler_CreateListDeleteConversation(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo, &fakeResolver{})
	claims := &middleware.UserClaims{Subject: "user-1", HouseholdID: "hh-1"}
	router := newTestRouter(svc, claims)

	modelBlockID := "mb-1"
	body, _ := json.Marshal(conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/conversations", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var created conversations.ConversationResponseDTO
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)

	var listed []conversations.ConversationResponseDTO
	if err := json.Unmarshal(listRec.Body.Bytes(), &listed); err != nil {
		t.Fatalf("failed to decode list response: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("expected 1 conversation, got %d", len(listed))
	}

	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/chat/conversations/"+created.ID, nil)
	delRec := httptest.NewRecorder()
	router.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", delRec.Code)
	}
}

func TestHandler_CreateRejectsMissingModelBlockID(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo, &fakeResolver{})
	claims := &middleware.UserClaims{Subject: "user-1"}
	router := newTestRouter(svc, claims)

	body, _ := json.Marshal(conversations.CreateConversationRequest{})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/conversations", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_PostAndListMessages(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo, &fakeResolver{})
	claims := &middleware.UserClaims{Subject: "user-1"}
	router := newTestRouter(svc, claims)

	modelBlockID := "mb-1"
	created, err := svc.CreateConversation(context.Background(), "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msgBody, _ := json.Marshal(conversations.CreateMessageRequest{Content: "hello there"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/conversations/"+created.ID+"/messages", bytes.NewReader(msgBody))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations/"+created.ID+"/messages", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)

	var messages []conversations.MessageResponseDTO
	if err := json.Unmarshal(listRec.Body.Bytes(), &messages); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(messages) != 1 || messages[0].Content != "hello there" {
		t.Fatalf("expected 1 message with the posted content, got %+v", messages)
	}
}

func TestHandler_StreamEmitsSSEDeltasAndDoneEvent(t *testing.T) {
	repo := newFakeRepository()
	provider := fakeProviderOnce([]llm.StreamChunk{
		{DeltaText: "Hi"},
		{Done: true, Usage: &llm.Usage{TotalTokens: 5}},
	})
	svc := newTestService(repo, &fakeResolver{provider: provider})
	claims := &middleware.UserClaims{Subject: "user-1"}
	router := newTestRouter(svc, claims)

	modelBlockID := "mb-1"
	created, err := svc.CreateConversation(context.Background(), "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := svc.PostMessage(context.Background(), "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations/"+created.ID+"/stream", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Errorf("expected Content-Type text/event-stream, got %q", ct)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "event: delta") {
		t.Errorf("expected a delta event in body, got: %s", body)
	}
	if !strings.Contains(body, `"text":"Hi"`) {
		t.Errorf("expected delta text 'Hi' in body, got: %s", body)
	}
	if !strings.Contains(body, "event: done") {
		t.Errorf("expected a done event in body, got: %s", body)
	}
}

func TestHandler_StreamReportsErrorEventOnMidStreamFailure(t *testing.T) {
	repo := newFakeRepository()
	provider := fakeProviderOnce([]llm.StreamChunk{
		{Done: true, Err: errStreamFailed},
	})
	svc := newTestService(repo, &fakeResolver{provider: provider})
	claims := &middleware.UserClaims{Subject: "user-1"}
	router := newTestRouter(svc, claims)

	modelBlockID := "mb-1"
	created, err := svc.CreateConversation(context.Background(), "user-1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := svc.PostMessage(context.Background(), "user-1", created.ID, conversations.CreateMessageRequest{Content: "hi"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations/"+created.ID+"/stream", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	body := rec.Body.String()
	if !strings.Contains(body, "event: error") {
		t.Errorf("expected an error event in body, got: %s", body)
	}
	if strings.Contains(body, "event: done") {
		t.Errorf("expected no done event alongside a terminal error, got: %s", body)
	}
}

func TestHandler_StreamRejectsMissingModelBlockBeforeHeadersSent(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo, &fakeResolver{})
	claims := &middleware.UserClaims{Subject: "user-1"}
	router := newTestRouter(svc, claims)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations/does-not-exist/stream", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected a normal JSON error response before streaming starts, got Content-Type %q", ct)
	}
}

func TestHandler_UnauthorizedRequests(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo, &fakeResolver{})
	handler := conversations.NewHandler(svc)

	noAuthRouter := chi.NewRouter()
	noAuthMw := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)
		})
	}
	handler.RegisterRoutes(noAuthRouter, noAuthMw)

	endpoints := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/v1/chat/conversations"},
		{http.MethodPost, "/api/v1/chat/conversations"},
		{http.MethodDelete, "/api/v1/chat/conversations/c1"},
		{http.MethodGet, "/api/v1/chat/conversations/c1/messages"},
		{http.MethodPost, "/api/v1/chat/conversations/c1/messages"},
		{http.MethodGet, "/api/v1/chat/conversations/c1/stream"},
	}

	for _, ep := range endpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			req := httptest.NewRequest(ep.method, ep.path, nil)
			rec := httptest.NewRecorder()
			noAuthRouter.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Errorf("expected 401 Unauthorized for %s %s, got %d", ep.method, ep.path, rec.Code)
			}
		})
	}
}

// errorService is a Service that always returns the configured error for every method.
type errorService struct {
	err error
}

func (e *errorService) ListConversations(ctx context.Context, userID string) ([]conversations.ConversationResponseDTO, error) {
	return nil, e.err
}
func (e *errorService) CreateConversation(ctx context.Context, userID, householdID string, req conversations.CreateConversationRequest) (conversations.ConversationResponseDTO, error) {
	return conversations.ConversationResponseDTO{}, e.err
}
func (e *errorService) DeleteConversation(ctx context.Context, userID, id string) error {
	return e.err
}
func (e *errorService) ListMessages(ctx context.Context, userID, conversationID string) ([]conversations.MessageResponseDTO, error) {
	return nil, e.err
}
func (e *errorService) PostMessage(ctx context.Context, userID, conversationID string, req conversations.CreateMessageRequest) (conversations.MessageResponseDTO, error) {
	return conversations.MessageResponseDTO{}, e.err
}
func (e *errorService) StreamAssistantReply(ctx context.Context, userID, householdID, conversationID string) (<-chan llm.StreamChunk, error) {
	return nil, e.err
}

func TestHandler_ListServiceError(t *testing.T) {
	svc := &errorService{err: errors.New("db error")}
	claims := &middleware.UserClaims{Subject: "u1"}
	router := newTestRouter(svc, claims)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", rec.Code)
	}
}

func TestHandler_CreateBadJSON(t *testing.T) {
	svc := &errorService{err: nil}
	claims := &middleware.UserClaims{Subject: "u1"}
	router := newTestRouter(svc, claims)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/conversations", bytes.NewReader([]byte("not json")))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_PostMessageBadJSON(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo, &fakeResolver{})
	claims := &middleware.UserClaims{Subject: "u1"}
	router := newTestRouter(svc, claims)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/conversations/c1/messages", bytes.NewReader([]byte("{invalid")))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_WriteServiceErrorMappings(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		wantCode int
	}{
		{"NotFound", conversations.ErrNotFound, http.StatusNotFound},
		{"Forbidden", conversations.ErrForbidden, http.StatusForbidden},
		{"ModelBlockRequired", conversations.ErrModelBlockRequired, http.StatusBadRequest},
		{"EmptyMessageContent", conversations.ErrEmptyMessageContent, http.StatusBadRequest},
		{"NoPendingUserMessage", conversations.ErrNoPendingUserMessage, http.StatusBadRequest},
		{"ModelBlockUnavailable", conversations.ErrModelBlockUnavailable, http.StatusUnprocessableEntity},
		{"GenericError", errors.New("other"), http.StatusInternalServerError},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &errorService{err: tt.err}
			claims := &middleware.UserClaims{Subject: "u1"}
			router := newTestRouter(svc, claims)

			// Test via Delete handler which calls writeServiceError directly
			req := httptest.NewRequest(http.MethodDelete, "/api/v1/chat/conversations/c1", nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != tt.wantCode {
				t.Errorf("expected %d, got %d", tt.wantCode, rec.Code)
			}
		})
	}
}

func TestHandler_StreamToolCallSSEEvent(t *testing.T) {
	repo := newFakeRepository()
	// Multi-round: round 1 = tool call, round 2 = text answer
	provider := &fakeProvider{rounds: [][]llm.StreamChunk{
		{
			{ToolCall: &llm.ToolCallRequest{ID: "call_1", ToolName: "get_stock", Arguments: map[string]any{"item": "milk"}}},
			{Done: true},
		},
		{
			{DeltaText: "Result"},
			{Done: true, Usage: &llm.Usage{TotalTokens: 5}},
		},
	}}
	svc := newTestService(repo, &fakeResolver{provider: provider})
	claims := &middleware.UserClaims{Subject: "u1"}
	router := newTestRouter(svc, claims)

	modelBlockID := "mb-1"
	created, _ := svc.CreateConversation(context.Background(), "u1", "", conversations.CreateConversationRequest{ModelBlockID: &modelBlockID})
	svc.PostMessage(context.Background(), "u1", created.ID, conversations.CreateMessageRequest{Content: "hi"})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations/"+created.ID+"/stream", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	body := rec.Body.String()
	if !strings.Contains(body, "event: tool_call") {
		t.Errorf("expected tool_call event, got: %s", body)
	}
	if !strings.Contains(body, "event: delta") {
		t.Errorf("expected delta event, got: %s", body)
	}
	if !strings.Contains(body, "event: done") {
		t.Errorf("expected done event, got: %s", body)
	}
}

func TestHandler_ListMessagesServiceError(t *testing.T) {
	svc := &errorService{err: conversations.ErrNotFound}
	claims := &middleware.UserClaims{Subject: "u1"}
	router := newTestRouter(svc, claims)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations/c1/messages", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestHandler_PostMessageServiceError(t *testing.T) {
	svc := &errorService{err: conversations.ErrForbidden}
	claims := &middleware.UserClaims{Subject: "u1"}
	router := newTestRouter(svc, claims)

	body, _ := json.Marshal(conversations.CreateMessageRequest{Content: "hello"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/conversations/c1/messages", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", rec.Code)
	}
}

func TestHandler_StreamServiceError(t *testing.T) {
	svc := &errorService{err: conversations.ErrModelBlockUnavailable}
	claims := &middleware.UserClaims{Subject: "u1", HouseholdID: "hh-1"}
	router := newTestRouter(svc, claims)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations/c1/stream", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", rec.Code)
	}
}
