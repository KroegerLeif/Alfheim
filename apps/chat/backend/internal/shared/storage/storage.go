// Package storage provides an S3-compatible client for RustFS object storage integration
// and tenant-isolated object key generation.
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
	"github.com/google/uuid"

	"alfheim/chat/config"
)

// Client defines S3 object storage operations used by chat-backend features.
type Client interface {
	EnsureBucketExists(ctx context.Context) error
	Upload(ctx context.Context, key string, body io.Reader, size int64, contentType string) error
	Delete(ctx context.Context, key string) error
	GetPublicURL(key string) string
}

// S3API abstracts the raw AWS SDK s3.Client calls for easy unit testing with mocks.
type S3API interface {
	HeadBucket(ctx context.Context, params *s3.HeadBucketInput, optFns ...func(*s3.Options)) (*s3.HeadBucketOutput, error)
	CreateBucket(ctx context.Context, params *s3.CreateBucketInput, optFns ...func(*s3.Options)) (*s3.CreateBucketOutput, error)
	PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
	DeleteObject(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
}

type s3Client struct {
	api S3API
	cfg config.StorageConfig
}

// NewClient initializes a new S3/RustFS storage client from configuration.
func NewClient(ctx context.Context, cfg config.StorageConfig) (Client, error) {
	credProvider := credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")

	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:               cfg.Endpoint,
			SigningRegion:     cfg.Region,
			HostnameImmutable: true,
		}, nil
	})

	awsCfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(cfg.Region),
		awsconfig.WithCredentialsProvider(credProvider),
		awsconfig.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load aws sdk config: %w", err)
	}

	rawS3 := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	return &s3Client{
		api: rawS3,
		cfg: cfg,
	}, nil
}

// NewWithAPI creates a storage client wrapping a custom or mock S3API.
func NewWithAPI(api S3API, cfg config.StorageConfig) Client {
	return &s3Client{
		api: api,
		cfg: cfg,
	}
}

// EnsureBucketExists verifies that the configured S3 bucket exists, creating it if absent.
func (c *s3Client) EnsureBucketExists(ctx context.Context) error {
	_, err := c.api.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(c.cfg.BucketName),
	})
	if err == nil {
		return nil
	}

	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		code := apiErr.ErrorCode()
		if code == "NotFound" || code == "NoSuchBucket" || strings.Contains(code, "404") {
			_, createErr := c.api.CreateBucket(ctx, &s3.CreateBucketInput{
				Bucket: aws.String(c.cfg.BucketName),
			})
			if createErr != nil {
				return fmt.Errorf("failed to create s3 bucket %q: %w", c.cfg.BucketName, createErr)
			}
			return nil
		}
	}

	// For compatibility with mock endpoints or generic errors
	_, createErr := c.api.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(c.cfg.BucketName),
	})
	if createErr != nil {
		return fmt.Errorf("failed to ensure s3 bucket %q exists: %w", c.cfg.BucketName, createErr)
	}
	return nil
}

// Upload writes a payload to the configured S3 bucket with specified metadata.
func (c *s3Client) Upload(ctx context.Context, key string, body io.Reader, size int64, contentType string) error {
	input := &s3.PutObjectInput{
		Bucket:        aws.String(c.cfg.BucketName),
		Key:           aws.String(key),
		Body:          body,
		ContentLength: size,
	}
	if contentType != "" {
		input.ContentType = aws.String(contentType)
	}

	_, err := c.api.PutObject(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to upload object %q to s3: %w", key, err)
	}
	return nil
}

// Delete removes an object from the configured S3 bucket.
func (c *s3Client) Delete(ctx context.Context, key string) error {
	_, err := c.api.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.cfg.BucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete object %q from s3: %w", key, err)
	}
	return nil
}

// GetPublicURL returns the public HTTP gateway URL for accessing the object.
func (c *s3Client) GetPublicURL(key string) string {
	baseURL := strings.TrimRight(c.cfg.PublicURL, "/")
	cleanKey := strings.TrimLeft(key, "/")
	return fmt.Sprintf("%s/%s", baseURL, cleanKey)
}

// GenerateChatObjectKey constructs a tenant-isolated storage key matching Alfheim conventions.
// Households: households/{household_id}/chat/{uuid}_{filename}
// Private: users/{user_id}/chat/{uuid}_{filename}
func GenerateChatObjectKey(userID string, householdID *string, filename string) string {
	cleanFilename := SanitizeFilename(filename)
	fileUUID := uuid.NewString()

	if householdID != nil && *householdID != "" {
		return fmt.Sprintf("households/%s/chat/%s_%s", *householdID, fileUUID, cleanFilename)
	}
	return fmt.Sprintf("users/%s/chat/%s_%s", userID, fileUUID, cleanFilename)
}

// SanitizeFilename normalizes an attachment filename by removing path elements and unsafe characters.
func SanitizeFilename(filename string) string {
	base := filepath.Base(filename)
	if base == "." || base == "/" || base == "" {
		return "attachment"
	}

	var b strings.Builder
	for _, r := range base {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	res := b.String()
	if res == "" {
		return "attachment"
	}
	return res
}
