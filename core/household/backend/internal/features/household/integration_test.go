package household_test

// Integration tests against a real PostgreSQL. They run only when
// HOUSEHOLD_TEST_DATABASE_URL points at a disposable database, e.g.:
//
//	docker run -d --rm -p 55432:5432 -e POSTGRES_PASSWORD=pg postgres:16-alpine
//	HOUSEHOLD_TEST_DATABASE_URL='postgres://postgres:pg@localhost:55432/postgres?sslmode=disable' go test ./...
//
// The public schema of that database is dropped and recreated.

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"

	"alfheim/household/internal/features/household"
	"alfheim/household/internal/shared/middleware"
)

const integrationDBEnv = "HOUSEHOLD_TEST_DATABASE_URL"

func setupIntegrationDB(t *testing.T) (*pgxpool.Pool, household.Service) {
	t.Helper()
	dbURL := os.Getenv(integrationDBEnv)
	if dbURL == "" {
		t.Skipf("%s not set; skipping PostgreSQL integration test", integrationDBEnv)
	}
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)

	if _, err := pool.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`); err != nil {
		t.Fatalf("reset schema: %v", err)
	}

	migrationsDir, err := filepath.Abs("../../../migrations")
	if err != nil {
		t.Fatal(err)
	}
	m, err := migrate.New("file://"+migrationsDir, dbURL)
	if err != nil {
		t.Fatalf("migrate init: %v", err)
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("migrate up: %v", err)
	}
	_, _ = m.Close()

	svc := household.NewService(household.NewRepository(pool), slog.New(slog.NewTextHandler(io.Discard, nil)))
	return pool, svc
}

func claimsFor(sub string) *middleware.UserClaims {
	// Access tokens may carry no email; several users with an empty email must coexist.
	return &middleware.UserClaims{Subject: sub}
}

func TestIntegration_ConcurrentJoinOnSingleUseInvite(t *testing.T) {
	pool, svc := setupIntegrationDB(t)
	ctx := context.Background()

	h, err := svc.CreateHousehold(ctx, claimsFor("owner"), household.CreateHouseholdRequest{Name: "Race House"})
	if err != nil {
		t.Fatal(err)
	}
	inv, err := svc.CreateInvite(ctx, "owner", household.CreateInviteRequest{HouseholdID: h.ID, Role: "MEMBER", MaxUses: 1})
	if err != nil {
		t.Fatal(err)
	}

	const attempts = 20
	var (
		wg        sync.WaitGroup
		mu        sync.Mutex
		successes int
		otherErrs []error
	)
	start := make(chan struct{})
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			_, err := svc.JoinHousehold(ctx, claimsFor(fmt.Sprintf("joiner-%d", i)), inv.Token)
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				successes++
			case errors.Is(err, household.ErrInviteExpiredOrInvalid):
			default:
				otherErrs = append(otherErrs, err)
			}
		}(i)
	}
	close(start)
	wg.Wait()

	if successes != 1 {
		t.Errorf("expected exactly one successful join, got %d", successes)
	}
	if len(otherErrs) > 0 {
		t.Errorf("unexpected errors: %v", otherErrs)
	}
	var uses, members int
	if err := pool.QueryRow(ctx, `SELECT uses FROM household_invites WHERE token = $1`, inv.Token).Scan(&uses); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM household_members WHERE household_id = $1`, h.ID).Scan(&members); err != nil {
		t.Fatal(err)
	}
	if uses != 1 || members != 2 {
		t.Errorf("expected uses=1 and 2 members, got uses=%d members=%d", uses, members)
	}
}

