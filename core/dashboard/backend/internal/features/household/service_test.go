package household_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"alfheim/dashboard/internal/features/household"
	"alfheim/dashboard/internal/shared/middleware"
)

type mockRepository struct {
	households map[string]*household.Household
	members    map[string]map[string]household.HouseholdRole
	invites    map[string]*household.Invite
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		households: make(map[string]*household.Household),
		members:    make(map[string]map[string]household.HouseholdRole),
		invites:    make(map[string]*household.Invite),
	}
}

func (m *mockRepository) CreateHouseholdTx(ctx context.Context, h *household.Household, ownerEmail, ownerUsername string) error {
	h.ID = "test-household-id-1"
	h.CreatedAt = time.Now()
	h.UpdatedAt = time.Now()
	m.households[h.ID] = h

	if m.members[h.ID] == nil {
		m.members[h.ID] = make(map[string]household.HouseholdRole)
	}
	m.members[h.ID][h.OwnerID] = household.RoleOwner
	return nil
}

func (m *mockRepository) GetHouseholdByID(ctx context.Context, id string) (*household.Household, error) {
	h, ok := m.households[id]
	if !ok {
		return nil, household.ErrHouseholdNotFound
	}
	return h, nil
}

func (m *mockRepository) GetHouseholdsByUserID(ctx context.Context, userID string) ([]*household.Household, error) {
	var res []*household.Household
	for hid, userRoles := range m.members {
		if _, ok := userRoles[userID]; ok {
			res = append(res, m.households[hid])
		}
	}
	return res, nil
}

func (m *mockRepository) AddMember(ctx context.Context, mem *household.Member) error {
	if m.members[mem.HouseholdID] == nil {
		m.members[mem.HouseholdID] = make(map[string]household.HouseholdRole)
	}
	if _, exists := m.members[mem.HouseholdID][mem.UserID]; exists {
		return household.ErrMemberAlreadyExists
	}
	m.members[mem.HouseholdID][mem.UserID] = mem.Role
	return nil
}

func (m *mockRepository) RemoveMember(ctx context.Context, householdID string, userID string) error {
	if m.members[householdID] == nil {
		return household.ErrMemberNotFound
	}
	delete(m.members[householdID], userID)
	return nil
}

func (m *mockRepository) UpdateMemberRole(ctx context.Context, householdID string, userID string, role household.HouseholdRole) error {
	if m.members[householdID] == nil || m.members[householdID][userID] == "" {
		return household.ErrMemberNotFound
	}
	m.members[householdID][userID] = role
	return nil
}

func (m *mockRepository) GetMemberRole(ctx context.Context, householdID string, userID string) (household.HouseholdRole, error) {
	if m.members[householdID] == nil {
		return "", household.ErrUnauthorizedHouseholdAccess
	}
	role, ok := m.members[householdID][userID]
	if !ok {
		return "", household.ErrUnauthorizedHouseholdAccess
	}
	return role, nil
}

func (m *mockRepository) GetMembers(ctx context.Context, householdID string) ([]*household.Member, error) {
	var res []*household.Member
	userRoles := m.members[householdID]
	for uid, r := range userRoles {
		res = append(res, &household.Member{
			HouseholdID: householdID,
			UserID:      uid,
			Role:        r,
			JoinedAt:    time.Now(),
		})
	}
	return res, nil
}

func (m *mockRepository) CreateInvite(ctx context.Context, invite *household.Invite) error {
	m.invites[invite.Token] = invite
	return nil
}

func (m *mockRepository) GetInviteByToken(ctx context.Context, token string) (*household.Invite, error) {
	inv, ok := m.invites[token]
	if !ok {
		return nil, household.ErrInviteNotFound
	}
	return inv, nil
}

func (m *mockRepository) IncrementInviteUses(ctx context.Context, token string) error {
	if inv, ok := m.invites[token]; ok {
		inv.Uses++
	}
	return nil
}

func (m *mockRepository) UpdateHouseholdAddress(ctx context.Context, id string, street, zip, city, country string, latitude, longitude *float64) error {
	h, ok := m.households[id]
	if !ok {
		return household.ErrHouseholdNotFound
	}
	h.Street = street
	h.Zip = zip
	h.City = city
	h.Country = country
	h.Latitude = latitude
	h.Longitude = longitude
	return nil
}

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
	joinedH, err := svc.JoinHousehold(ctx, joinUserID, invResp.Token)
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
		ownerID: household.RoleOwner,
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
		Street: "Bahnhofstrasse",
		Zip: "8001",
		City: "Zurich",
		Country: "Switzerland",
		Latitude: &lat,
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

func TestHouseholdInvite_IsValid(t *testing.T) {
	t.Run("valid invite", func(t *testing.T) {
		inv := &household.Invite{
			ExpiresAt: time.Now().Add(time.Hour),
			MaxUses:   5,
			Uses:      2,
		}
		if !inv.IsValid() {
			t.Errorf("expected invite to be valid")
		}
	})

	t.Run("expired invite", func(t *testing.T) {
		inv := &household.Invite{
			ExpiresAt: time.Now().Add(-time.Hour),
			MaxUses:   5,
			Uses:      0,
		}
		if inv.IsValid() {
			t.Errorf("expected expired invite to be invalid")
		}
	})

	t.Run("max uses reached", func(t *testing.T) {
		inv := &household.Invite{
			ExpiresAt: time.Now().Add(time.Hour),
			MaxUses:   2,
			Uses:      2,
		}
		if inv.IsValid() {
			t.Errorf("expected invite with max uses reached to be invalid")
		}
	})
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
		_, err := svc.JoinHousehold(ctx, "new-user", "non-existent-token")
		if err != household.ErrInviteNotFound {
			t.Errorf("expected ErrInviteNotFound, got %v", err)
		}

		repo.invites["expired-token"] = &household.Invite{
			Token:       "expired-token",
			HouseholdID: hhID,
			ExpiresAt:   time.Now().Add(-time.Hour),
		}
		_, err = svc.JoinHousehold(ctx, "new-user", "expired-token")
		if err != household.ErrInviteExpiredOrInvalid {
			t.Errorf("expected ErrInviteExpiredOrInvalid, got %v", err)
		}
	})

	t.Run("UpdateMemberRole trying to change owner role", func(t *testing.T) {
		err := svc.UpdateMemberRole(ctx, ownerID, hhID, ownerID, household.RoleMember)
		if err == nil || err.Error() != "cannot change role of household owner" {
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
}
