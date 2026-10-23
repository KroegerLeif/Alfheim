package attachments

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/chat/internal/shared/attachmenturl"
	"alfheim/chat/internal/shared/householdclient"
	"alfheim/chat/internal/shared/middleware"
	"alfheim/chat/internal/shared/storage"
)

type mockAttachmentsService struct {
	uploadAttachmentFunc   func(ctx context.Context, userID string, householdID *string, filename string, contentType string, r io.Reader, size int64) (AttachmentResponseDTO, error)
	getAttachmentFunc      func(ctx context.Context, userID, householdID, id string) (AttachmentResponseDTO, error)
	ensureStorageReadyFunc func(ctx context.Context) error
}

func (m *mockAttachmentsService) UploadAttachment(ctx context.Context, userID string, householdID *string, filename string, contentType string, r io.Reader, size int64) (AttachmentResponseDTO, error) {
	if m.uploadAttachmentFunc != nil {
		return m.uploadAttachmentFunc(ctx, userID, householdID, filename, contentType, r, size)
	}
	return AttachmentResponseDTO{}, nil
}

func (m *mockAttachmentsService) GetAttachment(ctx context.Context, userID, householdID, id string) (AttachmentResponseDTO, error) {
	if m.getAttachmentFunc != nil {
		return m.getAttachmentFunc(ctx, userID, householdID, id)
	}
	return AttachmentResponseDTO{}, ErrAttachmentNotFound
}

func (m *mockAttachmentsService) OpenContent(ctx context.Context, userID, householdID, id string) (*Content, error) {
	return nil, ErrAttachmentNotFound
}

func (m *mockAttachmentsService) OpenContentWithToken(ctx context.Context, id, token string) (*Content, error) {
	return nil, ErrAttachmentNotFound
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
			claims := &middleware.UserClaims{Subject: userID}
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, claims)
			if hh, err := uuid.Parse(householdID); err == nil {
				ctx = middleware.ContextWithHousehold(ctx, &middleware.HouseholdContext{HouseholdID: hh, Role: householdclient.RoleMember, Subject: userID})
			}
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

		handler := NewHandler(mockSvc, 15*time.Minute, slog.Default())
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMiddleware("user-1", "11111111-1111-1111-1111-111111111111"))

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
		handler := NewHandler(&mockAttachmentsService{}, 15*time.Minute, slog.Default())
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMiddleware("user-1", "11111111-1111-1111-1111-111111111111"))

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
			getAttachmentFunc: func(ctx context.Context, userID, householdID, id string) (AttachmentResponseDTO, error) {
				if userID != "user-1" {
					t.Errorf("expected authenticated subject user-1 to be passed, got %q", userID)
				}
				return AttachmentResponseDTO{
					ID:         id,
					StorageKey: "users/u1/chat/uuid_img.jpg",
					MimeType:   "image/jpeg",
					SizeBytes:  2048,
					URL:        "http://localhost/storage/users/u1/chat/uuid_img.jpg",
				}, nil
			},
		}

		handler := NewHandler(mockSvc, 15*time.Minute, slog.Default())
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMiddleware("user-1", "11111111-1111-1111-1111-111111111111"))

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

	t.Run("Unauthorized when no claims present", func(t *testing.T) {
		handler := NewHandler(&mockAttachmentsService{}, 15*time.Minute, slog.Default())
		r := chi.NewRouter()
		handler.RegisterRoutes(r, func(next http.Handler) http.Handler { return next }) // no claims injected

		// Upload unauthorized
		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/attachments", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}

		// Get unauthorized
		reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/chat/attachments/att-1", nil)
		recGet := httptest.NewRecorder()
		r.ServeHTTP(recGet, reqGet)
		if recGet.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", recGet.Code)
		}
	})

	t.Run("Upload multipart parse error", func(t *testing.T) {
		handler := NewHandler(&mockAttachmentsService{}, 15*time.Minute, slog.Default())
		r := chi.NewRouter()
		handler.RegisterRoutes(r, mockAuthMiddleware("user-1", "11111111-1111-1111-1111-111111111111"))

		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/attachments", bytes.NewReader([]byte("not multipart")))
		req.Header.Set("Content-Type", "multipart/form-data; boundary=invalid-boundary")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("writeServiceError mapping in Get and Upload", func(t *testing.T) {
		tests := []struct {
			err          error
			expectedCode int
		}{
			{ErrAttachmentNotFound, http.StatusNotFound},
			{ErrForbidden, http.StatusForbidden},
			{ErrInvalidFileType, http.StatusBadRequest},
			{ErrEmptyFile, http.StatusBadRequest},
			{ErrFileTooLarge, http.StatusRequestEntityTooLarge},
			{errors.New("unexpected internal error"), http.StatusInternalServerError},
		}

		for _, tt := range tests {
			mockSvc := &mockAttachmentsService{
				getAttachmentFunc: func(ctx context.Context, userID, householdID, id string) (AttachmentResponseDTO, error) {
					return AttachmentResponseDTO{}, tt.err
				},
			}
			handler := NewHandler(mockSvc, 15*time.Minute, slog.Default())
			r := chi.NewRouter()
			handler.RegisterRoutes(r, mockAuthMiddleware("user-1", "11111111-1111-1111-1111-111111111111"))

			req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/attachments/att-1", nil)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedCode {
				t.Errorf("for error %v, expected status %d, got %d", tt.err, tt.expectedCode, rec.Code)
			}
		}
	})
}

