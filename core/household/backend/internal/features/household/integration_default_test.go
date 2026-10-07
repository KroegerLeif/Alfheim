package household_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"alfheim/household/internal/features/household"
)

// defaultOf returns the user's default household id ("" if none) straight from the database.
func defaultOf(t *testing.T, pool *pgxpool.Pool, userID string) string {
	t.Helper()
	var ids []string
	rows, err := pool.Query(context.Background(),
		`SELECT household_id::text FROM household_members WHERE user_id = $1 AND is_default`, userID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
	}
	if len(ids) > 1 {
		t.Fatalf("user %s has %d default households", userID, len(ids))
	}
	if len(ids) == 0 {
		return ""
	}
	return ids[0]
}

// joinAs makes userID a MEMBER of householdID through an invite created by ownerID.
func joinAs(t *testing.T, svc household.Service, ownerID, householdID, userID string) {
	t.Helper()
	ctx := context.Background()
	inv, err := svc.CreateInvite(ctx, ownerID, household.CreateInviteRequest{HouseholdID: householdID, Role: "MEMBER"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.JoinHousehold(ctx, claimsFor(userID), inv.Token); err != nil {
		t.Fatal(err)
	}
}

func createAs(t *testing.T, svc household.Service, ownerID, name string) string {
	t.Helper()
	h, err := svc.CreateHousehold(context.Background(), claimsFor(ownerID), household.CreateHouseholdRequest{Name: name})
	if err != nil {
		t.Fatal(err)
	}
	return h.ID
}

// Issue #575: losing the default membership must promote the oldest remaining one.
func TestIntegration_DefaultHouseholdIsReassigned(t *testing.T) {
	pool, svc := setupIntegrationDB(t)
	ctx := context.Background()

	first := createAs(t, svc, "owner-1", "Default Reassign One")
	second := createAs(t, svc, "owner-2", "Default Reassign Two")
	third := createAs(t, svc, "owner-3", "Default Reassign Three")
	for _, id := range []struct{ owner, hh string }{{"owner-1", first}, {"owner-2", second}, {"owner-3", third}} {
		joinAs(t, svc, id.owner, id.hh, "user")
	}
	if got := defaultOf(t, pool, "user"); got != first {
		t.Fatalf("first joined household must be the default, got %q", got)
	}

	// Leaving the default promotes the oldest remaining membership (second).
	if err := svc.LeaveHousehold(ctx, "user", first); err != nil {
		t.Fatal(err)
	}
	if got := defaultOf(t, pool, "user"); got != second {
		t.Errorf("after leave: default = %q, want %q", got, second)
	}

	// Being removed from the default by its owner promotes the next one (third).
	if err := svc.RemoveMember(ctx, "owner-2", second, "user"); err != nil {
		t.Fatal(err)
	}
	if got := defaultOf(t, pool, "user"); got != third {
		t.Errorf("after removal: default = %q, want %q", got, third)
	}

	// Removing a non-default membership never changes the default.
	fourth := createAs(t, svc, "owner-4", "Default Reassign Four")
	joinAs(t, svc, "owner-4", fourth, "user")
	if err := svc.LeaveHousehold(ctx, "user", fourth); err != nil {
		t.Fatal(err)
	}
	if got := defaultOf(t, pool, "user"); got != third {
		t.Errorf("after leaving a non-default household: default = %q, want %q", got, third)
	}

	// Deleting the last household leaves the user without a default (and no error).
	if err := svc.DeleteHousehold(ctx, "owner-3", third); err != nil {
		t.Fatal(err)
	}
	if got := defaultOf(t, pool, "user"); got != "" {
		t.Errorf("after deleting the only household: default = %q, want none", got)
	}
}

func TestIntegration_DeleteHouseholdReassignsEveryMembersDefault(t *testing.T) {
	pool, svc := setupIntegrationDB(t)
	ctx := context.Background()

	doomed := createAs(t, svc, "owner", "Doomed Household")
	joinAs(t, svc, "owner", doomed, "alice")
	joinAs(t, svc, "owner", doomed, "bob")
	aliceOther := createAs(t, svc, "alice", "Alice Elsewhere")
	bobOther := createAs(t, svc, "bob", "Bob Elsewhere")
	ownerOther := createAs(t, svc, "owner", "Owner Elsewhere")

	// bob already chose another default: deleting must not touch it.
	if err := svc.SetDefaultHousehold(ctx, "bob", bobOther); err != nil {
		t.Fatal(err)
	}

	if err := svc.DeleteHousehold(ctx, "owner", doomed); err != nil {
		t.Fatal(err)
	}
	for user, want := range map[string]string{"alice": aliceOther, "bob": bobOther, "owner": ownerOther} {
		if got := defaultOf(t, pool, user); got != want {
			t.Errorf("%s: default = %q, want %q", user, got, want)
		}
	}

	list, err := svc.GetUserHouseholds(ctx, "alice")
	if err != nil || len(list) != 1 || !list[0].IsDefault || list[0].Role != "OWNER" {
		t.Errorf("GET /me for alice must report the promoted default, got %+v, %v", list, err)
	}
	if len(list) == 1 && list[0].Members != nil {
		t.Errorf("GET /me must not include member rosters (#576), got %+v", list[0].Members)
	}
}
