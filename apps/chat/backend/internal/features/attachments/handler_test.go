package attachments

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"alfheim/chat/internal/shared/middleware"
)

type mockAttachmentsService struct {
	uploadAttachmentFunc   func(ctx context.Context, userID string, householdID *string, filename string, contentType string, r io.Reader, size int64) (AttachmentResponseDTO, error)
	getAttachmentFunc      func(ctx context.Context, id string) (AttachmentResponseDTO, error)
	ensureStorageReadyFunc func(ctx context.Context) error
}

func (m *mockAttachmentsService) UploadAttachment(ctx context.Context, userID string, householdID *string, filename string, contentType string, r io.Reader, size int64) (AttachmentResponseDTO, error) {
	if m.uploadAttachmentFunc != nil {
		return m.uploadAttachmentFunc(ctx, userID, householdID, filename, contentType, r, size)
	}
	return AttachmentResponseDTO{}, nil
}

func (m *mockAttachmentsService) GetAttachment(ctx context.Context, id string) (AttachmentResponseDTO, error) {
	if m.getAttachmentFunc != nil {
		return m.getAttachmentFunc(ctx, id)
	}
	return AttachmentResponseDTO{}, ErrAttachmentNotFound
}

func (m *mockAttachmentsService) EnsureStorageReady(ctx context.Context) error {
	if m.ensureStorageReadyFunc != nil {
		return m.ensureStorageReadyFunc(ctx)
	}
	return nil
}

func mockAuthMiddleware(userID, householdID string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := &middleware.UserClaims{
				Subject:     userID,
				HouseholdID: householdID,
			}
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func TestAttachmentsHandler(t *testing.T) {
	t.Run("POST /api/v1/chat/attachments success", func(t *testing.T) {
		mockSvc := &mockAttachmentsService{
			uploadAttachmentFunc: func(ctx context.Context, userID string, householdID *string, filename string, contentType string, r io.Reader, size int64) (AttachmentResponseDTO, error) {
				return AttachmentResponseDTO{
					ID:         "att-123",
					StorageKey: "households/hh-1/chat/uuid_photo.png",
					MimeType:   "image/png",
					SizeBytes:  size,
					URL:        "http://localhost/storage/households/hh-1/chat/uuid_photo.png",
					CreatedAt:  time.Now(),
				}, nil
			},
		}

		handler := NewHandler(mockSvc)
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMiddleware("user-1", "hh-1"))

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("file", "photo.png")
		if err != nil {
			t.Fatalf("failed to create form file: %v", err)
		}
		_, _ = part.Write(samplePNG)
		_ = writer.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/attachments", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
		}

		var resp AttachmentResponseDTO
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to parse response: %v", err)
		}
		if resp.ID != "att-123" {
			t.Errorf("expected ID att-123, got %s", resp.ID)
		}
	})

	t.Run("POST /api/v1/chat/attachments missing file part", func(t *testing.T) {
		handler := NewHandler(&mockAttachmentsService{})
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMiddleware("user-1", "hh-1"))

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		_ = writer.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/attachments", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("GET /api/v1/chat/attachments/{id} success", func(t *testing.T) {
		mockSvc := &mockAttachmentsService{
			getAttachmentFunc: func(ctx context.Context, id string) (AttachmentResponseDTO, error) {
				return AttachmentResponseDTO{
					ID:         id,
					StorageKey: "users/u1/chat/uuid_img.jpg",
					MimeType:   "image/jpeg",
					SizeBytes:  2048,
					URL:        "http://localhost/storage/users/u1/chat/uuid_img.jpg",
				}, nil
			},
		}

		handler := NewHandler(mockSvc)
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMiddleware("user-1", "hh-1"))

		req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/attachments/att-456", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", rec.Code)
		}

		var resp AttachmentResponseDTO
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode json: %v", err)
		}
		if resp.ID != "att-456" {
			t.Errorf("expected att-456, got %s", resp.ID)
		}
	})
}
