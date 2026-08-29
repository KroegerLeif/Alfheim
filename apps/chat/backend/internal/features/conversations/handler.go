package conversations

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/chat/internal/shared/llm"
	"alfheim/chat/internal/shared/middleware"
)

// Handler manages conversation, message, and SSE streaming HTTP endpoints.
type Handler struct {
	service Service
}

// NewHandler creates a conversations HTTP handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts conversation endpoints on a chi Router, guarded by authMiddleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/chat/conversations", h.List)
		r.Post("/api/v1/chat/conversations", h.Create)
		r.Delete("/api/v1/chat/conversations/{id}", h.Delete)
		r.Get("/api/v1/chat/conversations/{id}/messages", h.ListMessages)
		r.Post("/api/v1/chat/conversations/{id}/messages", h.PostMessage)
		r.Get("/api/v1/chat/conversations/{id}/stream", h.Stream)
	})
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	convos, err := h.service.ListConversations(r.Context(), claims.Subject)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to list conversations")
		return
	}

	writeJSON(w, http.StatusOK, convos)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	var req CreateConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json request payload")
		return
	}

	created, err := h.service.CreateConversation(r.Context(), claims.Subject, claims.HouseholdID, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")
	if err := h.service.DeleteConversation(r.Context(), claims.Subject, id); err != nil {
		writeServiceError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListMessages(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")
	messages, err := h.service.ListMessages(r.Context(), claims.Subject, id)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, messages)
}

func (h *Handler) PostMessage(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")

	var req CreateMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json request payload")
		return
	}

	created, err := h.service.PostMessage(r.Context(), claims.Subject, id, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

// Stream handles GET /api/v1/chat/conversations/{id}/stream, streaming the assistant's
// reply to the conversation's pending user message as Server-Sent Events. Errors that
// occur before any bytes are written (auth, ownership, missing model block, ...) are
// reported as a normal JSON error response; errors that occur mid-stream are reported
// as an SSE "error" event instead, since response headers are already committed by then.
func (h *Handler) Stream(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")

	chunks, err := h.service.StreamAssistantReply(r.Context(), claims.Subject, claims.HouseholdID, id)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "internal_server_error", "streaming is not supported by this response writer")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable proxy buffering so deltas flush immediately
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	for chunk := range chunks {
		writeSSEChunk(w, chunk)
		flusher.Flush()
		if chunk.Done {
			break
		}
	}
}

// writeSSEChunk formats a single llm.StreamChunk as one Server-Sent Events frame.
// A chunk with both Err and Done set (a terminal mid-stream error) emits only the
// "error" event, not a duplicate "done" event.
func writeSSEChunk(w http.ResponseWriter, chunk llm.StreamChunk) {
	switch {
	case chunk.Err != nil:
		payload, _ := json.Marshal(map[string]string{"message": chunk.Err.Error()})
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", payload)
	case chunk.ToolCall != nil:
		payload, _ := json.Marshal(chunk.ToolCall)
		fmt.Fprintf(w, "event: tool_call\ndata: %s\n\n", payload)
	case chunk.Done:
		payload, _ := json.Marshal(map[string]any{"usage": chunk.Usage})
		fmt.Fprintf(w, "event: done\ndata: %s\n\n", payload)
	default:
		payload, _ := json.Marshal(map[string]string{"text": chunk.DeltaText})
		fmt.Fprintf(w, "event: delta\ndata: %s\n\n", payload)
	}
}

// writeServiceError maps domain errors to their corresponding HTTP status codes.
func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "conversation not found")
	case errors.Is(err, ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden", err.Error())
	case errors.Is(err, ErrModelBlockRequired), errors.Is(err, ErrEmptyMessageContent), errors.Is(err, ErrNoPendingUserMessage):
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
	case errors.Is(err, ErrModelBlockUnavailable):
		writeError(w, http.StatusUnprocessableEntity, "model_block_unavailable", err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to process conversation request")
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}
