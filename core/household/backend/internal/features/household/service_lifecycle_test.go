package household_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"alfheim/household/internal/features/household"
	"alfheim/household/internal/shared/middleware"
)

const (
	hhA     = "hh-a"
	owner   = "owner"
	admin   = "admin"
	member  = "member"
	guest   = "guest"
	outside = "outsider"
)

// seededService returns a service over a mock repo with household hhA holding
// one member of every role.
func seededService(t *testing.T) (household.Service, *mockRepository) {
	t.Helper()
	repo := newMockRepository()
	repo.households[hhA] = &household.Household{ID: hhA, Name: "A", Slug: "a", OwnerID: owner}
	repo.members[hhA] = map[string]household.HouseholdRole{
		owner:  household.RoleOwner,
		admin:  household.RoleAdmin,
		member: household.RoleMember,
		guest:  household.RoleGuest,
	}
	return household.NewService(repo, slog.New(slog.NewTextHandler(io.Discard, nil))), repo
}

func TestParseRole(t *testing.T) {
	for _, ok := range []string{"OWNER", "ADMIN", "MEMBER", "GUEST"} {
		if r, err := household.ParseRole(ok); err != nil || string(r) != ok {
			t.Errorf("ParseRole(%q) = %q, %v", ok, r, err)
		}
	}
	for _, bad := range []string{"", "owner", "Admin", "SUPERUSER", " MEMBER"} {
		if _, err := household.ParseRole(bad); !errors.Is(err, household.ErrInvalidRole) {
			t.Errorf("ParseRole(%q) expected ErrInvalidRole, got %v", bad, err)
		}
	}
	if !household.RoleOwner.CanManage() || !household.RoleAdmin.CanManage() || household.RoleMember.CanManage() || household.RoleGuest.CanManage() {
		t.Error("CanManage must be true only for OWNER and ADMIN")
	}
}

func TestService_RoleValidation(t *testing.T) {
	svc, _ := seededService(t)
	ctx := context.Background()

	if err := svc.UpdateMemberRole(ctx, owner, hhA, member, "superuser"); !errors.Is(err, household.ErrInvalidRole) {
		t.Errorf("UpdateMemberRole invalid role: expected ErrInvalidRole, got %v", err)
	}
	if err := svc.UpdateMemberRole(ctx, owner, hhA, member, "admin"); !errors.Is(err, household.ErrInvalidRole) {
		t.Errorf("UpdateMemberRole lower-case role: expected ErrInvalidRole, got %v", err)
	}
	if _, err := svc.CreateInvite(ctx, owner, household.CreateInviteRequest{HouseholdID: hhA, Role: "root"}); !errors.Is(err, household.ErrInvalidRole) {
		t.Errorf("CreateInvite invalid role: expected ErrInvalidRole, got %v", err)
	}
	inv, err := svc.CreateInvite(ctx, owner, household.CreateInviteRequest{HouseholdID: hhA})
	if err != nil || inv.Role != "MEMBER" || inv.MaxUses != 1 {
		t.Errorf("CreateInvite default role: expected MEMBER/max_uses 1, got %+v, %v", inv, err)
	}
	inv, err = svc.CreateInvite(ctx, admin, household.CreateInviteRequest{HouseholdID: hhA, Role: "GUEST", MaxUses: 3})
	if err != nil || inv.Role != "GUEST" || inv.MaxUses != 3 {
		t.Errorf("CreateInvite GUEST by admin: got %+v, %v", inv, err)
	}
}

