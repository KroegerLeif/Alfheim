package household

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// promoteNextDefaultSQL gives every listed user without a default household
// their oldest remaining membership (by joined_at, ties broken by household id)
// as the new default. Users that still have a default, or no membership left,
// are untouched, so the one-default-per-user index can never be violated.
const promoteNextDefaultSQL = `
	UPDATE household_members hm
	SET is_default = TRUE
	FROM (
		SELECT DISTINCT ON (user_id) household_id, user_id
		FROM household_members
		WHERE user_id = ANY($1::varchar[])
		ORDER BY user_id, joined_at ASC, household_id ASC
	) next
	WHERE hm.household_id = next.household_id
	  AND hm.user_id = next.user_id
	  AND NOT EXISTS (
		SELECT 1 FROM household_members d WHERE d.user_id = next.user_id AND d.is_default
	  )
`

// promoteNextDefault reassigns the default household of users whose default
// membership was just removed. It must run inside the transaction that removed
// the membership so the user is never observed without a default.
func promoteNextDefault(ctx context.Context, tx pgx.Tx, userIDs []string) error {
	if len(userIDs) == 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, promoteNextDefaultSQL, userIDs); err != nil {
		return fmt.Errorf("failed to reassign default household: %w", err)
	}
	return nil
}
