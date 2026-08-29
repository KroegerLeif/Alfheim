package attachments

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"alfheim/chat/internal/shared/storage"
)

// MaxAttachmentSizeBytes defines the maximum allowed attachment file size (10 MB).
const MaxAttachmentSizeBytes = 10 * 1024 * 1024

var allowedMimeTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

// Service defines domain logic for image attachment upload and metadata retrieval.
type Service interface {
	UploadAttachment(ctx context.Context, userID string, householdID *string, filename string, contentType string, r io.Reader, size int64) (AttachmentResponseDTO, error)
	GetAttachment(ctx context.Context, id string) (AttachmentResponseDTO, error)
	EnsureStorageReady(ctx context.Context) error
}

type service struct {
	repo    Repository
	storage storage.Client
	log     *slog.Logger
}

// NewService creates a new attachments service instance.
func NewService(repo Repository, storageClient storage.Client, log *slog.Logger) Service {
	return &service{
		repo:    repo,
		storage: storageClient,
		log:     log,
	}
}

func (s *service) EnsureStorageReady(ctx context.Context) error {
	if s.storage == nil {
		return nil
	}
	return s.storage.EnsureBucketExists(ctx)
}

func (s *service) UploadAttachment(
	ctx context.Context,
	userID string,
	householdID *string,
	filename string,
	contentType string,
	r io.Reader,
	size int64,
) (AttachmentResponseDTO, error) {
	if size <= 0 {
		return AttachmentResponseDTO{}, ErrEmptyFile
	}
	if size > MaxAttachmentSizeBytes {
		return AttachmentResponseDTO{}, ErrFileTooLarge
	}

	// Read first 512 bytes for MIME type sniffing and verification
	headerBuf := make([]byte, 512)
	n, err := io.ReadFull(r, headerBuf)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return AttachmentResponseDTO{}, fmt.Errorf("failed to read file header: %w", err)
	}

	detectedMime := http.DetectContentType(headerBuf[:n])
	// Strip parameter part e.g. "image/png; charset=utf-8"
	if idx := strings.Index(detectedMime, ";"); idx != -1 {
		detectedMime = strings.TrimSpace(detectedMime[:idx])
	}

	// Reconstruct reader with the sniffed header
	fullReader := io.MultiReader(bytes.NewReader(headerBuf[:n]), r)

	resolvedMime := strings.ToLower(strings.TrimSpace(contentType))
	if idx := strings.Index(resolvedMime, ";"); idx != -1 {
		resolvedMime = strings.TrimSpace(resolvedMime[:idx])
	}

	// Whitelist verification: both supplied and detected MIME should be checked
	if !allowedMimeTypes[resolvedMime] && !allowedMimeTypes[detectedMime] {
		return AttachmentResponseDTO{}, ErrInvalidFileType
	}
	if allowedMimeTypes[detectedMime] {
		resolvedMime = detectedMime
	}

	storageKey := storage.GenerateChatObjectKey(userID, householdID, filename)

	if err := s.storage.Upload(ctx, storageKey, fullReader, size, resolvedMime); err != nil {
		s.log.Error("failed to upload attachment to s3", slog.String("key", storageKey), slog.String("error", err.Error()))
		return AttachmentResponseDTO{}, fmt.Errorf("failed to upload file to storage: %w", err)
	}

	ref := &ImageRef{
		ID:         uuid.NewString(),
		StorageKey: storageKey,
		MimeType:   resolvedMime,
		SizeBytes:  size,
	}

	if err := s.repo.CreateImageRef(ctx, ref); err != nil {
		// Attempt to cleanup storage object if DB insert fails
		_ = s.storage.Delete(ctx, storageKey)
		s.log.Error("failed to persist image ref", slog.String("id", ref.ID), slog.String("error", err.Error()))
		return AttachmentResponseDTO{}, fmt.Errorf("failed to save attachment metadata: %w", err)
	}

	url := s.storage.GetPublicURL(storageKey)
	s.log.Info("successfully uploaded attachment", slog.String("id", ref.ID), slog.String("key", storageKey), slog.Int64("size", size))

	return ToAttachmentResponse(ref, url), nil
}

func (s *service) GetAttachment(ctx context.Context, id string) (AttachmentResponseDTO, error) {
	ref, err := s.repo.GetImageRefByID(ctx, id)
	if err != nil {
		return AttachmentResponseDTO{}, err
	}
	url := s.storage.GetPublicURL(ref.StorageKey)
	return ToAttachmentResponse(ref, url), nil
}