func TestService_BlocksOwnerEscalation(t *testing.T) {
	svc, repo := seededService(t)
	ctx := context.Background()

	for _, requester := range []string{admin, owner} {
		if err := svc.UpdateMemberRole(ctx, requester, hhA, member, household.RoleOwner); !errors.Is(err, household.ErrOwnerRoleNotAssignable) {
			t.Errorf("%s promoting to OWNER: expected ErrOwnerRoleNotAssignable, got %v", requester, err)
		}
		if _, err := svc.CreateInvite(ctx, requester, household.CreateInviteRequest{HouseholdID: hhA, Role: "OWNER"}); !errors.Is(err, household.ErrOwnerRoleNotAssignable) {
			t.Errorf("%s creating OWNER invite: expected ErrOwnerRoleNotAssignable, got %v", requester, err)
		}
	}
	// An ADMIN cannot promote themselves either.
	if err := svc.UpdateMemberRole(ctx, admin, hhA, admin, household.RoleOwner); !errors.Is(err, household.ErrOwnerRoleNotAssignable) {
		t.Errorf("admin self-promotion: expected ErrOwnerRoleNotAssignable, got %v", err)
	}
	if repo.members[hhA][member] != household.RoleMember || repo.members[hhA][admin] != household.RoleAdmin {
		t.Errorf("roles must be unchanged, got %+v", repo.members[hhA])
	}
	if len(repo.invites) != 0 {
		t.Errorf("no invite may be stored, got %d", len(repo.invites))
	}
	// MEMBER/GUEST cannot change roles at all.
	if err := svc.UpdateMemberRole(ctx, member, hhA, guest, household.RoleMember); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("member changing roles: expected ErrUnauthorizedHouseholdAccess, got %v", err)
	}
	// Owner's role is immutable outside transfer-ownership.
	if err := svc.UpdateMemberRole(ctx, admin, hhA, owner, household.RoleMember); !errors.Is(err, household.ErrCannotChangeOwnerRole) {
		t.Errorf("demoting owner: expected ErrCannotChangeOwnerRole, got %v", err)
	}
	// Admin can still manage non-owner roles.
	if err := svc.UpdateMemberRole(ctx, admin, hhA, guest, household.RoleMember); err != nil {
		t.Errorf("admin promoting guest to member: %v", err)
	}
}

func TestService_JoinHousehold(t *testing.T) {
	svc, repo := seededService(t)
	ctx := context.Background()

	inv, err := svc.CreateInvite(ctx, admin, household.CreateInviteRequest{HouseholdID: hhA, Role: "ADMIN", MaxUses: 2})
	if err != nil {
		t.Fatal(err)
	}

	res, err := svc.JoinHousehold(ctx, &middleware.UserClaims{Subject: "newbie"}, inv.Token)
	if err != nil {
		t.Fatalf("join: %v", err)
	}
	if res.Role != "ADMIN" {
		t.Errorf("joined member should get the invite's role ADMIN, got %s", res.Role)
	}
	if !res.IsDefault {
		t.Error("first household joined must become the default")
	}

	// Already a member -> conflict and the use is not consumed.
	if _, err := svc.JoinHousehold(ctx, &middleware.UserClaims{Subject: "newbie"}, inv.Token); !errors.Is(err, household.ErrMemberAlreadyExists) {
		t.Errorf("expected ErrMemberAlreadyExists, got %v", err)
	}
	if repo.invites[inv.Token].Uses != 1 {
		t.Errorf("expected 1 use consumed, got %d", repo.invites[inv.Token].Uses)
	}

	// A legacy OWNER invite is redeemed as MEMBER, never OWNER.
	repo.invites["legacy"] = &household.Invite{Token: "legacy", HouseholdID: hhA, Role: household.RoleOwner, MaxUses: 1, ExpiresAt: time.Now().Add(time.Hour)}
	res, err = svc.JoinHousehold(ctx, &middleware.UserClaims{Subject: "sneaky"}, "legacy")
	if err != nil || res.Role != "MEMBER" {
		t.Errorf("OWNER invite must redeem as MEMBER, got %+v, %v", res, err)
	}
}

