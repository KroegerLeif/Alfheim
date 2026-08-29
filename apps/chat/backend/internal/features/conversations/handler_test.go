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
