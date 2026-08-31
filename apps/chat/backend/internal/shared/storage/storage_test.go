package storage

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	"alfheim/chat/config"
)

type mockS3API struct {
	headBucketFunc   func(ctx context.Context, params *s3.HeadBucketInput, optFns ...func(*s3.Options)) (*s3.HeadBucketOutput, error)
	createBucketFunc func(ctx context.Context, params *s3.CreateBucketInput, optFns ...func(*s3.Options)) (*s3.CreateBucketOutput, error)
	putObjectFunc    func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
	deleteObjectFunc func(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
}

func (m *mockS3API) HeadBucket(ctx context.Context, params *s3.HeadBucketInput, optFns ...func(*s3.Options)) (*s3.HeadBucketOutput, error) {
	if m.headBucketFunc != nil {
		return m.headBucketFunc(ctx, params, optFns...)
	}
	return &s3.HeadBucketOutput{}, nil
}

func (m *mockS3API) CreateBucket(ctx context.Context, params *s3.CreateBucketInput, optFns ...func(*s3.Options)) (*s3.CreateBucketOutput, error) {
	if m.createBucketFunc != nil {
		return m.createBucketFunc(ctx, params, optFns...)
	}
	return &s3.CreateBucketOutput{}, nil
}

func (m *mockS3API) PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	if m.putObjectFunc != nil {
		return m.putObjectFunc(ctx, params, optFns...)
	}
	return &s3.PutObjectOutput{}, nil
}

func (m *mockS3API) DeleteObject(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	if m.deleteObjectFunc != nil {
		return m.deleteObjectFunc(ctx, params, optFns...)
	}
	return &s3.DeleteObjectOutput{}, nil
}

type mockSmithyAPIError struct {
	code    string
	message string
}

func (m *mockSmithyAPIError) Error() string   { return m.message }
func (m *mockSmithyAPIError) ErrorCode() string { return m.code }
func (m *mockSmithyAPIError) ErrorMessage() string { return m.message }
func (m *mockSmithyAPIError) ErrorFault() smithy.ErrorFault { return smithy.FaultClient }

func TestKeyGenerationAndSanitization(t *testing.T) {
	t.Run("SanitizeFilename", func(t *testing.T) {
		tests := []struct {
			input    string
			expected string
		}{
			{"simple.png", "simple.png"},
			{"../../etc/passwd", "passwd"},
			{"my image (1).jpeg", "my_image__1_.jpeg"},
			{"", "attachment"},
			{"/", "attachment"},
			{".", "attachment"},
		}

		for _, tt := range tests {
			got := SanitizeFilename(tt.input)
			if got != tt.expected {
				t.Errorf("SanitizeFilename(%q) = %q, expected %q", tt.input, got, tt.expected)
			}
		}
	})

	t.Run("GenerateChatObjectKey household", func(t *testing.T) {
		hhID := "hh-123"
		key := GenerateChatObjectKey("user-456", &hhID, "photo.png")
		if !strings.HasPrefix(key, "households/hh-123/chat/") {
			t.Errorf("expected household prefix, got %q", key)
		}
		if !strings.HasSuffix(key, "_photo.png") {
			t.Errorf("expected _photo.png suffix, got %q", key)
		}
	})

	t.Run("GenerateChatObjectKey private user", func(t *testing.T) {
		key := GenerateChatObjectKey("user-456", nil, "photo.png")
		if !strings.HasPrefix(key, "users/user-456/chat/") {
			t.Errorf("expected user prefix, got %q", key)
		}
		if !strings.HasSuffix(key, "_photo.png") {
			t.Errorf("expected _photo.png suffix, got %q", key)
		}
	})
}

