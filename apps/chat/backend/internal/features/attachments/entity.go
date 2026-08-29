// Package attachments handles image attachment uploads, RustFS S3 storage integration,
// and image metadata persistence for chat conversations.
package attachments

import "time"

// ImageRef represents an uploaded image attachment stored in RustFS/S3.
type ImageRef struct {
	ID         string
	MessageID  *string
	StorageKey string
	MimeType   string
	SizeBytes  int64
	CreatedAt  time.Time
}
