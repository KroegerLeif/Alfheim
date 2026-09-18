package household_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"alfheim/household/internal/features/household"
	"alfheim/household/internal/shared/middleware"
)

func TestHouseholdService_CreateAndInvite(t *testing.T) {
	repo := newMockRepository()
	discardLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := household.NewService(repo, discardLogger)
	ctx := context.Background()

	ownerID := "user-owner-123"
	claims := &middleware.UserClaims{
		Subject:           ownerID,
		Email:             "owner@example.com",
		PreferredUsername: "owner",
	}
	createReq := household.CreateHouseholdRequest{
		Name: "Alfheim Family",
		Slug: "alfheim-family",
	}

	hResp, err := svc.CreateHousehold(ctx, claims, createReq)
	if err != nil {
		t.Fatalf("expected no error creating household, got: %v", err)
	}
	if hResp.Name != "Alfheim Family" {
		t.Errorf("expected name 'Alfheim Family', got '%s'", hResp.Name)
	}

	// Create Invite
	inviteReq := household.CreateInviteRequest{
		HouseholdID: hResp.ID,
		Role:        "MEMBER",
		TTLMinutes:  60,
		MaxUses:     2,
	}

	invResp, err := svc.CreateInvite(ctx, ownerID, inviteReq)
	if err != nil {
		t.Fatalf("expected no error creating invite, got: %v", err)
	}
	if len(invResp.Token) != 64 {
		t.Errorf("expected 64-char hex token, got length %d", len(invResp.Token))
	}

	// Member joins via token
	joinUserID := "user-member-456"
	joinedH, err := svc.JoinHousehold(ctx, &middleware.UserClaims{Subject: joinUserID}, invResp.Token)
	if err != nil {
		t.Fatalf("expected member to join household via token, got error: %v", err)
	}
	if len(joinedH.Members) != 2 {
		t.Errorf("expected 2 members in household, got %d", len(joinedH.Members))
	}

	// Test Cannot remove owner
	err = svc.RemoveMember(ctx, ownerID, hResp.ID, ownerID)
	if err != household.ErrCannotRemoveOwner {
		t.Errorf("expected ErrCannotRemoveOwner, got %v", err)
	}
}

func TestHouseholdService_GetUserHouseholds(t *testing.T) {
	repo := newMockRepository()
	discardLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := household.NewService(repo, discardLogger)
	ctx := context.Background()

	userID := "user-multi-hh"

	// manually seed repo for the test
	hh1 := &household.Household{ID: "hh-1", Name: "First", OwnerID: userID}
	repo.households[hh1.ID] = hh1
	repo.members[hh1.ID] = map[string]household.HouseholdRole{userID: household.RoleOwner}

	hh2 := &household.Household{ID: "hh-2", Name: "Second", OwnerID: "some-other-owner"}
	repo.households[hh2.ID] = hh2
	repo.members[hh2.ID] = map[string]household.HouseholdRole{userID: household.RoleMember}

	list, err := svc.GetUserHouseholds(ctx, userID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2 households, got %d", len(list))
	}

	emptyList, err := svc.GetUserHouseholds(ctx, "nonexistent-user")
	if err != nil {
		t.Fatalf("expected no error for nonexistent user, got %v", err)
	}
	if len(emptyList) != 0 {
		t.Errorf("expected 0 households, got %d", len(emptyList))
	}
}

func TestHouseholdService_UpdateMemberRole(t *testing.T) {
	repo := newMockRepository()
	discardLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := household.NewService(repo, discardLogger)
	ctx := context.Background()

	ownerID := "owner"
	targetID := "member"
	hhID := "hh-role-test"

	repo.households[hhID] = &household.Household{ID: hhID, OwnerID: ownerID}
	repo.members[hhID] = map[string]household.HouseholdRole{
		ownerID:  household.RoleOwner,
		targetID: household.RoleMember,
	}

	err := svc.UpdateMemberRole(ctx, ownerID, hhID, targetID, household.RoleAdmin)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	role, _ := repo.GetMemberRole(ctx, hhID, targetID)
	if role != household.RoleAdmin {
		t.Errorf("expected admin, got %s", role)
	}
}