func TestUploadWithoutHouseholdContextIsRejected(t *testing.T) {
	handler := NewHandler(&mockAttachmentsService{}, 15*time.Minute, slog.Default())
	r := chi.NewRouter()
	handler.RegisterRoutes(r, mockAuthMiddleware("user-1", ""))

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("file", "photo.png")
	_, _ = part.Write(samplePNG)
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/attachments", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

// bearerOnlyAuth models the production auth chain for the content route: a request
// without an Authorization header is rejected with 401, otherwise it is authenticated
// as user-1 acting in testHouseholdID.
func bearerOnlyAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		mockAuthMiddleware("user-1", testHouseholdID)(next).ServeHTTP(w, r)
	})
}

type contentFixture struct {
	router     http.Handler
	signer     *attachmenturl.Signer
	membership *fakeMembership
	downloads  *int
}

func newContentFixture(t *testing.T, ownerID, mime string, body string) contentFixture {
	t.Helper()
	signer := newTestSigner(t)
	membership := &fakeMembership{}
	downloads := 0
	repo := contentRepo(ownerID, ownKey)
	inner := repo.getImageRefByIDFunc
	repo.getImageRefByIDFunc = func(ctx context.Context, id string) (*ImageRef, error) {
		ref, err := inner(ctx, id)
		if ref != nil {
			ref.MimeType = mime
		}
		return ref, err
	}
	st := &mockStorageClient{downloadFunc: func(ctx context.Context, key string) (*storage.Object, error) {
		downloads++
		return &storage.Object{Body: io.NopCloser(strings.NewReader(body)), ContentType: "application/octet-stream", Size: int64(len(body))}, nil
	}}
	svc := NewService(repo, st, signer, membership, slog.Default())
	r := chi.NewRouter()
	NewHandler(svc, signer.TTL(), slog.Default()).RegisterRoutes(r, bearerOnlyAuth)
	return contentFixture{router: r, signer: signer, membership: membership, downloads: &downloads}
}

