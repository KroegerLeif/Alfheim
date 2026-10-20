package household_test

import (
	"context"
	"errors"
	"testing"

	"alfheim/household/internal/features/household"
)

const admin2 = "admin-2"

func seededWithSecondAdmin(t *testing.T) (household.Service, *mockRepository) {
	t.Helper()
	svc, repo := seededService(t)
	repo.members[hhA][admin2] = household.RoleAdmin
	return svc, repo
}

func TestService_AdminCannotRemoveAdmin(t *testing.T) {
	svc, repo := seededWithSecondAdmin(t)
	ctx := context.Background()

	if err := svc.RemoveMember(ctx, admin, hhA, admin2); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Fatalf("admin removing admin: expected ErrUnauthorizedHouseholdAccess, got %v", err)
	}
	if _, ok := repo.members[hhA][admin2]; !ok {
		t.Fatal("second admin must not have been removed")
	}

	// Admins can still remove members and guests.
	for _, target := range []string{member, guest} {
		if err := svc.RemoveMember(ctx, admin, hhA, target); err != nil {
			t.Errorf("admin removing %s: %v", target, err)
		}
	}
	// The owner can remove an admin.
	if err := svc.RemoveMember(ctx, owner, hhA, admin2); err != nil {
		t.Errorf("owner removing admin: %v", err)
	}
	// Self-leave stays allowed for admins.
	if err := svc.RemoveMember(ctx, admin, hhA, admin); err != nil {
		t.Errorf("admin leaving: %v", err)
	}
}

func TestService_AdminRoleChangesAreRestricted(t *testing.T) {
	svc, repo := seededWithSecondAdmin(t)
	ctx := context.Background()

	// Admin cannot promote anybody (including themselves) to ADMIN.
	if err := svc.UpdateMemberRole(ctx, admin, hhA, member, household.RoleAdmin); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("admin promoting to ADMIN: expected ErrUnauthorizedHouseholdAccess, got %v", err)
	}
	// Admin cannot demote another admin.
	if err := svc.UpdateMemberRole(ctx, admin, hhA, admin2, household.RoleMember); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("admin demoting admin: expected ErrUnauthorizedHouseholdAccess, got %v", err)
	}
	if repo.members[hhA][admin2] != household.RoleAdmin || repo.members[hhA][member] != household.RoleMember {
		t.Fatal("roles must be unchanged after rejected updates")
	}

	// Admin can switch MEMBER and GUEST.
	if err := svc.UpdateMemberRole(ctx, admin, hhA, member, household.RoleGuest); err != nil {
		t.Errorf("admin member->guest: %v", err)
	}
	if err := svc.UpdateMemberRole(ctx, admin, hhA, guest, household.RoleMember); err != nil {
		t.Errorf("admin guest->member: %v", err)
	}

	// Owner promotes to and demotes from ADMIN.
	if err := svc.UpdateMemberRole(ctx, owner, hhA, member, household.RoleAdmin); err != nil {
		t.Errorf("owner promoting to ADMIN: %v", err)
	}
	if err := svc.UpdateMemberRole(ctx, owner, hhA, admin2, household.RoleMember); err != nil {
		t.Errorf("owner demoting admin: %v", err)
	}
}

func TestService_AdminCannotInviteAdmin(t *testing.T) {
	svc, _ := seededService(t)
	ctx := context.Background()

	if _, err := svc.CreateInvite(ctx, admin, household.CreateInviteRequest{HouseholdID: hhA, Role: "ADMIN"}); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("admin inviting ADMIN: expected ErrUnauthorizedHouseholdAccess, got %v", err)
	}
	if _, err := svc.CreateInvite(ctx, admin, household.CreateInviteRequest{HouseholdID: hhA, Role: "GUEST"}); err != nil {
		t.Errorf("admin inviting GUEST: %v", err)
	}
	if _, err := svc.CreateInvite(ctx, owner, household.CreateInviteRequest{HouseholdID: hhA, Role: "ADMIN"}); err != nil {
		t.Errorf("owner inviting ADMIN: %v", err)
	}
}

func TestService_CreateInviteLimits(t *testing.T) {
	svc, _ := seededService(t)
	ctx := context.Background()

	invalid := []household.CreateInviteRequest{
		{HouseholdID: hhA, TTLMinutes: -1},
		{HouseholdID: hhA, TTLMinutes: 30*24*60 + 1},
		{HouseholdID: hhA, TTLMinutes: int(^uint(0) >> 1)}, // would overflow time.Duration
		{HouseholdID: hhA, MaxUses: -1},
		{HouseholdID: hhA, MaxUses: 101},
		{HouseholdID: hhA, MaxUses: int(^uint(0) >> 1)},
	}
	for _, req := range invalid {
		if _, err := svc.CreateInvite(ctx, owner, req); !errors.Is(err, household.ErrInvalidInviteParams) {
			t.Errorf("%+v: expected ErrInvalidInviteParams, got %v", req, err)
		}
	}

	res, err := svc.CreateInvite(ctx, owner, household.CreateInviteRequest{HouseholdID: hhA, TTLMinutes: 30 * 24 * 60, MaxUses: 100})
	if err != nil {
		t.Fatalf("upper bounds must be accepted: %v", err)
	}
	if res.MaxUses != 100 {
		t.Errorf("expected max_uses 100, got %d", res.MaxUses)
	}
	res, err = svc.CreateInvite(ctx, owner, household.CreateInviteRequest{HouseholdID: hhA})
	if err != nil || res.MaxUses != 1 {
		t.Errorf("defaults: expected max_uses 1, got %+v, %v", res, err)
	}
}
