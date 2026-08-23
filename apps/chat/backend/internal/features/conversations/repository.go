package conversations

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"alfheim/chat/internal/shared/storage"
)

// Repository defines data access operations for conversations and messages.
type Repository interface {
	CreateConversation(ctx context.Context, c *Conversation) error
	GetConversationByID(ctx context.Context, id string) (*Conversation, error)
	ListConversationsByOwner(ctx context.Context, ownerUserID string) ([]*Conversation, error)
	DeleteConversation(ctx context.Context, id string) error

	CreateMessage(ctx context.Context, m *Message, attachmentIDs ...string) error
	ListMessages(ctx context.Context, conversationID string) ([]*Message, error)
	// AppendMessageAndTouchConversation inserts m and bumps its conversation's
	// updated_at in a single transaction, used to persist the completed assistant
	// reply after an SSE stream finishes.
	AppendMessageAndTouchConversation(ctx context.Context, m *Message) error
}

type repository struct {
	pool    *pgxpool.Pool
	storage storage.Client
}

// NewRepository initializes a PostgreSQL-backed conversations repository.
func NewRepository(pool *pgxpool.Pool, storageClient storage.Client) Repository {
	return &repository{pool: pool, storage: storageClient}
}

const conversationColumns = `
	id, owner_user_id, household_id, source_app, source_context, model_block_id, title, created_at, updated_at
`

func scanConversation(row pgx.Row) (*Conversation, error) {
	c := &Conversation{}
	err := row.Scan(
		&c.ID, &c.OwnerUserID, &c.HouseholdID, &c.SourceApp, &c.SourceContext, &c.ModelBlockID, &c.Title,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return c, nil
}

const messageColumns = `
	id, conversation_id, role, content, tool_calls_json, mcp_server_id, token_usage_json, created_at
`

func scanMessage(row pgx.Row) (*Message, error) {
	m := &Message{}
	err := row.Scan(
		&m.ID, &m.ConversationID, &m.Role, &m.Content, &m.ToolCallsJSON, &m.MCPServerID, &m.TokenUsageJSON, &m.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (r *repository) CreateConversation(ctx context.Context, c *Conversation) error {
	now := time.Now()
	c.CreatedAt = now
	c.UpdatedAt = now

	query := `
		INSERT INTO conversations (id, owner_user_id, household_id, source_app, source_context, model_block_id, title, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.pool.Exec(ctx, query,
		c.ID, c.OwnerUserID, c.HouseholdID, c.SourceApp, c.SourceContext, c.ModelBlockID, c.Title, c.CreatedAt, c.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert conversation %s: %w", c.ID, err)
	}
	return nil
}

func (r *repository) GetConversationByID(ctx context.Context, id string) (*Conversation, error) {
	query := `SELECT` + conversationColumns + `FROM conversations WHERE id = $1`

	c, err := scanConversation(r.pool.QueryRow(ctx, query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to query conversation %s: %w", id, err)
	}
	return c, nil
}

func (r *repository) ListConversationsByOwner(ctx context.Context, ownerUserID string) ([]*Conversation, error) {
	query := `SELECT` + conversationColumns + `FROM conversations WHERE owner_user_id = $1 ORDER BY updated_at DESC`

	rows, err := r.pool.Query(ctx, query, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to list conversations for user %s: %w", ownerUserID, err)
	}
	defer rows.Close()

	var results []*Conversation
	for rows.Next() {
		c, err := scanConversation(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan conversation row: %w", err)
		}
		results = append(results, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate conversation rows: %w", err)
	}
	return results, nil
}

func (r *repository) DeleteConversation(ctx context.Context, id string) error {
	res, err := r.pool.Exec(ctx, `DELETE FROM conversations WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete conversation %s: %w", id, err)
	}
	if res.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *repository) CreateMessage(ctx context.Context, m *Message, attachmentIDs ...string) error {
	m.CreatedAt = time.Now()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	query := `
		INSERT INTO messages (id, conversation_id, role, content, tool_calls_json, mcp_server_id, token_usage_json, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err = tx.Exec(ctx, query,
		m.ID, m.ConversationID, m.Role, m.Content, m.ToolCallsJSON, m.MCPServerID, m.TokenUsageJSON, m.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert message %s: %w", m.ID, err)
	}

	if len(attachmentIDs) > 0 {
		_, err = tx.Exec(ctx, `UPDATE image_refs SET message_id = $1 WHERE id = ANY($2)`, m.ID, attachmentIDs)
		if err != nil {
			return fmt.Errorf("failed to link image_refs to message %s: %w", m.ID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit create message transaction: %w", err)
	}
	return nil
}

func (r *repository) ListMessages(ctx context.Context, conversationID string) ([]*Message, error) {
	query := `SELECT` + messageColumns + `FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`

	rows, err := r.pool.Query(ctx, query, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to list messages for conversation %s: %w", conversationID, err)
	}
	defer rows.Close()

	var results []*Message
	var messageIDs []string
	messageIndex := make(map[string]*Message)

	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message row: %w", err)
		}
		m.Attachments = make([]MessageAttachment, 0)
		results = append(results, m)
		messageIDs = append(messageIDs, m.ID)
		messageIndex[m.ID] = m
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate message rows: %w", err)
	}

	if len(messageIDs) > 0 {
		attQuery := `SELECT id, message_id, storage_key, mime_type, size_bytes, created_at FROM image_refs WHERE message_id = ANY($1) ORDER BY created_at ASC`
		attRows, err := r.pool.Query(ctx, attQuery, messageIDs)
		if err == nil {
			defer attRows.Close()
			for attRows.Next() {
				var a MessageAttachment
				if err := attRows.Scan(&a.ID, &a.MessageID, &a.StorageKey, &a.MimeType, &a.SizeBytes, &a.CreatedAt); err == nil {
					if r.storage != nil {
						a.URL = r.storage.GetPublicURL(a.StorageKey)
					}
					if a.MessageID != nil {
						if parent, exists := messageIndex[*a.MessageID]; exists {
							parent.Attachments = append(parent.Attachments, a)
						}
					}
				}
			}
		}
	}

	return results, nil
}

func (r *repository) AppendMessageAndTouchConversation(ctx context.Context, m *Message) error {
	m.CreatedAt = time.Now()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	_, err = tx.Exec(ctx, `
		INSERT INTO messages (id, conversation_id, role, content, tool_calls_json, mcp_server_id, token_usage_json, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, m.ID, m.ConversationID, m.Role, m.Content, m.ToolCallsJSON, m.MCPServerID, m.TokenUsageJSON, m.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert assistant message %s: %w", m.ID, err)
	}

	res, err := tx.Exec(ctx, `UPDATE conversations SET updated_at = $1 WHERE id = $2`, m.CreatedAt, m.ConversationID)
	if err != nil {
		return fmt.Errorf("failed to touch conversation %s: %w", m.ConversationID, err)
	}
	if res.RowsAffected() == 0 {
		return ErrNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}
