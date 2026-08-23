package attachments

import "errors"

var (
	// ErrInvalidFileType indicates that the uploaded file MIME type is not allowed.
	ErrInvalidFileType = errors.New("invalid file type: only image/jpeg, image/png, and image/webp are allowed")
	// ErrFileTooLarge indicates that the uploaded file exceeds the 10MB limit.
	ErrFileTooLarge = errors.New("file size exceeds maximum limit of 10MB")
	// ErrEmptyFile indicates that the uploaded file payload contains 0 bytes.
	ErrEmptyFile = errors.New("uploaded file is empty")
	// ErrAttachmentNotFound indicates that the requested attachment ID does not exist in the database.
	ErrAttachmentNotFound = errors.New("attachment not found")
	// ErrForbidden indicates that the authenticated user lacks permission to access or modify this attachment.
	ErrForbidden = errors.New("forbidden: access to attachment denied")
)
