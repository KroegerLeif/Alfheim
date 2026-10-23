package attachments

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path"
	"strings"

	"github.com/google/uuid"

	"alfheim/chat/internal/shared/attachmenturl"
	"alfheim/chat/internal/shared/householdclient"
	"alfheim/chat/internal/shared/storage"
)

// MaxAttachmentSizeBytes defines the maximum allowed attachment file size (10 MB).
const MaxAttachmentSizeBytes = 10 * 1024 * 1024

// MaxUploadBodyBytes caps the whole multipart upload request: the attachment
// plus 1 MiB of multipart framing and form fields.
const MaxUploadBodyBytes = MaxAttachmentSizeBytes + (1 << 20)

var allowedMimeTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

// Content is an attachment opened for download. The caller must close Body.
type Content struct {
	Body     io.ReadCloser
	MimeType string
	Filename string
	Size     int64
}

// Service defines domain logic for image attachment upload, metadata retrieval and download.
type Service interface {
	UploadAttachment(ctx context.Context, userID string, householdID *string, filename string, contentType string, r io.Reader, size int64) (AttachmentResponseDTO, error)
	GetAttachment(ctx context.Context, userID, householdID, id string) (AttachmentResponseDTO, error)
	// OpenContent streams an attachment for a caller authenticated by bearer token
	// whose household membership the request middleware already verified.
	OpenContent(ctx context.Context, userID, householdID, id string) (*Content, error)
	// OpenContentWithToken streams an attachment for the identity a signed download
	// token was issued to, after re-checking that identity's household membership.
	OpenContentWithToken(ctx context.Context, id, token string) (*Content, error)
	EnsureStorageReady(ctx context.Context) error
}

type service struct {
	repo       Repository
	storage    storage.Client
	signer     *attachmenturl.Signer
	membership householdclient.Checker
	log        *slog.Logger
}

// NewService creates a new attachments service instance. signer issues and verifies
// download URLs; membership re-checks household membership for token downloads.
func NewService(repo Repository, storageClient storage.Client, signer *attachmenturl.Signer, membership householdclient.Checker, log *slog.Logger) Service {
	return &service{
		repo:       repo,
		storage:    storageClient,
		signer:     signer,
		membership: membership,
		log:        log,
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
	if householdID == nil || *householdID == "" {
		return AttachmentResponseDTO{}, ErrHouseholdRequired
	}
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
		ID:          uuid.NewString(),
		OwnerUserID: userID,
		StorageKey:  storageKey,
		MimeType:    resolvedMime,
		SizeBytes:   size,
	}

	if err := s.repo.CreateImageRef(ctx, ref); err != nil {
		// Attempt to cleanup storage object if DB insert fails
		_ = s.storage.Delete(ctx, storageKey)
		s.log.Error("failed to persist image ref", slog.String("id", ref.ID), slog.String("error", err.Error()))
		return AttachmentResponseDTO{}, fmt.Errorf("failed to save attachment metadata: %w", err)
	}

	s.log.Info("successfully uploaded attachment", slog.String("id", ref.ID), slog.String("key", storageKey), slog.Int64("size", size))

	url, err := s.signer.URL(ref.ID, userID, *householdID)
	if err != nil {
		return AttachmentResponseDTO{}, fmt.Errorf("failed to build attachment url: %w", err)
	}
	return ToAttachmentResponse(ref, url), nil
}

// authorizedRef loads an attachment and enforces that userID uploaded it and that
// its object lives in householdID's (or the user's own) storage namespace. Anything
// else is reported as not found so attachment IDs cannot be probed.
func (s *service) authorizedRef(ctx context.Context, userID, householdID, id string) (*ImageRef, error) {
	ref, err := s.repo.GetImageRefByID(ctx, id)
	if err != nil {
		return nil, err
	}
	// A legacy row without an owner is owned by nobody.
	if ref.OwnerUserID == "" || ref.OwnerUserID != userID {
		return nil, ErrAttachmentNotFound
	}
	inHousehold := householdID != "" && strings.HasPrefix(ref.StorageKey, "households/"+householdID+"/")
	inPrivateSpace := strings.HasPrefix(ref.StorageKey, "users/"+userID+"/")
	if !inHousehold && !inPrivateSpace {
		return nil, ErrAttachmentNotFound
	}
	return ref, nil
}

func (s *service) GetAttachment(ctx context.Context, userID, householdID, id string) (AttachmentResponseDTO, error) {
	ref, err := s.authorizedRef(ctx, userID, householdID, id)
	if err != nil {
		return AttachmentResponseDTO{}, err
	}
	url, err := s.signer.URL(ref.ID, userID, householdID)
	if err != nil {
		return AttachmentResponseDTO{}, fmt.Errorf("failed to build attachment url: %w", err)
	}
	return ToAttachmentResponse(ref, url), nil
}

func (s *service) OpenContent(ctx context.Context, userID, householdID, id string) (*Content, error) {
	ref, err := s.authorizedRef(ctx, userID, householdID, id)
	if err != nil {
		return nil, err
	}
	return s.open(ctx, ref)
}

func (s *service) OpenContentWithToken(ctx context.Context, id, token string) (*Content, error) {
	claims, err := s.signer.Verify(id, token)
	if err != nil {
		return nil, ErrInvalidToken
	}
	householdUUID, err := uuid.Parse(claims.HouseholdID)
	if err != nil {
		return nil, ErrInvalidToken
	}
	// The token outlives a membership change by up to its TTL; the membership
	// check closes that window. It fails closed when core/household is unreachable.
	if _, err := s.membership.CheckMembership(ctx, householdUUID, claims.UserID); err != nil {
		if errors.Is(err, householdclient.ErrNotMember) {
			return nil, ErrForbidden
		}
		s.log.Error("household membership check failed for attachment download", slog.String("error", err.Error()))
		return nil, ErrMembershipUnavailable
	}
	ref, err := s.authorizedRef(ctx, claims.UserID, householdUUID.String(), id)
	if err != nil {
		return nil, err
	}
	return s.open(ctx, ref)
}

func (s *service) open(ctx context.Context, ref *ImageRef) (*Content, error) {
	obj, err := s.storage.Download(ctx, ref.StorageKey)
	if err != nil {
		if errors.Is(err, storage.ErrObjectNotFound) {
			s.log.Warn("attachment object missing in storage", slog.String("id", ref.ID), slog.String("key", ref.StorageKey))
			return nil, ErrAttachmentNotFound
		}
		return nil, fmt.Errorf("failed to read attachment %s from storage: %w", ref.ID, err)
	}
	size := obj.Size
	if size <= 0 {
		size = ref.SizeBytes
	}
	return &Content{Body: obj.Body, MimeType: ref.MimeType, Filename: filenameFromKey(ref.StorageKey), Size: size}, nil
}

// filenameFromKey recovers the sanitized upload name from a key ending in
// "<uuid>_<filename>".
func filenameFromKey(key string) string {
	base := path.Base(key)
	if len(base) > 37 && base[36] == '_' {
		return base[37:]
	}
	return base
}