func TestHouseholdService_UpdateHouseholdAddress(t *testing.T) {
	repo := newMockRepository()
	discardLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := household.NewService(repo, discardLogger)
	ctx := context.Background()

	ownerID := "owner"
	hhID := "hh-address-test"

	repo.households[hhID] = &household.Household{ID: hhID, OwnerID: ownerID}
	repo.members[hhID] = map[string]household.HouseholdRole{ownerID: household.RoleOwner}

	lat := 47.3769
	lon := 8.5417
	req := household.UpdateHouseholdAddressRequest{
		Street:    "Bahnhofstrasse",
		Zip:       "8001",
		City:      "Zurich",
		Country:   "Switzerland",
		Latitude:  &lat,
		Longitude: &lon,
	}

	err := svc.UpdateHouseholdAddress(ctx, ownerID, hhID, req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if repo.households[hhID].City != "Zurich" {
		t.Errorf("expected Zurich, got %s", repo.households[hhID].City)
	}
}

func TestHouseholdService_EdgeCases(t *testing.T) {
	repo := newMockRepository()
	discardLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := household.NewService(repo, discardLogger)
	ctx := context.Background()

	ownerID := "owner-1"
	memberID := "member-1"
	hhID := "hh-edge-1"
	repo.households[hhID] = &household.Household{ID: hhID, OwnerID: ownerID}
	repo.members[hhID] = map[string]household.HouseholdRole{
		ownerID:  household.RoleOwner,
		memberID: household.RoleMember,
	}

	t.Run("CreateInvite zero TTL uses default 24h", func(t *testing.T) {
		inv, err := svc.CreateInvite(ctx, ownerID, household.CreateInviteRequest{
			HouseholdID: hhID,
			Role:        "MEMBER",
			TTLMinutes:  0,
		})
		if err != nil {
			t.Fatalf("unexpected error on zero TTL default: %v", err)
		}
		if inv.Token == "" {
			t.Errorf("expected valid invite token")
		}
	})

	t.Run("CreateInvite non-admin requester", func(t *testing.T) {
		_, err := svc.CreateInvite(ctx, memberID, household.CreateInviteRequest{
			HouseholdID: hhID,
			Role:        "MEMBER",
			TTLMinutes:  30,
		})
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess, got %v", err)
		}
	})

	t.Run("JoinHousehold invalid token", func(t *testing.T) {
		_, err := svc.JoinHousehold(ctx, &middleware.UserClaims{Subject: "new-user"}, "non-existent-token")
		if err != household.ErrInviteNotFound {
			t.Errorf("expected ErrInviteNotFound, got %v", err)
		}

		repo.invites["expired-token"] = &household.Invite{
			Token:       "expired-token",
			HouseholdID: hhID,
			ExpiresAt:   time.Now().Add(-time.Hour),
			MaxUses:     1,
		}
		_, err = svc.JoinHousehold(ctx, &middleware.UserClaims{Subject: "new-user"}, "expired-token")
		if err != household.ErrInviteExpiredOrInvalid {
			t.Errorf("expected ErrInviteExpiredOrInvalid, got %v", err)
		}
	})

	t.Run("UpdateMemberRole trying to change owner role", func(t *testing.T) {
		err := svc.UpdateMemberRole(ctx, ownerID, hhID, ownerID, household.RoleMember)
		if !errors.Is(err, household.ErrCannotChangeOwnerRole) {
			t.Errorf("expected cannot change role error, got %v", err)
		}
	})

	t.Run("UpdateMemberRole non-owner requester", func(t *testing.T) {
		err := svc.UpdateMemberRole(ctx, memberID, hhID, memberID, household.RoleAdmin)
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess, got %v", err)
		}
	})

	t.Run("RemoveMember non-owner requester removing another non-owner", func(t *testing.T) {
		repo.members[hhID]["member-2"] = household.RoleMember
		err := svc.RemoveMember(ctx, memberID, hhID, "member-2")
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess, got %v", err)
		}
	})

	t.Run("UpdateHouseholdAddress non-owner requester", func(t *testing.T) {
		err := svc.UpdateHouseholdAddress(ctx, memberID, hhID, household.UpdateHouseholdAddressRequest{City: "Test"})
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess, got %v", err)
		}
	})

	t.Run("CreateHousehold validation edge cases", func(t *testing.T) {
		claims := &middleware.UserClaims{Subject: "u1", Email: "u1@e.com", PreferredUsername: "u1"}
		_, err := svc.CreateHousehold(ctx, claims, household.CreateHouseholdRequest{Name: ""})
		if err == nil {
			t.Fatal("expected error on empty household name, got nil")
		}

		_, err = svc.CreateHousehold(ctx, claims, household.CreateHouseholdRequest{Name: "???"})
		if err == nil {
			t.Fatal("expected error on invalid slug characters, got nil")
		}
	})

	t.Run("RemoveMember cannot remove owner and self removal allowed", func(t *testing.T) {
		err := svc.RemoveMember(ctx, ownerID, hhID, ownerID)
		if err != household.ErrCannotRemoveOwner {
			t.Errorf("expected ErrCannotRemoveOwner, got %v", err)
		}

		// User leaving household
		err = svc.RemoveMember(ctx, memberID, hhID, memberID)
		if err != nil {
			t.Errorf("expected member to be able to leave household, got %v", err)
		}
	})
}
