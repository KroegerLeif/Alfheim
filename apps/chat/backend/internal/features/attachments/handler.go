package attachments

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/chat/internal/shared/middleware"
)

// Handler manages image attachment upload and metadata HTTP endpoints.
type Handler struct {
	service Service
}

// NewHandler creates an attachments HTTP handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts attachment endpoints on a chi Router guarded by authMiddleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Post("/api/v1/chat/attachments", h.Upload)
		r.Get("/api/v1/chat/attachments/{id}", h.Get)
	})
}

// Upload handles multipart file upload (POST /api/v1/chat/attachments).
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	// Limit multipart memory parsing to 10MB + margin
	if err := r.ParseMultipartForm(MaxAttachmentSizeBytes + (1 << 20)); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "failed to parse multipart form or file too large")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "form field 'file' is required")
		return
	}
	defer file.Close()

	var householdID *string
	if claims.HouseholdID != "" {
		householdID = &claims.HouseholdID
	}

	contentType := header.Header.Get("Content-Type")
	dto, err := h.service.UploadAttachment(
		r.Context(),
		claims.Subject,
		householdID,
		header.Filename,
		contentType,
		file,
		header.Size,
	)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, dto)
}

// Get retrieves attachment metadata by ID (GET /api/v1/chat/attachments/{id}).
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	_, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "attachment id is required")
		return
	}

	dto, err := h.service.GetAttachment(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, dto)
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrAttachmentNotFound):
		writeError(w, http.StatusNotFound, "not_found", "attachment not found")
	case errors.Is(err, ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden", err.Error())
	case errors.Is(err, ErrInvalidFileType), errors.Is(err, ErrEmptyFile):
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
	case errors.Is(err, ErrFileTooLarge):
		writeError(w, http.StatusRequestEntityTooLarge, "file_too_large", err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to process attachment")
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