func TestService_DefaultHousehold(t *testing.T) {
	svc, repo := seededService(t)
	ctx := context.Background()
	claims := &middleware.UserClaims{Subject: "fresh"}

	first, err := svc.CreateHousehold(ctx, claims, household.CreateHouseholdRequest{Name: "First Home"})
	if err != nil {
		t.Fatal(err)
	}
	if !first.IsDefault {
		t.Error("first created household must be the default")
	}
	second, err := svc.CreateHousehold(ctx, claims, household.CreateHouseholdRequest{Name: "Second Home"})
	if err != nil {
		t.Fatal(err)
	}
	if second.IsDefault {
		t.Error("second household must not steal the default")
	}

	list, err := svc.GetUserHouseholds(ctx, "fresh")
	if err != nil || len(list) != 2 {
		t.Fatalf("GetUserHouseholds: %+v, %v", list, err)
	}
	for _, h := range list {
		if h.IsDefault != (h.ID == first.ID) {
			t.Errorf("household %s is_default=%v", h.ID, h.IsDefault)
		}
	}

	if err := svc.SetDefaultHousehold(ctx, "fresh", second.ID); err != nil {
		t.Fatal(err)
	}
	if repo.defaults["fresh"] != second.ID {
		t.Errorf("expected default %s, got %s", second.ID, repo.defaults["fresh"])
	}
	details, err := svc.GetHouseholdDetails(ctx, "fresh", second.ID)
	if err != nil || !details.IsDefault {
		t.Errorf("details should report is_default=true, got %+v, %v", details, err)
	}
	if err := svc.SetDefaultHousehold(ctx, "fresh", hhA); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("default on foreign household: expected ErrUnauthorizedHouseholdAccess, got %v", err)
	}
}

func TestService_RenameHousehold(t *testing.T) {
	svc, repo := seededService(t)
	ctx := context.Background()

	res, err := svc.RenameHousehold(ctx, admin, hhA, household.RenameHouseholdRequest{Name: "  Renamed  "})
	if err != nil || res.Name != "Renamed" || repo.households[hhA].Name != "Renamed" {
		t.Errorf("admin rename: %+v, %v", res, err)
	}
	if _, err := svc.RenameHousehold(ctx, member, hhA, household.RenameHouseholdRequest{Name: "X"}); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("member rename: expected forbidden, got %v", err)
	}
	for _, bad := range []string{"", "   ", strings.Repeat("x", 151)} {
		if _, err := svc.RenameHousehold(ctx, owner, hhA, household.RenameHouseholdRequest{Name: bad}); !errors.Is(err, household.ErrInvalidHouseholdName) {
			t.Errorf("rename to %q: expected ErrInvalidHouseholdName, got %v", bad, err)
		}
	}
	if _, err := svc.CreateHousehold(ctx, &middleware.UserClaims{Subject: "x"}, household.CreateHouseholdRequest{Name: "???"}); !errors.Is(err, household.ErrInvalidHouseholdName) {
		t.Errorf("unsluggable name: expected ErrInvalidHouseholdName, got %v", err)
	}
}

func TestService_DeleteHousehold(t *testing.T) {
	svc, repo := seededService(t)
	ctx := context.Background()

	if err := svc.DeleteHousehold(ctx, admin, hhA); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("admin delete: expected forbidden, got %v", err)
	}
	if err := svc.DeleteHousehold(ctx, outside, hhA); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("outsider delete: expected forbidden, got %v", err)
	}
	if err := svc.DeleteHousehold(ctx, owner, hhA); err != nil {
		t.Fatalf("owner delete: %v", err)
	}
	if _, ok := repo.households[hhA]; ok {
		t.Error("household should be gone")
	}
	if len(repo.members[hhA]) != 0 {
		t.Error("members should be gone")
	}
}

