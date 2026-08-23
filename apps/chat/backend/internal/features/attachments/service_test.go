package attachments

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"
)

type mockStorageClient struct {
	ensureBucketExistsFunc func(ctx context.Context) error
	uploadFunc             func(ctx context.Context, key string, body io.Reader, size int64, contentType string) error
	deleteFunc             func(ctx context.Context, key string) error
	getPublicURLFunc       func(key string) string
}

func (m *mockStorageClient) EnsureBucketExists(ctx context.Context) error {
	if m.ensureBucketExistsFunc != nil {
		return m.ensureBucketExistsFunc(ctx)
	}
	return nil
}

func (m *mockStorageClient) Upload(ctx context.Context, key string, body io.Reader, size int64, contentType string) error {
	if m.uploadFunc != nil {
		return m.uploadFunc(ctx, key, body, size, contentType)
	}
	return nil
}

func (m *mockStorageClient) Delete(ctx context.Context, key string) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, key)
	}
	return nil
}

func (m *mockStorageClient) GetPublicURL(key string) string {
	if m.getPublicURLFunc != nil {
		return m.getPublicURLFunc(key)
	}
	return "http://localhost/storage/" + key
}

type mockRepository struct {
	createImageRefFunc         func(ctx context.Context, ref *ImageRef) error
	getImageRefByIDFunc        func(ctx context.Context, id string) (*ImageRef, error)
	listImageRefsByMessageIDFunc func(ctx context.Context, messageID string) ([]*ImageRef, error)
	listImageRefsByIDsFunc     func(ctx context.Context, ids []string) ([]*ImageRef, error)
	linkImageRefsToMessageFunc func(ctx context.Context, messageID string, ids []string) error
}

func (m *mockRepository) CreateImageRef(ctx context.Context, ref *ImageRef) error {
	if m.createImageRefFunc != nil {
		return m.createImageRefFunc(ctx, ref)
	}
	return nil
}

func (m *mockRepository) GetImageRefByID(ctx context.Context, id string) (*ImageRef, error) {
	if m.getImageRefByIDFunc != nil {
		return m.getImageRefByIDFunc(ctx, id)
	}
	return nil, ErrAttachmentNotFound
}

func (m *mockRepository) ListImageRefsByMessageID(ctx context.Context, messageID string) ([]*ImageRef, error) {
	if m.listImageRefsByMessageIDFunc != nil {
		return m.listImageRefsByMessageIDFunc(ctx, messageID)
	}
	return []*ImageRef{}, nil
}

func (m *mockRepository) ListImageRefsByIDs(ctx context.Context, ids []string) ([]*ImageRef, error) {
	if m.listImageRefsByIDsFunc != nil {
		return m.listImageRefsByIDsFunc(ctx, ids)
	}
	return []*ImageRef{}, nil
}

func (m *mockRepository) LinkImageRefsToMessage(ctx context.Context, messageID string, ids []string) error {
	if m.linkImageRefsToMessageFunc != nil {
		return m.linkImageRefsToMessageFunc(ctx, messageID, ids)
	}
	return nil
}

// Sample valid 8-byte PNG header
var samplePNG = []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x00, 0x00, 0x00, 0x0D, 'I', 'H', 'D', 'R'}

func TestUploadAttachment(t *testing.T) {
	log := slog.Default()

	t.Run("successful upload with household scope", func(t *testing.T) {
		repoCreated := false
		storageUploaded := false

		mockRepo := &mockRepository{
			createImageRefFunc: func(ctx context.Context, ref *ImageRef) error {
				repoCreated = true
				if ref.MimeType != "image/png" {
					t.Errorf("expected mime image/png, got %s", ref.MimeType)
				}
				return nil
			},
		}
		mockStorage := &mockStorageClient{
			uploadFunc: func(ctx context.Context, key string, body io.Reader, size int64, contentType string) error {
				storageUploaded = true
				return nil
			},
		}

		svc := NewService(mockRepo, mockStorage, log)
		hhID := "hh-42"
		reader := bytes.NewReader(samplePNG)

		dto, err := svc.UploadAttachment(context.Background(), "user-1", &hhID, "photo.png", "image/png", reader, int64(len(samplePNG)))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !repoCreated || !storageUploaded {
			t.Errorf("expected repo and storage to be called")
		}
		if dto.URL == "" || dto.StorageKey == "" {
			t.Errorf("expected populated dto, got %+v", dto)
		}
	})

	t.Run("empty file rejected", func(t *testing.T) {
		svc := NewService(&mockRepository{}, &mockStorageClient{}, log)
		_, err := svc.UploadAttachment(context.Background(), "user-1", nil, "test.png", "image/png", bytes.NewReader([]byte{}), 0)
		if !errors.Is(err, ErrEmptyFile) {
			t.Errorf("expected ErrEmptyFile, got %v", err)
		}
	})

	t.Run("file too large rejected", func(t *testing.T) {
		svc := NewService(&mockRepository{}, &mockStorageClient{}, log)
		_, err := svc.UploadAttachment(context.Background(), "user-1", nil, "test.png", "image/png", bytes.NewReader([]byte{}), MaxAttachmentSizeBytes+1)
		if !errors.Is(err, ErrFileTooLarge) {
			t.Errorf("expected ErrFileTooLarge, got %v", err)
		}
	})

	t.Run("invalid mime type rejected", func(t *testing.T) {
		svc := NewService(&mockRepository{}, &mockStorageClient{}, log)
		pdfHeader := []byte("%PDF-1.4 header contents")
		_, err := svc.UploadAttachment(context.Background(), "user-1", nil, "doc.pdf", "application/pdf", bytes.NewReader(pdfHeader), int64(len(pdfHeader)))
		if !errors.Is(err, ErrInvalidFileType) {
			t.Errorf("expected ErrInvalidFileType, got %v", err)
		}
	})

	t.Run("storage upload failure", func(t *testing.T) {
		mockStorage := &mockStorageClient{
			uploadFunc: func(ctx context.Context, key string, body io.Reader, size int64, contentType string) error {
				return errors.New("s3 upload failed")
			},
		}
		svc := NewService(&mockRepository{}, mockStorage, log)
		_, err := svc.UploadAttachment(context.Background(), "user-1", nil, "test.png", "image/png", bytes.NewReader(samplePNG), int64(len(samplePNG)))
		if err == nil {
			t.Fatalf("expected error on storage failure")
		}
	})
}

func TestGetAttachment(t *testing.T) {
	log := slog.Default()

	t.Run("get existing attachment", func(t *testing.T) {
		mockRepo := &mockRepository{
			getImageRefByIDFunc: func(ctx context.Context, id string) (*ImageRef, error) {
				return &ImageRef{
					ID:         id,
					StorageKey: "users/u1/chat/pic.png",
					MimeType:   "image/png",
					SizeBytes:  1024,
					CreatedAt:  time.Now(),
				}, nil
			},
		}
		svc := NewService(mockRepo, &mockStorageClient{}, log)
		dto, err := svc.GetAttachment(context.Background(), "att-1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if dto.ID != "att-1" {
			t.Errorf("expected att-1, got %s", dto.ID)
		}
	})

	t.Run("get non-existent attachment", func(t *testing.T) {
		svc := NewService(&mockRepository{}, &mockStorageClient{}, log)
		_, err := svc.GetAttachment(context.Background(), "missing")
		if !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("expected ErrAttachmentNotFound, got %v", err)
		}
	})
}
