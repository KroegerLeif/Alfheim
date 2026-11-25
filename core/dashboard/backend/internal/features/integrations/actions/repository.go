package actions

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"alfheim/go-shared/db"
)

// ErrRuleNotFound means the household has no such rule.
var ErrRuleNotFound = errors.New("rule not found")

// RecentEvents is how many events the audit list shows.
const RecentEvents = 20

// Repository stores rules and events. Every method filters by the household
// that the membership check or the plugin row confirmed.
type Repository interface {
	ListRules(ctx context.Context, householdID uuid.UUID, pluginType string) ([]Rule, error)
	SaveRule(ctx context.Context, rule *Rule) error
	DeleteRule(ctx context.Context, householdID uuid.UUID, pluginType string, id uuid.UUID) error
	// FindRule returns the enabled rule for eventType, or ErrRuleNotFound.
	FindRule(ctx context.Context, householdID uuid.UUID, pluginType, eventType string) (Rule, error)
	// InsertEvent stores a new event as received. When the plugin already has
	// the event id it stores nothing and returns false with the stored status.
	InsertEvent(ctx context.Context, ev Event) (bool, Status, error)
	FinishEvent(ctx context.Context, ev Event, action string, res Result) error
	RecentEvents(ctx context.Context, householdID uuid.UUID, pluginType string) ([]Record, error)
}

type repository struct {
	db db.DBTX
}

// NewRepository returns the PostgreSQL repository on conn.
func NewRepository(conn db.DBTX) Repository {
	return &repository{db: conn}
}

const ruleColumns = `id, household_id, plugin_type, event_type, action, params, enabled, created_at, updated_at`

func scanRule(row pgx.Row) (Rule, error) {
	var (
		r      Rule
		params []byte
	)
	err := row.Scan(&r.ID, &r.HouseholdID, &r.PluginType, &r.EventType, &r.Action, &params, &r.Enabled, &r.CreatedAt, &r.UpdatedAt)
	r.Params = params
	return r, err
}

func (r *repository) ListRules(ctx context.Context, householdID uuid.UUID, pluginType string) ([]Rule, error) {
	rows, err := r.db.Query(ctx, `SELECT `+ruleColumns+` FROM integration_rules
		WHERE household_id = $1 AND plugin_type = $2 ORDER BY event_type`, householdID, pluginType)
	if err != nil {
		return nil, fmt.Errorf("query rules: %w", err)
	}
	defer rows.Close()
	out := []Rule{}
	for rows.Next() {
		rule, err := scanRule(rows)
		if err != nil {
			return nil, fmt.Errorf("scan rule: %w", err)
		}
		out = append(out, rule)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate rules: %w", err)
	}
	return out, nil
}

// SaveRule inserts the rule or replaces the household's rule of its event type.
func (r *repository) SaveRule(ctx context.Context, rule *Rule) error {
	err := r.db.QueryRow(ctx, `INSERT INTO integration_rules
		(household_id, plugin_type, event_type, action, params, enabled)
		VALUES ($1, $2, $3, $4, $5::jsonb, $6)
		ON CONFLICT (household_id, plugin_type, event_type) DO UPDATE SET
			action = EXCLUDED.action, params = EXCLUDED.params,
			enabled = EXCLUDED.enabled, updated_at = NOW()
		RETURNING id, created_at, updated_at`,
		rule.HouseholdID, rule.PluginType, rule.EventType, rule.Action, string(rule.Params), rule.Enabled,
	).Scan(&rule.ID, &rule.CreatedAt, &rule.UpdatedAt)
	if err != nil {
		return fmt.Errorf("save rule: %w", err)
	}
	return nil
}

func (r *repository) DeleteRule(ctx context.Context, householdID uuid.UUID, pluginType string, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM integration_rules
		WHERE household_id = $1 AND plugin_type = $2 AND id = $3`, householdID, pluginType, id)
	if err != nil {
		return fmt.Errorf("delete rule: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrRuleNotFound
	}
	return nil
}

func (r *repository) FindRule(ctx context.Context, householdID uuid.UUID, pluginType, eventType string) (Rule, error) {
	rule, err := scanRule(r.db.QueryRow(ctx, `SELECT `+ruleColumns+` FROM integration_rules
		WHERE household_id = $1 AND plugin_type = $2 AND event_type = $3 AND enabled`,
		householdID, pluginType, eventType))
	if errors.Is(err, pgx.ErrNoRows) {
		return Rule{}, ErrRuleNotFound
	}
	if err != nil {
		return Rule{}, fmt.Errorf("find rule: %w", err)
	}
	return rule, nil
}

func (r *repository) InsertEvent(ctx context.Context, ev Event) (bool, Status, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx, `INSERT INTO integration_events (plugin_id, household_id, event_id, event_type)
		VALUES ($1, $2, $3, $4) ON CONFLICT (plugin_id, event_id) DO NOTHING RETURNING id`,
		ev.PluginID, ev.HouseholdID, ev.EventID, ev.EventType).Scan(&id)
	if err == nil {
		return true, StatusReceived, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return false, "", fmt.Errorf("insert event: %w", err)
	}
	var status string
	if err := r.db.QueryRow(ctx, `SELECT status FROM integration_events
		WHERE plugin_id = $1 AND household_id = $2 AND event_id = $3`,
		ev.PluginID, ev.HouseholdID, ev.EventID).Scan(&status); err != nil {
		return false, "", fmt.Errorf("read replayed event: %w", err)
	}
	return false, Status(status), nil
}

func (r *repository) FinishEvent(ctx context.Context, ev Event, action string, res Result) error {
	_, err := r.db.Exec(ctx, `UPDATE integration_events SET status = $4, action = $5, detail = $6
		WHERE plugin_id = $1 AND household_id = $2 AND event_id = $3`,
		ev.PluginID, ev.HouseholdID, ev.EventID, string(res.Status), action, truncate(res.Detail, 500))
	if err != nil {
		return fmt.Errorf("finish event: %w", err)
	}
	return nil
}

func (r *repository) RecentEvents(ctx context.Context, householdID uuid.UUID, pluginType string) ([]Record, error) {
	rows, err := r.db.Query(ctx, `SELECT e.event_id, e.event_type, e.status, e.action, e.detail, e.received_at
		FROM integration_events e JOIN household_plugins p ON p.id = e.plugin_id
		WHERE e.household_id = $1 AND p.household_id = $1 AND p.type = $2
		ORDER BY e.received_at DESC LIMIT $3`, householdID, pluginType, RecentEvents)
	if err != nil {
		return nil, fmt.Errorf("query events: %w", err)
	}
	defer rows.Close()
	out := []Record{}
	for rows.Next() {
		var (
			rec    Record
			status string
		)
		if err := rows.Scan(&rec.EventID, &rec.EventType, &status, &rec.Action, &rec.Detail, &rec.ReceivedAt); err != nil {
			return nil, fmt.Errorf("scan event: %w", err)
		}
		rec.Status = Status(status)
		out = append(out, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate events: %w", err)
	}
	return out, nil
}

// truncate caps s at n runes.
func truncate(s string, n int) string {
	if r := []rune(s); len(r) > n {
		return string(r[:n])
	}
	return s
}