func TestService_TransferOwnership(t *testing.T) {
	svc, repo := seededService(t)
	ctx := context.Background()

	if _, err := svc.TransferOwnership(ctx, admin, hhA, member); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("admin transfer: expected forbidden, got %v", err)
	}
	if _, err := svc.TransferOwnership(ctx, owner, hhA, owner); !errors.Is(err, household.ErrInvalidTransferTarget) {
		t.Errorf("self transfer: expected ErrInvalidTransferTarget, got %v", err)
	}
	if _, err := svc.TransferOwnership(ctx, owner, hhA, " "); !errors.Is(err, household.ErrInvalidTransferTarget) {
		t.Errorf("empty target: expected ErrInvalidTransferTarget, got %v", err)
	}
	if _, err := svc.TransferOwnership(ctx, owner, hhA, outside); !errors.Is(err, household.ErrMemberNotFound) {
		t.Errorf("non-member target: expected ErrMemberNotFound, got %v", err)
	}

	res, err := svc.TransferOwnership(ctx, owner, hhA, member)
	if err != nil {
		t.Fatalf("transfer: %v", err)
	}
	if res.OwnerID != member || res.Role != "ADMIN" {
		t.Errorf("expected owner_id=%s and caller role ADMIN, got owner_id=%s role=%s", member, res.OwnerID, res.Role)
	}
	if repo.members[hhA][owner] != household.RoleAdmin || repo.members[hhA][member] != household.RoleOwner {
		t.Errorf("unexpected roles after transfer: %+v", repo.members[hhA])
	}

	repo.failNext["TransferOwnershipTx"] = errMockDB
	if _, err := svc.TransferOwnership(ctx, member, hhA, owner); !errors.Is(err, errMockDB) {
		t.Errorf("expected repo error to propagate, got %v", err)
	}
}

func TestService_LeaveHousehold(t *testing.T) {
	svc, repo := seededService(t)
	ctx := context.Background()

	if err := svc.LeaveHousehold(ctx, owner, hhA); !errors.Is(err, household.ErrOwnerCannotLeave) {
		t.Errorf("owner leave: expected ErrOwnerCannotLeave, got %v", err)
	}
	if err := svc.LeaveHousehold(ctx, outside, hhA); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("outsider leave: expected forbidden, got %v", err)
	}
	for _, u := range []string{admin, member, guest} {
		if err := svc.LeaveHousehold(ctx, u, hhA); err != nil {
			t.Errorf("%s leave: %v", u, err)
		}
		if _, ok := repo.members[hhA][u]; ok {
			t.Errorf("%s still a member", u)
		}
	}
}

func TestService_InviteManagement(t *testing.T) {
	svc, repo := seededService(t)
	ctx := context.Background()

	active, err := svc.CreateInvite(ctx, owner, household.CreateInviteRequest{HouseholdID: hhA, MaxUses: 2})
	if err != nil {
		t.Fatal(err)
	}
	repo.invites["expired"] = &household.Invite{Token: "expired", HouseholdID: hhA, Role: household.RoleMember, MaxUses: 1, ExpiresAt: time.Now().Add(-time.Minute)}
	repo.invites["used-up"] = &household.Invite{Token: "used-up", HouseholdID: hhA, Role: household.RoleMember, MaxUses: 1, Uses: 1, ExpiresAt: time.Now().Add(time.Hour)}
	repo.invites["other"] = &household.Invite{Token: "other", HouseholdID: "hh-b", Role: household.RoleMember, MaxUses: 1, ExpiresAt: time.Now().Add(time.Hour)}

	list, err := svc.ListInvites(ctx, admin, hhA)
	if err != nil || len(list) != 1 || list[0].Token != active.Token {
		t.Errorf("expected only the active invite, got %+v, %v", list, err)
	}
	if _, err := svc.ListInvites(ctx, member, hhA); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("member list: expected forbidden, got %v", err)
	}

	if err := svc.RevokeInvite(ctx, member, hhA, active.Token); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("member revoke: expected forbidden, got %v", err)
	}
	if err := svc.RevokeInvite(ctx, admin, hhA, "other"); !errors.Is(err, household.ErrInviteNotFound) {
		t.Errorf("revoking another household's invite: expected ErrInviteNotFound, got %v", err)
	}
	if err := svc.RevokeInvite(ctx, admin, hhA, active.Token); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	if _, err := svc.JoinHousehold(ctx, &middleware.UserClaims{Subject: "late"}, active.Token); !errors.Is(err, household.ErrInviteNotFound) {
		t.Errorf("revoked invite must not be redeemable, got %v", err)
	}

	repo.failNext["ListActiveInvites"] = errMockDB
	if _, err := svc.ListInvites(ctx, owner, hhA); !errors.Is(err, errMockDB) {
		t.Errorf("expected repo error, got %v", err)
	}
}

