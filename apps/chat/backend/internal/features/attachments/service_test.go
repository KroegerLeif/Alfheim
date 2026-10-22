package attachments

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"alfheim/chat/internal/shared/attachmenturl"
	"alfheim/chat/internal/shared/householdclient"
	"alfheim/chat/internal/shared/storage"
)

type mockStorageClient struct {
	ensureBucketExistsFunc func(ctx context.Context) error
	uploadFunc             func(ctx context.Context, key string, body io.Reader, size int64, contentType string) error
	deleteFunc             func(ctx context.Context, key string) error
	downloadFunc           func(ctx context.Context, key string) (*storage.Object, error)
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

func (m *mockStorageClient) Download(ctx context.Context, key string) (*storage.Object, error) {
	if m.downloadFunc != nil {
		return m.downloadFunc(ctx, key)
	}
	return &storage.Object{Body: io.NopCloser(strings.NewReader("")), ContentType: "image/png"}, nil
}

var testHouseholdID = "11111111-1111-1111-1111-111111111111"

// testSecret is a 32 byte HMAC key for the signer under test.
var testSecret = []byte("0123456789abcdef0123456789abcdef")

func newTestSigner(t *testing.T) *attachmenturl.Signer {
	t.Helper()
	signer, err := attachmenturl.NewSigner(testSecret, 15*time.Minute, "")
	if err != nil {
		t.Fatal(err)
	}
	return signer
}

// fakeMembership answers CheckMembership from a fixed result.
type fakeMembership struct {
	err   error
	calls int
}

func (f *fakeMembership) CheckMembership(ctx context.Context, householdID uuid.UUID, userSub string) (householdclient.Membership, error) {
	f.calls++
	if f.err != nil {
		return householdclient.Membership{}, f.err
	}
	return householdclient.Membership{HouseholdID: householdID, UserID: userSub, Role: householdclient.RoleMember}, nil
}

type mockRepository struct {
	createImageRefFunc           func(ctx context.Context, ref *ImageRef) error
	getImageRefByIDFunc          func(ctx context.Context, id string) (*ImageRef, error)
	listImageRefsByMessageIDFunc func(ctx context.Context, messageID string) ([]*ImageRef, error)
	listImageRefsByIDsFunc       func(ctx context.Context, ids []string) ([]*ImageRef, error)
	linkImageRefsToMessageFunc   func(ctx context.Context, messageID string, ids []string) error
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
				if ref.OwnerUserID == "" {
					t.Errorf("expected owner user id to be recorded on upload")
				}
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

		svc := NewService(mockRepo, mockStorage, newTestSigner(t), &fakeMembership{}, log)
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
		svc := NewService(&mockRepository{}, &mockStorageClient{}, newTestSigner(t), &fakeMembership{}, log)
		_, err := svc.UploadAttachment(context.Background(), "user-1", &testHouseholdID, "test.png", "image/png", bytes.NewReader([]byte{}), 0)
		if !errors.Is(err, ErrEmptyFile) {
			t.Errorf("expected ErrEmptyFile, got %v", err)
		}
	})

	t.Run("file too large rejected", func(t *testing.T) {
		svc := NewService(&mockRepository{}, &mockStorageClient{}, newTestSigner(t), &fakeMembership{}, log)
		_, err := svc.UploadAttachment(context.Background(), "user-1", &testHouseholdID, "test.png", "image/png", bytes.NewReader([]byte{}), MaxAttachmentSizeBytes+1)
		if !errors.Is(err, ErrFileTooLarge) {
			t.Errorf("expected ErrFileTooLarge, got %v", err)
		}
	})

	t.Run("invalid mime type rejected", func(t *testing.T) {
		svc := NewService(&mockRepository{}, &mockStorageClient{}, newTestSigner(t), &fakeMembership{}, log)
		pdfHeader := []byte("%PDF-1.4 header contents")
		_, err := svc.UploadAttachment(context.Background(), "user-1", &testHouseholdID, "doc.pdf", "application/pdf", bytes.NewReader(pdfHeader), int64(len(pdfHeader)))
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
		svc := NewService(&mockRepository{}, mockStorage, newTestSigner(t), &fakeMembership{}, log)
		_, err := svc.UploadAttachment(context.Background(), "user-1", &testHouseholdID, "test.png", "image/png", bytes.NewReader(samplePNG), int64(len(samplePNG)))
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
					ID:          id,
					OwnerUserID: "u1",
					StorageKey:  "users/u1/chat/pic.png",
					MimeType:    "image/png",
					SizeBytes:   1024,
					CreatedAt:   time.Now(),
				}, nil
			},
		}
		svc := NewService(mockRepo, &mockStorageClient{}, newTestSigner(t), &fakeMembership{}, log)
		dto, err := svc.GetAttachment(context.Background(), "u1", testHouseholdID, "att-1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if dto.ID != "att-1" {
			t.Errorf("expected att-1, got %s", dto.ID)
		}
	})

	t.Run("get non-existent attachment", func(t *testing.T) {
		svc := NewService(&mockRepository{}, &mockStorageClient{}, newTestSigner(t), &fakeMembership{}, log)
		_, err := svc.GetAttachment(context.Background(), "u1", testHouseholdID, "missing")
		if !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("expected ErrAttachmentNotFound, got %v", err)
		}
	})

	t.Run("attachment owned by another user is reported as not found", func(t *testing.T) {
		mockRepo := &mockRepository{
			getImageRefByIDFunc: func(ctx context.Context, id string) (*ImageRef, error) {
				return &ImageRef{ID: id, OwnerUserID: "victim", StorageKey: "users/victim/chat/pic.png"}, nil
			},
		}
		svc := NewService(mockRepo, &mockStorageClient{}, newTestSigner(t), &fakeMembership{}, log)
		_, err := svc.GetAttachment(context.Background(), "attacker", testHouseholdID, "att-1")
		if !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("expected ErrAttachmentNotFound, got %v", err)
		}
	})

	t.Run("legacy attachment without owner is reported as not found", func(t *testing.T) {
		mockRepo := &mockRepository{
			getImageRefByIDFunc: func(ctx context.Context, id string) (*ImageRef, error) {
				return &ImageRef{ID: id, StorageKey: "users/u1/chat/pic.png"}, nil
			},
		}
		svc := NewService(mockRepo, &mockStorageClient{}, newTestSigner(t), &fakeMembership{}, log)
		_, err := svc.GetAttachment(context.Background(), "u1", testHouseholdID, "att-1")
		if !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("expected ErrAttachmentNotFound, got %v", err)
		}
	})

	t.Run("repo creation failure triggers storage delete rollback", func(t *testing.T) {
		deletedKey := ""
		mockStorage := &mockStorageClient{
			uploadFunc: func(ctx context.Context, key string, body io.Reader, size int64, contentType string) error {
				return nil
			},
			deleteFunc: func(ctx context.Context, key string) error {
				deletedKey = key
				return nil
			},
		}
		mockRepo := &mockRepository{
			createImageRefFunc: func(ctx context.Context, ref *ImageRef) error {
				return errors.New("db insert failure")
			},
		}
		svc := NewService(mockRepo, mockStorage, newTestSigner(t), &fakeMembership{}, log)
		hhID := "hh-42"
		_, err := svc.UploadAttachment(context.Background(), "user-1", &hhID, "photo.png", "image/png", bytes.NewReader(samplePNG), int64(len(samplePNG)))
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if deletedKey == "" {
			t.Errorf("expected rollback delete to be called")
		}
	})
}

