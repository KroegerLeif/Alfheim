package conversations

import "errors"

var (
	// ErrNotFound indicates the requested conversation does not exist.
	ErrNotFound = errors.New("conversation not found")
	// ErrForbidden indicates the caller does not own this conversation.
	ErrForbidden = errors.New("caller does not own this conversation")
	// ErrModelBlockRequired indicates a conversation was created without a model
	// block id; since there is no endpoint to set one later in this phase, it must
	// be supplied up front.
	ErrModelBlockRequired = errors.New("model_block_id is required")
	// ErrEmptyMessageContent indicates a message was posted with no content.
	ErrEmptyMessageContent = errors.New("message content must not be empty")
	// ErrNoPendingUserMessage indicates the stream endpoint was called but the
	// conversation's last message is not an unanswered user message.
	ErrNoPendingUserMessage = errors.New("conversation has no pending user message to respond to")
	// ErrModelBlockUnavailable wraps any failure to resolve the conversation's model
	// block into a usable provider (not found, no longer visible to the caller,
	// missing encryption key, unimplemented provider type, ...). The underlying cause
	// is preserved via %w for logging, but callers outside this package only need to
	// know "this conversation's model is currently unusable" rather than every
	// modelblocks-specific failure mode.
	ErrModelBlockUnavailable = errors.New("configured model block is not currently usable")
)
