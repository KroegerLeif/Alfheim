package homeassistant

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"alfheim/go-shared/db"
)

// ErrNoWebhook means no webhook secret exists for the plugin row.
var ErrNoWebhook = errors.New("webhook is not set up")

// SealedSecret is a stored webhook secret with the household of its plugin row.
type SealedSecret struct {
	HouseholdID uuid.UUID
	Sealed      []byte
	KeyID       string
}

// SecretStore keeps the sealed webhook secret of each plugin row
// (integration_webhooks). The household is the plugin row's, written when an
// admin of that household generated the secret.
type SecretStore interface {
	Put(ctx context.Context, pluginID, householdID uuid.UUID, sealed []byte, keyID string) error
	Get(ctx context.Context, pluginID uuid.UUID) (SealedSecret, error)
}

type secretStore struct {
	db db.DBTX
}

// NewSecretStore returns the PostgreSQL secret store on conn.
func NewSecretStore(conn db.DBTX) SecretStore {
	return &secretStore{db: conn}
}

func (s *secretStore) Put(ctx context.Context, pluginID, householdID uuid.UUID, sealed []byte, keyID string) error {
	_, err := s.db.Exec(ctx, `INSERT INTO integration_webhooks (plugin_id, household_id, secret_encrypted, secret_key_id)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (plugin_id) DO UPDATE SET secret_encrypted = EXCLUDED.secret_encrypted,
			secret_key_id = EXCLUDED.secret_key_id, updated_at = NOW()
		WHERE integration_webhooks.household_id = EXCLUDED.household_id`,
		pluginID, householdID, sealed, keyID)
	if err != nil {
		return fmt.Errorf("store webhook secret: %w", err)
	}
	return nil
}

// Get reads the secret by plugin row id; the join keeps only a row whose
// plugin still belongs to the same household.
func (s *secretStore) Get(ctx context.Context, pluginID uuid.UUID) (SealedSecret, error) {
	var out SealedSecret
	err := s.db.QueryRow(ctx, `SELECT w.household_id, w.secret_encrypted, w.secret_key_id
		FROM integration_webhooks w JOIN household_plugins p
			ON p.id = w.plugin_id AND p.household_id = w.household_id
		WHERE w.plugin_id = $1 AND p.type = $2`, pluginID, Type).Scan(&out.HouseholdID, &out.Sealed, &out.KeyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return SealedSecret{}, ErrNoWebhook
	}
	if err != nil {
		return SealedSecret{}, fmt.Errorf("read webhook secret: %w", err)
	}
	return out, nil
}