func TestEnsureStorageReady(t *testing.T) {
	log := slog.Default()

	t.Run("nil storage client", func(t *testing.T) {
		svc := NewService(&mockRepository{}, nil, newTestSigner(t), &fakeMembership{}, log)
		if err := svc.EnsureStorageReady(context.Background()); err != nil {
			t.Errorf("expected nil error, got %v", err)
		}
	})

	t.Run("valid storage client calls EnsureBucketExists", func(t *testing.T) {
		called := false
		mockStorage := &mockStorageClient{
			ensureBucketExistsFunc: func(ctx context.Context) error {
				called = true
				return nil
			},
		}
		svc := NewService(&mockRepository{}, mockStorage, newTestSigner(t), &fakeMembership{}, log)
		if err := svc.EnsureStorageReady(context.Background()); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if !called {
			t.Errorf("expected EnsureBucketExists to be called")
		}
	})
}

func TestUploadAttachment_RequiresHousehold(t *testing.T) {
	uploaded := false
	svc := NewService(&mockRepository{}, &mockStorageClient{
		uploadFunc: func(ctx context.Context, key string, body io.Reader, size int64, contentType string) error {
			uploaded = true
			return nil
		},
	}, newTestSigner(t), &fakeMembership{}, slog.Default())

	empty := ""
	for _, hh := range []*string{nil, &empty} {
		_, err := svc.UploadAttachment(context.Background(), "user-1", hh, "photo.png", "image/png", bytes.NewReader(samplePNG), int64(len(samplePNG)))
		if !errors.Is(err, ErrHouseholdRequired) {
			t.Errorf("UploadAttachment(household=%v) error = %v, want ErrHouseholdRequired", hh, err)
		}
	}
	if uploaded {
		t.Error("nothing may be written to storage without a household")
	}
}

