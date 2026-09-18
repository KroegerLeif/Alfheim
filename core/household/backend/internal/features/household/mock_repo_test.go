package household_test

import (
	"context"
	"errors"
	"sync"
	"time"

	"alfheim/household/internal/features/household"
)

// mockRepository is an in-memory household.Repository that mirrors the SQL
// semantics the service relies on (default household, atomic invite redemption,
// ownership transfer).
type mockRepository struct {
	mu         sync.Mutex
	households map[string]*household.Household
	members    map[string]map[string]household.HouseholdRole
	defaults   map[string]string // userID -> householdID
	invites    map[string]*household.Invite

	// failNext, when set, is returned by the next call of the named method.
	failNext map[string]error
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		households: make(map[string]*household.Household),
		members:    make(map[string]map[string]household.HouseholdRole),
		defaults:   make(map[string]string),
		invites:    make(map[string]*household.Invite),
		failNext:   make(map[string]error),
	}
}

func (m *mockRepository) fail(method string) error {
	if err, ok := m.failNext[method]; ok {
		delete(m.failNext, method)
		return err
	}
	return nil
}

func (m *mockRepository) addMemberLocked(householdID, userID string, role household.HouseholdRole) {
	if m.members[householdID] == nil {
		m.members[householdID] = make(map[string]household.HouseholdRole)
	}
	m.members[householdID][userID] = role
	if _, ok := m.defaults[userID]; !ok {
		m.defaults[userID] = householdID
	}
}

func (m *mockRepository) CreateHouseholdTx(ctx context.Context, h *household.Household, ownerEmail, ownerUsername string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.fail("CreateHouseholdTx"); err != nil {
		return err
	}
	h.CreatedAt = time.Now()
	h.UpdatedAt = time.Now()
	m.households[h.ID] = h
	m.addMemberLocked(h.ID, h.OwnerID, household.RoleOwner)
	return nil
}

func (m *mockRepository) GetHouseholdByID(ctx context.Context, id string) (*household.Household, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.fail("GetHouseholdByID"); err != nil {
		return nil, err
	}
	h, ok := m.households[id]
	if !ok {
		return nil, household.ErrHouseholdNotFound
	}
	return h, nil
}

func (m *mockRepository) GetHouseholdsByUserID(ctx context.Context, userID string) ([]*household.Household, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.fail("GetHouseholdsByUserID"); err != nil {
		return nil, err
	}
	var res []*household.Household
	for hid, userRoles := range m.members {
		if _, ok := userRoles[userID]; ok {
			res = append(res, m.households[hid])
		}
	}
	return res, nil
}

func (m *mockRepository) RenameHousehold(ctx context.Context, id string, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	h, ok := m.households[id]
	if !ok {
		return household.ErrHouseholdNotFound
	}
	h.Name = name
	return nil
}

func (m *mockRepository) DeleteHousehold(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.households[id]; !ok {
		return household.ErrHouseholdNotFound
	}
	delete(m.households, id)
	delete(m.members, id)
	for tok, inv := range m.invites {
		if inv.HouseholdID == id {
			delete(m.invites, tok)
		}
	}
	for uid, hid := range m.defaults {
		if hid == id {
			delete(m.defaults, uid)
		}
	}
	return nil
}

func (m *mockRepository) TransferOwnershipTx(ctx context.Context, householdID, fromUserID, toUserID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.fail("TransferOwnershipTx"); err != nil {
		return err
	}
	mem := m.members[householdID]
	if mem[fromUserID] != household.RoleOwner {
		return household.ErrUnauthorizedHouseholdAccess
	}
	if _, ok := mem[toUserID]; !ok {
		return household.ErrMemberNotFound
	}
	mem[fromUserID] = household.RoleAdmin
	mem[toUserID] = household.RoleOwner
	m.households[householdID].OwnerID = toUserID
	return nil
}

func (m *mockRepository) GetDefaultHouseholdID(ctx context.Context, userID string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.fail("GetDefaultHouseholdID"); err != nil {
		return "", err
	}
	return m.defaults[userID], nil
}

func (m *mockRepository) SetDefaultHouseholdTx(ctx context.Context, userID, householdID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.members[householdID][userID]; !ok {
		return household.ErrUnauthorizedHouseholdAccess
	}
	m.defaults[userID] = householdID
	return nil
}

func (m *mockRepository) RemoveMember(ctx context.Context, householdID string, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.members[householdID][userID]; !ok {
		return household.ErrMemberNotFound
	}
	delete(m.members[householdID], userID)
	if m.defaults[userID] == householdID {
		delete(m.defaults, userID)
	}
	return nil
}

func (m *mockRepository) UpdateMemberRole(ctx context.Context, householdID string, userID string, role household.HouseholdRole) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.members[householdID] == nil || m.members[householdID][userID] == "" {
		return household.ErrMemberNotFound
	}
	m.members[householdID][userID] = role
	return nil
}

func (m *mockRepository) GetMemberRole(ctx context.Context, householdID string, userID string) (household.HouseholdRole, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.fail("GetMemberRole"); err != nil {
		return "", err
	}
	role, ok := m.members[householdID][userID]
	if !ok {
		return "", household.ErrUnauthorizedHouseholdAccess
	}
	return role, nil
}

func (m *mockRepository) GetMembers(ctx context.Context, householdID string) ([]*household.Member, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.fail("GetMembers"); err != nil {
		return nil, err
	}
	var res []*household.Member
	for uid, r := range m.members[householdID] {
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
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.fail("CreateInvite"); err != nil {
		return err
	}
	m.invites[invite.Token] = invite
	return nil
}

func (m *mockRepository) ListActiveInvites(ctx context.Context, householdID string) ([]*household.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.fail("ListActiveInvites"); err != nil {
		return nil, err
	}
	res := []*household.Invite{}
	for _, inv := range m.invites {
		if inv.HouseholdID == householdID && inv.Uses < inv.MaxUses && inv.ExpiresAt.After(time.Now()) {
			res = append(res, inv)
		}
	}
	return res, nil
}

func (m *mockRepository) DeleteInvite(ctx context.Context, householdID string, token string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[token]
	if !ok || inv.HouseholdID != householdID {
		return household.ErrInviteNotFound
	}
	delete(m.invites, token)
	return nil
}

func (m *mockRepository) RedeemInviteTx(ctx context.Context, token, userID, email, username string) (*household.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[token]
	if !ok {
		return nil, household.ErrInviteNotFound
	}
	if inv.Uses >= inv.MaxUses || !inv.ExpiresAt.After(time.Now()) {
		return nil, household.ErrInviteExpiredOrInvalid
	}
	if _, exists := m.members[inv.HouseholdID][userID]; exists {
		return nil, household.ErrMemberAlreadyExists
	}
	role := inv.Role
	if role == household.RoleOwner {
		role = household.RoleMember
	}
	inv.Uses++
	m.addMemberLocked(inv.HouseholdID, userID, role)
	cp := *inv
	cp.Role = role
	return &cp, nil
}

func (m *mockRepository) UpdateHouseholdAddress(ctx context.Context, id string, street, zip, city, country string, latitude, longitude *float64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
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

var errMockDB = errors.New("mock database failure")
