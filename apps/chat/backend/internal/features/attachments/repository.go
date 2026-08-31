package attachments

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"alfheim/chat/internal/shared/db"
)

// Repository defines data access operations for image attachment metadata.
type Repository interface {
	CreateImageRef(ctx context.Context, ref *ImageRef) error
	GetImageRefByID(ctx context.Context, id string) (*ImageRef, error)
	ListImageRefsByMessageID(ctx context.Context, messageID string) ([]*ImageRef, error)
	ListImageRefsByIDs(ctx context.Context, ids []string) ([]*ImageRef, error)
	LinkImageRefsToMessage(ctx context.Context, messageID string, ids []string) error
}

type repository struct {
	db db.DBTX
}

// NewRepository creates a PostgreSQL-backed repository for attachment metadata.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{db: pool}
}

func newRepositoryWithDB(db db.DBTX) Repository {
	return &repository{db: db}
}

const imageRefColumns = `
	id, message_id, storage_key, mime_type, size_bytes, created_at
`

func scanImageRef(row pgx.Row) (*ImageRef, error) {
	ref := &ImageRef{}
	err := row.Scan(
		&ref.ID, &ref.MessageID, &ref.StorageKey, &ref.MimeType, &ref.SizeBytes, &ref.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return ref, nil
}

func (r *repository) CreateImageRef(ctx context.Context, ref *ImageRef) error {
	ref.CreatedAt = time.Now()

	query := `
		INSERT INTO image_refs (id, message_id, storage_key, mime_type, size_bytes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.db.Exec(ctx, query,
		ref.ID, ref.MessageID, ref.StorageKey, ref.MimeType, ref.SizeBytes, ref.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert image_ref %s: %w", ref.ID, err)
	}
	return nil
}

func (r *repository) GetImageRefByID(ctx context.Context, id string) (*ImageRef, error) {
	query := `SELECT` + imageRefColumns + `FROM image_refs WHERE id = $1`

	ref, err := scanImageRef(r.db.QueryRow(ctx, query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAttachmentNotFound
		}
		return nil, fmt.Errorf("failed to query image_ref %s: %w", id, err)
	}
	return ref, nil
}

func (r *repository) ListImageRefsByMessageID(ctx context.Context, messageID string) ([]*ImageRef, error) {
	query := `SELECT` + imageRefColumns + `FROM image_refs WHERE message_id = $1 ORDER BY created_at ASC`

	rows, err := r.db.Query(ctx, query, messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to list image_refs for message %s: %w", messageID, err)
	}
	defer rows.Close()

	var results []*ImageRef
	for rows.Next() {
		ref, err := scanImageRef(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan image_ref row: %w", err)
		}
		results = append(results, ref)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate image_ref rows: %w", err)
	}
	return results, nil
}

func (r *repository) ListImageRefsByIDs(ctx context.Context, ids []string) ([]*ImageRef, error) {
	if len(ids) == 0 {
		return []*ImageRef{}, nil
	}

	query := `SELECT` + imageRefColumns + `FROM image_refs WHERE id = ANY($1) ORDER BY created_at ASC`

	rows, err := r.db.Query(ctx, query, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to query image_refs by ids: %w", err)
	}
	defer rows.Close()

	var results []*ImageRef
	for rows.Next() {
		ref, err := scanImageRef(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan image_ref row: %w", err)
		}
		results = append(results, ref)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate image_ref rows: %w", err)
	}
	return results, nil
}

func (r *repository) LinkImageRefsToMessage(ctx context.Context, messageID string, ids []string) error {
	if len(ids) == 0 {
		return nil
	}

	query := `UPDATE image_refs SET message_id = $1 WHERE id = ANY($2)`
	_, err := r.db.Exec(ctx, query, messageID, ids)
	if err != nil {
		return fmt.Errorf("failed to link image_refs to message %s: %w", messageID, err)
	}
	return nil
}