func TestUploadAndGetReturnSignedContentURLs(t *testing.T) {
	signer := newTestSigner(t)
	var stored *ImageRef
	repo := &mockRepository{
		createImageRefFunc: func(ctx context.Context, ref *ImageRef) error {
			stored = ref
			return nil
		},
		getImageRefByIDFunc: func(ctx context.Context, id string) (*ImageRef, error) {
			return stored, nil
		},
	}
	svc := NewService(repo, &mockStorageClient{}, signer, &fakeMembership{}, slog.Default())

	uploaded, err := svc.UploadAttachment(context.Background(), "user-1", &testHouseholdID, "photo.png", "image/png", bytes.NewReader(samplePNG), int64(len(samplePNG)))
	if err != nil {
		t.Fatal(err)
	}
	fetched, err := svc.GetAttachment(context.Background(), "user-1", testHouseholdID, uploaded.ID)
	if err != nil {
		t.Fatal(err)
	}

	for name, raw := range map[string]string{"upload": uploaded.URL, "get": fetched.URL} {
		u, err := url.Parse(raw)
		if err != nil {
			t.Fatal(err)
		}
		if u.Path != "/api/v1/chat/attachments/"+uploaded.ID+"/content" {
			t.Errorf("%s: path = %q, want the content endpoint", name, u.Path)
		}
		if strings.Contains(raw, stored.StorageKey) {
			t.Errorf("%s: url %q leaks the storage key", name, raw)
		}
		claims, err := signer.Verify(uploaded.ID, u.Query().Get("token"))
		if err != nil {
			t.Fatalf("%s: token does not verify: %v", name, err)
		}
		if claims.UserID != "user-1" || claims.HouseholdID != testHouseholdID {
			t.Errorf("%s: token bound to %+v", name, claims)
		}
	}
}

func contentRepo(ownerID, key string) *mockRepository {
	return &mockRepository{
		getImageRefByIDFunc: func(ctx context.Context, id string) (*ImageRef, error) {
			return &ImageRef{ID: id, OwnerUserID: ownerID, StorageKey: key, MimeType: "image/png", SizeBytes: 3}, nil
		},
	}
}

func downloadOf(body string) *mockStorageClient {
	return &mockStorageClient{
		downloadFunc: func(ctx context.Context, key string) (*storage.Object, error) {
			return &storage.Object{Body: io.NopCloser(strings.NewReader(body)), ContentType: "application/octet-stream", Size: int64(len(body))}, nil
		},
	}
}

