package attachments

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"alfheim/chat/internal/shared/middleware"
)

// Handler manages image attachment upload and metadata HTTP endpoints.
type Handler struct {
	service  Service
	cacheTTL time.Duration
	log      *slog.Logger
}

// NewHandler creates an attachments HTTP handler. cacheTTL bounds how long a browser
// may reuse a downloaded attachment; it should not exceed the download token's TTL.
func NewHandler(service Service, cacheTTL time.Duration, log *slog.Logger) *Handler {
	return &Handler{service: service, cacheTTL: cacheTTL, log: log}
}

// RegisterRoutes mounts attachment endpoints on a chi Router guarded by authMiddleware.
// The content route is the one exception: it is also reachable with a signed
// `?token=` query parameter instead of a bearer token (see Content).
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Post("/api/v1/chat/attachments", h.Upload)
		r.Get("/api/v1/chat/attachments/{id}", h.Get)
	})
	r.Get("/api/v1/chat/attachments/{id}/content", h.Content(authMiddleware))
}

// Upload handles multipart file upload (POST /api/v1/chat/attachments).
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	// ParseMultipartForm's argument only bounds memory (the rest spills to disk),
	// so the request body itself is capped explicitly.
	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadBodyBytes)
	if err := r.ParseMultipartForm(MaxUploadBodyBytes); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "payload_too_large", "attachment exceeds the maximum allowed size")
			return
		}
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
	if hc, err := middleware.GetHousehold(r.Context()); err == nil {
		hh := hc.HouseholdID.String()
		householdID = &hh
	}
	if householdID == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing household context")
		return
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
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "attachment id is required")
		return
	}

	hc, err := middleware.GetHousehold(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing household context")
		return
	}

	dto, err := h.service.GetAttachment(r.Context(), claims.Subject, hc.HouseholdID.String(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, dto)
}

// Content streams the attachment bytes (GET /api/v1/chat/attachments/{id}/content).
//
// An <img> element cannot send an Authorization header, so a request carrying a
// `token` query parameter is authorized by that signed, short-lived token alone
// (the service re-checks household membership and ownership). A request without
// one must pass authMiddleware (bearer token plus X-Household-ID), so an
// unauthenticated request without a token is rejected with 401.
func (h *Handler) Content(authMiddleware func(http.Handler) http.Handler) http.HandlerFunc {
	bearer := authMiddleware(http.HandlerFunc(h.contentWithBearer))
	return func(w http.ResponseWriter, r *http.Request) {
		// The URL carries a credential: never leak it through Referer or caches.
		w.Header().Set("Referrer-Policy", "no-referrer")

		if token := r.URL.Query().Get("token"); token != "" {
			id := chi.URLParam(r, "id")
			content, err := h.service.OpenContentWithToken(r.Context(), id, token)
			h.writeContent(w, content, err)
			return
		}
		bearer.ServeHTTP(w, r)
	}
}

func (h *Handler) contentWithBearer(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}
	hc, err := middleware.GetHousehold(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing household context")
		return
	}

	content, err := h.service.OpenContent(r.Context(), claims.Subject, hc.HouseholdID.String(), chi.URLParam(r, "id"))
	h.writeContent(w, content, err)
}

func (h *Handler) writeContent(w http.ResponseWriter, content *Content, err error) {
	if err != nil {
		writeServiceError(w, err)
		return
	}
	defer content.Body.Close()

	disposition := "attachment"
	if strings.HasPrefix(content.MimeType, "image/") {
		disposition = "inline"
	}
	header := w.Header()
	header.Set("Content-Type", content.MimeType)
	header.Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": content.Filename}))
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("Content-Security-Policy", "default-src 'none'; sandbox")
	header.Set("Cache-Control", "private, max-age="+strconv.Itoa(int(h.cacheTTL.Seconds())))
	if content.Size > 0 {
		header.Set("Content-Length", strconv.FormatInt(content.Size, 10))
	}
	w.WriteHeader(http.StatusOK)
	if _, err := io.Copy(w, content.Body); err != nil {
		// Headers are already sent; the client sees a truncated body.
		h.log.Warn("attachment stream aborted", slog.String("error", err.Error()))
	}
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrAttachmentNotFound):
		writeError(w, http.StatusNotFound, "not_found", "attachment not found")
	case errors.Is(err, ErrInvalidToken):
		writeError(w, http.StatusUnauthorized, "unauthorized", "invalid or expired attachment token")
	case errors.Is(err, ErrMembershipUnavailable):
		writeError(w, http.StatusServiceUnavailable, "service_unavailable", err.Error())
	case errors.Is(err, ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden", err.Error())
	case errors.Is(err, ErrInvalidFileType), errors.Is(err, ErrEmptyFile), errors.Is(err, ErrHouseholdRequired):
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
