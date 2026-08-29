package attachments

import "time"

// AttachmentResponseDTO represents the JSON serialization model for an uploaded attachment.
type AttachmentResponseDTO struct {
	ID         string    `json:"id"`
	MessageID  *string   `json:"message_id,omitempty"`
	StorageKey string    `json:"storage_key"`
	MimeType   string    `json:"mime_type"`
	SizeBytes  int64     `json:"size_bytes"`
	URL        string    `json:"url"`
	CreatedAt  time.Time `json:"created_at"`
}

// ToAttachmentResponse converts an ImageRef entity and its public URL to an AttachmentResponseDTO.
func ToAttachmentResponse(ref *ImageRef, url string) AttachmentResponseDTO {
	return AttachmentResponseDTO{
		ID:         ref.ID,
		MessageID:  ref.MessageID,
		StorageKey: ref.StorageKey,
		MimeType:   ref.MimeType,
		SizeBytes:  ref.SizeBytes,
		URL:        url,
		CreatedAt:  ref.CreatedAt,
	}
}
