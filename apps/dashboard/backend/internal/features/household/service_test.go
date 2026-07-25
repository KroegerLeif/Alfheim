package household_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"loeger-os/dashboard/internal/features/household"
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

func (m *mockRepository) CreateHouseholdTx(ctx context.Context, h *household.Household) error {
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

func TestHouseholdService_CreateAndInvite(t *testing.T) {
	repo := newMockRepository()
	discardLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := household.NewService(repo, discardLogger)
	ctx := context.Background()

	ownerID := "user-owner-123"
	createReq := household.CreateHouseholdRequest{
		Name: "Loeger Family",
		Slug: "loeger-family",
	}

	hResp, err := svc.CreateHousehold(ctx, ownerID, createReq)
	if err != nil {
		t.Fatalf("expected no error creating household, got: %v", err)
	}
	if hResp.Name != "Loeger Family" {
		t.Errorf("expected name 'Loeger Family', got '%s'", hResp.Name)
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