const ownKey = "households/11111111-1111-1111-1111-111111111111/chat/0b9c0b4e-5f0a-4c5e-9c43-0d2f6f3a1a11_receipt.png"

func TestOpenContent(t *testing.T) {
	ctx := context.Background()
	log := slog.Default()

	t.Run("owner streams the object with the stored mime type and recovered filename", func(t *testing.T) {
		svc := NewService(contentRepo("user-1", ownKey), downloadOf("abc"), newTestSigner(t), &fakeMembership{}, log)
		c, err := svc.OpenContent(ctx, "user-1", testHouseholdID, "att-1")
		if err != nil {
			t.Fatal(err)
		}
		defer c.Body.Close()
		data, _ := io.ReadAll(c.Body)
		if string(data) != "abc" || c.MimeType != "image/png" || c.Filename != "receipt.png" || c.Size != 3 {
			t.Errorf("content = %q %+v", data, c)
		}
	})

	t.Run("another user gets not found", func(t *testing.T) {
		svc := NewService(contentRepo("victim", ownKey), downloadOf("abc"), newTestSigner(t), &fakeMembership{}, log)
		if _, err := svc.OpenContent(ctx, "attacker", testHouseholdID, "att-1"); !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("error = %v, want ErrAttachmentNotFound", err)
		}
	})

	t.Run("the object must live in the caller's household namespace", func(t *testing.T) {
		svc := NewService(contentRepo("user-1", ownKey), downloadOf("abc"), newTestSigner(t), &fakeMembership{}, log)
		otherHousehold := "22222222-2222-2222-2222-222222222222"
		if _, err := svc.OpenContent(ctx, "user-1", otherHousehold, "att-1"); !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("error = %v, want ErrAttachmentNotFound", err)
		}
	})

	t.Run("a legacy private-space object is served to its owner only", func(t *testing.T) {
		svc := NewService(contentRepo("u1", "users/u1/chat/x_pic.png"), downloadOf("abc"), newTestSigner(t), &fakeMembership{}, log)
		if c, err := svc.OpenContent(ctx, "u1", testHouseholdID, "att-1"); err != nil {
			t.Errorf("owner: %v", err)
		} else {
			_ = c.Body.Close()
		}
		svc = NewService(contentRepo("u1", "users/u2/chat/x_pic.png"), downloadOf("abc"), newTestSigner(t), &fakeMembership{}, log)
		if _, err := svc.OpenContent(ctx, "u1", testHouseholdID, "att-1"); !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("foreign private space: error = %v, want ErrAttachmentNotFound", err)
		}
	})

	t.Run("an object missing from storage is not found", func(t *testing.T) {
		st := &mockStorageClient{downloadFunc: func(ctx context.Context, key string) (*storage.Object, error) {
			return nil, storage.ErrObjectNotFound
		}}
		svc := NewService(contentRepo("user-1", ownKey), st, newTestSigner(t), &fakeMembership{}, log)
		if _, err := svc.OpenContent(ctx, "user-1", testHouseholdID, "att-1"); !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("error = %v, want ErrAttachmentNotFound", err)
		}
	})

	t.Run("a storage failure is an internal error", func(t *testing.T) {
		st := &mockStorageClient{downloadFunc: func(ctx context.Context, key string) (*storage.Object, error) {
			return nil, errors.New("s3 down")
		}}
		svc := NewService(contentRepo("user-1", ownKey), st, newTestSigner(t), &fakeMembership{}, log)
		_, err := svc.OpenContent(ctx, "user-1", testHouseholdID, "att-1")
		if err == nil || errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("error = %v, want a non-not-found error", err)
		}
	})
}