func TestStorageClientOperations(t *testing.T) {
	cfg := config.StorageConfig{
		BucketName: "alfheim-assets",
		PublicURL:  "http://api.alfheim.loegien.localhost/storage",
	}

	t.Run("GetPublicURL", func(t *testing.T) {
		mock := &mockS3API{}
		client := NewWithAPI(mock, cfg)
		url := client.GetPublicURL("households/123/chat/abc_pic.png")
		expected := "http://api.alfheim.loegien.localhost/storage/households/123/chat/abc_pic.png"
		if url != expected {
			t.Errorf("GetPublicURL = %q, expected %q", url, expected)
		}
	})

	t.Run("EnsureBucketExists when exists", func(t *testing.T) {
		headCalled := false
		mock := &mockS3API{
			headBucketFunc: func(ctx context.Context, params *s3.HeadBucketInput, optFns ...func(*s3.Options)) (*s3.HeadBucketOutput, error) {
				headCalled = true
				if *params.Bucket != "alfheim-assets" {
					t.Errorf("unexpected bucket: %s", *params.Bucket)
				}
				return &s3.HeadBucketOutput{}, nil
			},
		}
		client := NewWithAPI(mock, cfg)
		if err := client.EnsureBucketExists(context.Background()); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !headCalled {
			t.Errorf("expected headBucket to be called")
		}
	})

	t.Run("EnsureBucketExists creates bucket when missing", func(t *testing.T) {
		createCalled := false
		mock := &mockS3API{
			headBucketFunc: func(ctx context.Context, params *s3.HeadBucketInput, optFns ...func(*s3.Options)) (*s3.HeadBucketOutput, error) {
				return nil, &mockSmithyAPIError{code: "NotFound", message: "Not Found"}
			},
			createBucketFunc: func(ctx context.Context, params *s3.CreateBucketInput, optFns ...func(*s3.Options)) (*s3.CreateBucketOutput, error) {
				createCalled = true
				return &s3.CreateBucketOutput{}, nil
			},
		}
		client := NewWithAPI(mock, cfg)
		if err := client.EnsureBucketExists(context.Background()); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !createCalled {
			t.Errorf("expected createBucket to be called")
		}
	})

	t.Run("Upload and Delete", func(t *testing.T) {
		putCalled := false
		deleteCalled := false
		mock := &mockS3API{
			putObjectFunc: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
				putCalled = true
				if *params.Key != "test-key" || *params.ContentType != "image/png" {
					t.Errorf("unexpected put params: %v", params)
				}
				return &s3.PutObjectOutput{}, nil
			},
			deleteObjectFunc: func(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
				deleteCalled = true
				if *params.Key != "test-key" {
					t.Errorf("unexpected delete key: %s", *params.Key)
				}
				return &s3.DeleteObjectOutput{}, nil
			},
		}
		client := NewWithAPI(mock, cfg)
		body := bytes.NewReader([]byte("test data"))
		if err := client.Upload(context.Background(), "test-key", body, 9, "image/png"); err != nil {
			t.Fatalf("Upload failed: %v", err)
		}
		if !putCalled {
			t.Errorf("expected putObject to be called")
		}

		if err := client.Delete(context.Background(), "test-key"); err != nil {
			t.Fatalf("Delete failed: %v", err)
		}
		if !deleteCalled {
			t.Errorf("expected deleteObject to be called")
		}
	})

	t.Run("Upload error", func(t *testing.T) {
		mock := &mockS3API{
			putObjectFunc: func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
				return nil, errors.New("s3 connection timeout")
			},
		}
		client := NewWithAPI(mock, cfg)
		err := client.Upload(context.Background(), "key", bytes.NewReader([]byte("test")), 4, "image/jpeg")
		if err == nil {
			t.Fatalf("expected upload error, got nil")
		}
	})

	t.Run("EnsureBucketExists head error and create error", func(t *testing.T) {
		mock := &mockS3API{
			headBucketFunc: func(ctx context.Context, params *s3.HeadBucketInput, optFns ...func(*s3.Options)) (*s3.HeadBucketOutput, error) {
				return nil, errors.New("random head bucket error")
			},
			createBucketFunc: func(ctx context.Context, params *s3.CreateBucketInput, optFns ...func(*s3.Options)) (*s3.CreateBucketOutput, error) {
				return nil, errors.New("fallback create error")
			},
		}
		client := NewWithAPI(mock, cfg)
		if err := client.EnsureBucketExists(context.Background()); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("EnsureBucketExists create error", func(t *testing.T) {
		mock := &mockS3API{
			headBucketFunc: func(ctx context.Context, params *s3.HeadBucketInput, optFns ...func(*s3.Options)) (*s3.HeadBucketOutput, error) {
				return nil, &mockSmithyAPIError{code: "NotFound", message: "Not Found"}
			},
			createBucketFunc: func(ctx context.Context, params *s3.CreateBucketInput, optFns ...func(*s3.Options)) (*s3.CreateBucketOutput, error) {
				return nil, errors.New("create bucket error")
			},
		}
		client := NewWithAPI(mock, cfg)
		if err := client.EnsureBucketExists(context.Background()); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("Delete error", func(t *testing.T) {
		mock := &mockS3API{
			deleteObjectFunc: func(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
				return nil, errors.New("delete error")
			},
		}
		client := NewWithAPI(mock, cfg)
		if err := client.Delete(context.Background(), "key"); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("NewClient initializes client", func(t *testing.T) {
		c, err := NewClient(context.Background(), cfg)
		if err != nil {
			t.Fatalf("unexpected error initializing storage client: %v", err)
		}
		if c == nil {
			t.Fatal("expected non-nil client")
		}
	})
}