func TestIntegration_JoinRules(t *testing.T) {
	pool, svc := setupIntegrationDB(t)
	ctx := context.Background()

	h, err := svc.CreateHousehold(ctx, claimsFor("owner"), household.CreateHouseholdRequest{Name: "Join House"})
	if err != nil {
		t.Fatal(err)
	}
	if !h.IsDefault {
		t.Error("first created household must be the owner's default")
	}
	inv, err := svc.CreateInvite(ctx, "owner", household.CreateInviteRequest{HouseholdID: h.ID, Role: "GUEST", MaxUses: 5})
	if err != nil {
		t.Fatal(err)
	}

	joined, err := svc.JoinHousehold(ctx, claimsFor("guest"), inv.Token)
	if err != nil {
		t.Fatal(err)
	}
	if joined.Role != "GUEST" || !joined.IsDefault {
		t.Errorf("expected GUEST default membership, got role=%s default=%v", joined.Role, joined.IsDefault)
	}

	// Already a member: 409 and the use is rolled back.
	if _, err := svc.JoinHousehold(ctx, claimsFor("guest"), inv.Token); !errors.Is(err, household.ErrMemberAlreadyExists) {
		t.Errorf("expected ErrMemberAlreadyExists, got %v", err)
	}
	var uses int
	_ = pool.QueryRow(ctx, `SELECT uses FROM household_invites WHERE token = $1`, inv.Token).Scan(&uses)
	if uses != 1 {
		t.Errorf("expected uses=1 after duplicate join, got %d", uses)
	}

	if _, err := svc.JoinHousehold(ctx, claimsFor("x"), "does-not-exist"); !errors.Is(err, household.ErrInviteNotFound) {
		t.Errorf("expected ErrInviteNotFound, got %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE household_invites SET expires_at = NOW() - interval '1 minute' WHERE token = $1`, inv.Token); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.JoinHousehold(ctx, claimsFor("late"), inv.Token); !errors.Is(err, household.ErrInviteExpiredOrInvalid) {
		t.Errorf("expected ErrInviteExpiredOrInvalid for expired invite, got %v", err)
	}

	// The schema itself refuses OWNER invites and unknown roles.
	if _, err := pool.Exec(ctx, `INSERT INTO household_invites (token, household_id, inviter_id, role, expires_at) VALUES ('t-owner', $1, 'owner', 'OWNER', NOW() + interval '1 hour')`, h.ID); err == nil {
		t.Error("expected CHECK violation for OWNER invite")
	}
	if _, err := pool.Exec(ctx, `UPDATE household_members SET role = 'ROOT' WHERE household_id = $1 AND user_id = 'guest'`, h.ID); err == nil {
		t.Error("expected CHECK violation for unknown member role")
	}
	// ...and a second OWNER.
	if _, err := pool.Exec(ctx, `UPDATE household_members SET role = 'OWNER' WHERE household_id = $1 AND user_id = 'guest'`, h.ID); err == nil {
		t.Error("expected unique violation for a second OWNER")
	}
}

func TestIntegration_TransferDefaultRenameDelete(t *testing.T) {
	pool, svc := setupIntegrationDB(t)
	ctx := context.Background()

	h, err := svc.CreateHousehold(ctx, claimsFor("owner"), household.CreateHouseholdRequest{Name: "Life Cycle"})
	if err != nil {
		t.Fatal(err)
	}
	inv, err := svc.CreateInvite(ctx, "owner", household.CreateInviteRequest{HouseholdID: h.ID, MaxUses: 3})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.JoinHousehold(ctx, claimsFor("heir"), inv.Token); err != nil {
		t.Fatal(err)
	}

	// Transfer ownership: old owner becomes ADMIN, heir becomes OWNER.
	res, err := svc.TransferOwnership(ctx, "owner", h.ID, "heir")
	if err != nil {
		t.Fatalf("transfer: %v", err)
	}
	if res.OwnerID != "heir" || res.Role != "ADMIN" {
		t.Errorf("unexpected transfer result owner=%s role=%s", res.OwnerID, res.Role)
	}
	if _, err := svc.TransferOwnership(ctx, "owner", h.ID, "heir"); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("former owner transferring again: expected forbidden, got %v", err)
	}
	if _, err := svc.TransferOwnership(ctx, "heir", h.ID, "stranger"); !errors.Is(err, household.ErrMemberNotFound) {
		t.Errorf("transfer to stranger: expected ErrMemberNotFound, got %v", err)
	}

	// Rename as ADMIN.
	if _, err := svc.RenameHousehold(ctx, "owner", h.ID, household.RenameHouseholdRequest{Name: "Renamed"}); err != nil {
		t.Errorf("rename: %v", err)
	}

	// Default household switching.
	second, err := svc.CreateHousehold(ctx, claimsFor("heir"), household.CreateHouseholdRequest{Name: "Second"})
	if err != nil {
		t.Fatal(err)
	}
	if second.IsDefault {
		t.Error("heir's first household (joined) must stay default")
	}
	if err := svc.SetDefaultHousehold(ctx, "heir", second.ID); err != nil {
		t.Fatal(err)
	}
	list, err := svc.GetUserHouseholds(ctx, "heir")
	if err != nil {
		t.Fatal(err)
	}
	defaults := 0
	for _, hh := range list {
		if hh.IsDefault {
			defaults++
			if hh.ID != second.ID {
				t.Errorf("wrong default %s", hh.ID)
			}
		}
	}
	if defaults != 1 {
		t.Errorf("expected exactly one default, got %d", defaults)
	}

	// Invite listing and revocation.
	active, err := svc.ListInvites(ctx, "owner", h.ID)
	if err != nil || len(active) != 1 {
		t.Fatalf("list invites: %+v, %v", active, err)
	}
	if err := svc.RevokeInvite(ctx, "owner", h.ID, inv.Token); err != nil {
		t.Fatal(err)
	}
	if err := svc.RevokeInvite(ctx, "owner", h.ID, inv.Token); !errors.Is(err, household.ErrInviteNotFound) {
		t.Errorf("second revoke: expected ErrInviteNotFound, got %v", err)
	}

	// Add contact data, then delete the household: everything cascades.
	if _, err := pool.Exec(ctx, `INSERT INTO contact_categories (household_id, name) VALUES ($1, 'cat')`, h.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO contacts (household_id, name) VALUES ($1, 'c')`, h.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateInvite(ctx, "heir", household.CreateInviteRequest{HouseholdID: h.ID}); err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteHousehold(ctx, "owner", h.ID); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("admin delete: expected forbidden, got %v", err)
	}
	if err := svc.DeleteHousehold(ctx, "heir", h.ID); err != nil {
		t.Fatalf("owner delete: %v", err)
	}
	for _, table := range []string{"household_members", "household_invites", "contact_categories", "contacts"} {
		var n int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM `+table+` WHERE household_id = $1`, h.ID).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 0 {
			t.Errorf("%s: expected cascade delete, %d rows left", table, n)
		}
	}

	// Leave: the non-owner can leave the remaining household only if a member.
	if err := svc.LeaveHousehold(ctx, "heir", second.ID); !errors.Is(err, household.ErrOwnerCannotLeave) {
		t.Errorf("owner leave: expected ErrOwnerCannotLeave, got %v", err)
	}

	// Non-UUID ids are treated as "not a member", never a 500.
	if _, err := svc.GetHouseholdDetails(ctx, "heir", "not-a-uuid"); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("non-uuid id: expected ErrUnauthorizedHouseholdAccess, got %v", err)
	}
}