func TestOpenContentWithToken(t *testing.T) {
	ctx := context.Background()
	log := slog.Default()
	signer := newTestSigner(t)

	token := func(att, user, hh string) string {
		tok, err := signer.Sign(att, user, hh)
		if err != nil {
			t.Fatal(err)
		}
		return tok
	}

	t.Run("a valid token streams the object", func(t *testing.T) {
		m := &fakeMembership{}
		svc := NewService(contentRepo("user-1", ownKey), downloadOf("abc"), signer, m, log)
		c, err := svc.OpenContentWithToken(ctx, "att-1", token("att-1", "user-1", testHouseholdID))
		if err != nil {
			t.Fatal(err)
		}
		_ = c.Body.Close()
		if m.calls != 1 {
			t.Errorf("membership checked %d times, want 1", m.calls)
		}
	})

	t.Run("a tampered, foreign or garbage token is invalid", func(t *testing.T) {
		svc := NewService(contentRepo("user-1", ownKey), downloadOf("abc"), signer, &fakeMembership{}, log)
		for name, tok := range map[string]string{
			"token for another attachment": token("att-2", "user-1", testHouseholdID),
			"garbage":                      "not-a-token",
			"too few segments":             "a.b",
		} {
			if _, err := svc.OpenContentWithToken(ctx, "att-1", tok); !errors.Is(err, ErrInvalidToken) {
				t.Errorf("%s: error = %v, want ErrInvalidToken", name, err)
			}
		}
	})

	t.Run("a token for a non-uuid household is invalid", func(t *testing.T) {
		svc := NewService(contentRepo("user-1", ownKey), downloadOf("abc"), signer, &fakeMembership{}, log)
		if _, err := svc.OpenContentWithToken(ctx, "att-1", token("att-1", "user-1", "not-a-uuid")); !errors.Is(err, ErrInvalidToken) {
			t.Errorf("error = %v, want ErrInvalidToken", err)
		}
	})

	t.Run("a removed member is forbidden although the token is still valid", func(t *testing.T) {
		svc := NewService(contentRepo("user-1", ownKey), downloadOf("abc"), signer, &fakeMembership{err: householdclient.ErrNotMember}, log)
		if _, err := svc.OpenContentWithToken(ctx, "att-1", token("att-1", "user-1", testHouseholdID)); !errors.Is(err, ErrForbidden) {
			t.Errorf("error = %v, want ErrForbidden", err)
		}
	})

	t.Run("an unreachable household service fails closed", func(t *testing.T) {
		svc := NewService(contentRepo("user-1", ownKey), downloadOf("abc"), signer, &fakeMembership{err: householdclient.ErrUnavailable}, log)
		if _, err := svc.OpenContentWithToken(ctx, "att-1", token("att-1", "user-1", testHouseholdID)); !errors.Is(err, ErrMembershipUnavailable) {
			t.Errorf("error = %v, want ErrMembershipUnavailable", err)
		}
	})

	t.Run("a token issued to another user cannot read someone else's attachment", func(t *testing.T) {
		svc := NewService(contentRepo("victim", ownKey), downloadOf("abc"), signer, &fakeMembership{}, log)
		if _, err := svc.OpenContentWithToken(ctx, "att-1", token("att-1", "attacker", testHouseholdID)); !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("error = %v, want ErrAttachmentNotFound", err)
		}
	})

	t.Run("a token for another household cannot read this household's object", func(t *testing.T) {
		svc := NewService(contentRepo("user-1", ownKey), downloadOf("abc"), signer, &fakeMembership{}, log)
		if _, err := svc.OpenContentWithToken(ctx, "att-1", token("att-1", "user-1", "22222222-2222-2222-2222-222222222222")); !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("error = %v, want ErrAttachmentNotFound", err)
		}
	})
}

func TestFilenameFromKey(t *testing.T) {
	cases := map[string]string{
		ownKey:                         "receipt.png",
		"users/u1/chat/short_name.png": "short_name.png",
		"plain":                        "plain",
	}
	for key, want := range cases {
		if got := filenameFromKey(key); got != want {
			t.Errorf("filenameFromKey(%q) = %q, want %q", key, got, want)
		}
	}
}