func TestService_ErrorPropagation(t *testing.T) {
	svc, repo := seededService(t)
	ctx := context.Background()

	repo.failNext["GetDefaultHouseholdID"] = errMockDB
	if _, err := svc.GetUserHouseholds(ctx, owner); !errors.Is(err, errMockDB) {
		t.Errorf("GetUserHouseholds: expected repo error, got %v", err)
	}
	repo.failNext["GetHouseholdsByUserID"] = errMockDB
	if _, err := svc.GetUserHouseholds(ctx, owner); !errors.Is(err, errMockDB) {
		t.Errorf("GetUserHouseholds: expected repo error, got %v", err)
	}
	repo.failNext["GetMembers"] = errMockDB
	if _, err := svc.GetUserHouseholds(ctx, owner); !errors.Is(err, errMockDB) {
		t.Errorf("GetUserHouseholds members: expected repo error, got %v", err)
	}
	repo.failNext["GetHouseholdByID"] = errMockDB
	if _, err := svc.GetHouseholdDetails(ctx, owner, hhA); !errors.Is(err, errMockDB) {
		t.Errorf("GetHouseholdDetails: expected repo error, got %v", err)
	}
	if _, err := svc.GetHouseholdDetails(ctx, outside, hhA); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("GetHouseholdDetails outsider: expected forbidden, got %v", err)
	}
	repo.failNext["CreateHouseholdTx"] = errMockDB
	if _, err := svc.CreateHousehold(ctx, &middleware.UserClaims{Subject: "x"}, household.CreateHouseholdRequest{Name: "Home"}); !errors.Is(err, errMockDB) {
		t.Errorf("CreateHousehold: expected repo error, got %v", err)
	}
	repo.failNext["CreateInvite"] = errMockDB
	if _, err := svc.CreateInvite(ctx, owner, household.CreateInviteRequest{HouseholdID: hhA}); !errors.Is(err, errMockDB) {
		t.Errorf("CreateInvite: expected repo error, got %v", err)
	}
	if _, err := svc.CreateInvite(ctx, outside, household.CreateInviteRequest{HouseholdID: hhA}); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("CreateInvite outsider: expected forbidden, got %v", err)
	}
	repo.failNext["GetMemberRole"] = errMockDB
	if _, err := svc.TransferOwnership(ctx, owner, hhA, member); !errors.Is(err, errMockDB) {
		t.Errorf("TransferOwnership: expected repo error, got %v", err)
	}
	repo.failNext["GetHouseholdByID"] = errMockDB
	if err := svc.UpdateMemberRole(ctx, owner, hhA, member, household.RoleAdmin); !errors.Is(err, errMockDB) {
		t.Errorf("UpdateMemberRole: expected repo error, got %v", err)
	}
	repo.failNext["GetHouseholdByID"] = errMockDB
	if err := svc.RemoveMember(ctx, owner, hhA, member); !errors.Is(err, errMockDB) {
		t.Errorf("RemoveMember: expected repo error, got %v", err)
	}
	if err := svc.RemoveMember(ctx, outside, hhA, member); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("RemoveMember outsider: expected forbidden, got %v", err)
	}
	if _, err := svc.RenameHousehold(ctx, owner, "missing", household.RenameHouseholdRequest{Name: "x"}); !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		t.Errorf("Rename missing: expected forbidden, got %v", err)
	}
	if err := svc.LeaveHousehold(ctx, member, hhA); err != nil {
		t.Fatal(err)
	}
	if err := svc.RemoveMember(ctx, owner, hhA, member); !errors.Is(err, household.ErrMemberNotFound) {
		t.Errorf("RemoveMember gone: expected ErrMemberNotFound, got %v", err)
	}
}