func serve(h http.Handler, target string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestContentEndpoint(t *testing.T) {
	const path = "/api/v1/chat/attachments/att-1/content"

	t.Run("a valid token streams the image with hardened headers", func(t *testing.T) {
		f := newContentFixture(t, "user-1", "image/png", "png-bytes")
		token, _ := f.signer.Sign("att-1", "user-1", testHouseholdID)

		rec := serve(f.router, path+"?token="+url.QueryEscape(token), nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
		}
		if rec.Body.String() != "png-bytes" {
			t.Errorf("body = %q", rec.Body.String())
		}
		want := map[string]string{
			"Content-Type":           "image/png",
			"Content-Disposition":    `inline; filename=receipt.png`,
			"X-Content-Type-Options": "nosniff",
			"Cache-Control":          "private, max-age=900",
			"Referrer-Policy":        "no-referrer",
			"Content-Length":         "9",
		}
		for k, v := range want {
			if got := rec.Header().Get(k); got != v {
				t.Errorf("%s = %q, want %q", k, got, v)
			}
		}
		if csp := rec.Header().Get("Content-Security-Policy"); !strings.Contains(csp, "sandbox") {
			t.Errorf("Content-Security-Policy = %q, want a sandboxing policy", csp)
		}
	})

	t.Run("non-image content is served as an attachment", func(t *testing.T) {
		f := newContentFixture(t, "user-1", "application/pdf", "%PDF")
		token, _ := f.signer.Sign("att-1", "user-1", testHouseholdID)
		rec := serve(f.router, path+"?token="+url.QueryEscape(token), nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d", rec.Code)
		}
		if got := rec.Header().Get("Content-Disposition"); !strings.HasPrefix(got, "attachment;") {
			t.Errorf("Content-Disposition = %q, want attachment", got)
		}
	})

	t.Run("a bearer token with household header works without a query token", func(t *testing.T) {
		f := newContentFixture(t, "user-1", "image/png", "png-bytes")
		rec := serve(f.router, path, map[string]string{"Authorization": "Bearer x"})
		if rec.Code != http.StatusOK || rec.Body.String() != "png-bytes" {
			t.Fatalf("status = %d body = %q", rec.Code, rec.Body.String())
		}
		if f.membership.calls != 0 {
			t.Error("the bearer path relies on the household middleware, not a second membership check")
		}
	})

	t.Run("no token and no bearer is 401 and never reaches storage", func(t *testing.T) {
		f := newContentFixture(t, "user-1", "image/png", "png-bytes")
		rec := serve(f.router, path, nil)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
		if *f.downloads != 0 {
			t.Error("storage must not be touched for an unauthenticated request")
		}
	})

	t.Run("an expired token is 401", func(t *testing.T) {
		f := newContentFixture(t, "user-1", "image/png", "png-bytes")
		expired, _ := attachmenturl.NewSigner(testSecret, time.Nanosecond, "")
		token, _ := expired.Sign("att-1", "user-1", testHouseholdID)
		// Expiry has one second resolution and truncates, so a 1ns ttl is already over.
		rec := serve(f.router, path+"?token="+url.QueryEscape(token), nil)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("a forged or foreign token is 401", func(t *testing.T) {
		f := newContentFixture(t, "user-1", "image/png", "png-bytes")
		stranger, _ := attachmenturl.NewSigner([]byte("ffffffffffffffffffffffffffffffff"), time.Minute, "")
		forged, _ := stranger.Sign("att-1", "user-1", testHouseholdID)
		for _, tok := range []string{forged, "garbage"} {
			rec := serve(f.router, path+"?token="+url.QueryEscape(tok), nil)
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("token %q: status = %d, want 401", tok, rec.Code)
			}
		}
		if *f.downloads != 0 {
			t.Error("storage must not be touched for an invalid token")
		}
	})

	t.Run("a token for another attachment is 401", func(t *testing.T) {
		f := newContentFixture(t, "user-1", "image/png", "png-bytes")
		token, _ := f.signer.Sign("att-2", "user-1", testHouseholdID)
		if rec := serve(f.router, path+"?token="+url.QueryEscape(token), nil); rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("another user's attachment is 404 even with a valid token", func(t *testing.T) {
		f := newContentFixture(t, "victim", "image/png", "png-bytes")
		token, _ := f.signer.Sign("att-1", "attacker", testHouseholdID)
		rec := serve(f.router, path+"?token="+url.QueryEscape(token), nil)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", rec.Code)
		}
		if *f.downloads != 0 {
			t.Error("storage must not be touched for a foreign attachment")
		}
	})

	t.Run("a removed household member is 403", func(t *testing.T) {
		f := newContentFixture(t, "user-1", "image/png", "png-bytes")
		f.membership.err = householdclient.ErrNotMember
		token, _ := f.signer.Sign("att-1", "user-1", testHouseholdID)
		if rec := serve(f.router, path+"?token="+url.QueryEscape(token), nil); rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", rec.Code)
		}
	})

	t.Run("an unreachable household service is 503", func(t *testing.T) {
		f := newContentFixture(t, "user-1", "image/png", "png-bytes")
		f.membership.err = householdclient.ErrUnavailable
		token, _ := f.signer.Sign("att-1", "user-1", testHouseholdID)
		if rec := serve(f.router, path+"?token="+url.QueryEscape(token), nil); rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503", rec.Code)
		}
	})
}
