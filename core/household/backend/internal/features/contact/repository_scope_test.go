package contact

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

// TestRepository_MutationsAreScopedToHousehold guards against cross-household
// writes: every UPDATE/DELETE must filter on household_id and bind it.
func TestRepository_MutationsAreScopedToHousehold(t *testing.T) {
	ctx := context.Background()
	var gotSQL string
	var gotArgs []any
	repo := newRepositoryWithDB(&mockDBTX{
		execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
			gotSQL, gotArgs = sql, args
			return pgconn.NewCommandTag("UPDATE 1"), nil
		},
	})

	cases := map[string]func() error{
		"UpdateCategory": func() error {
			return repo.UpdateCategory(ctx, &ContactCategory{ID: "id-1", HouseholdID: "hh-1"})
		},
		"DeleteCategory": func() error { return repo.DeleteCategory(ctx, "hh-1", "id-1") },
		"UpdateContact": func() error {
			return repo.UpdateContact(ctx, &Contact{ID: "id-1", HouseholdID: "hh-1"})
		},
		"DeleteContact": func() error { return repo.DeleteContact(ctx, "hh-1", "id-1") },
	}
	for name, call := range cases {
		t.Run(name, func(t *testing.T) {
			gotSQL, gotArgs = "", nil
			if err := call(); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !strings.Contains(gotSQL, "household_id") {
				t.Errorf("statement is not scoped to household_id: %s", gotSQL)
			}
			found := false
			for _, a := range gotArgs {
				if a == "hh-1" {
					found = true
				}
			}
			if !found {
				t.Errorf("household id not bound as argument: %v", gotArgs)
			}
		})
	}
}
