package contact_test

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"alfheim/dashboard/internal/features/contact"
	"alfheim/dashboard/internal/features/household"
)

type mockRepository struct {
	categories map[string]*contact.ContactCategory
	contacts   map[string]*contact.Contact
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		categories: make(map[string]*contact.ContactCategory),
		contacts:   make(map[string]*contact.Contact),
	}
}

func (m *mockRepository) CreateCategory(ctx context.Context, cat *contact.ContactCategory) error {
	m.categories[cat.ID] = cat
	return nil
}

func (m *mockRepository) GetCategories(ctx context.Context, householdID string) ([]*contact.ContactCategory, error) {
	var cats []*contact.ContactCategory
	for _, cat := range m.categories {
		if cat.HouseholdID == householdID {
			cats = append(cats, cat)
		}
	}
	return cats, nil
}

func (m *mockRepository) GetCategoryByID(ctx context.Context, id string) (*contact.ContactCategory, error) {
	if cat, ok := m.categories[id]; ok {
		return cat, nil
	}
	return nil, contact.ErrCategoryNotFound
}

func (m *mockRepository) UpdateCategory(ctx context.Context, cat *contact.ContactCategory) error {
	if _, ok := m.categories[cat.ID]; ok {
		m.categories[cat.ID] = cat
		return nil
	}
	return contact.ErrCategoryNotFound
}

func (m *mockRepository) DeleteCategory(ctx context.Context, id string) error {
	if _, ok := m.categories[id]; ok {
		delete(m.categories, id)
		return nil
	}
	return contact.ErrCategoryNotFound
}

func (m *mockRepository) CreateContact(ctx context.Context, c *contact.Contact) error {
	m.contacts[c.ID] = c
	return nil
}

func (m *mockRepository) GetContacts(ctx context.Context, householdID string) ([]*contact.Contact, error) {
	var contacts []*contact.Contact
	for _, c := range m.contacts {
		if c.HouseholdID == householdID {
			contacts = append(contacts, c)
		}
	}
	return contacts, nil
}

func (m *mockRepository) GetContactByID(ctx context.Context, id string) (*contact.Contact, error) {
	if c, ok := m.contacts[id]; ok {
		return c, nil
	}
	return nil, contact.ErrContactNotFound
}

func (m *mockRepository) UpdateContact(ctx context.Context, c *contact.Contact) error {
	if _, ok := m.contacts[c.ID]; ok {
		m.contacts[c.ID] = c
		return nil
	}
	return contact.ErrContactNotFound
}

func (m *mockRepository) DeleteContact(ctx context.Context, id string) error {
	if _, ok := m.contacts[id]; ok {
		delete(m.contacts, id)
		return nil
	}
	return contact.ErrContactNotFound
}

type mockHouseholdRepo struct {
	members map[string]map[string]household.HouseholdRole
}

func newMockHouseholdRepo() *mockHouseholdRepo {
	return &mockHouseholdRepo{
		members: make(map[string]map[string]household.HouseholdRole),
	}
}

// Dummy implementations for household.Repository interface
func (m *mockHouseholdRepo) CreateHouseholdTx(ctx context.Context, h *household.Household, ownerEmail, ownerUsername string) error {
	return nil
}
func (m *mockHouseholdRepo) GetHouseholdByID(ctx context.Context, id string) (*household.Household, error) {
	return nil, nil
}
func (m *mockHouseholdRepo) GetHouseholdsByUserID(ctx context.Context, userID string) ([]*household.Household, error) {
	return nil, nil
}
func (m *mockHouseholdRepo) AddMember(ctx context.Context, mem *household.Member) error { return nil }
func (m *mockHouseholdRepo) RemoveMember(ctx context.Context, householdID string, userID string) error {
	return nil
}
func (m *mockHouseholdRepo) UpdateMemberRole(ctx context.Context, householdID string, userID string, role household.HouseholdRole) error {
	return nil
}
func (m *mockHouseholdRepo) GetMembers(ctx context.Context, householdID string) ([]*household.Member, error) {
	return nil, nil
}
func (m *mockHouseholdRepo) CreateInvite(ctx context.Context, invite *household.Invite) error {
	return nil
}
func (m *mockHouseholdRepo) GetInviteByToken(ctx context.Context, token string) (*household.Invite, error) {
	return nil, nil
}
func (m *mockHouseholdRepo) IncrementInviteUses(ctx context.Context, token string) error { return nil }
func (m *mockHouseholdRepo) UpdateHouseholdAddress(ctx context.Context, id string, street, zip, city, country string, latitude, longitude *float64) error {
	return nil
}

func (m *mockHouseholdRepo) GetMemberRole(ctx context.Context, householdID string, userID string) (household.HouseholdRole, error) {
	if roles, ok := m.members[householdID]; ok {
		if role, ok2 := roles[userID]; ok2 {
			return role, nil
		}
	}
	return "", household.ErrUnauthorizedHouseholdAccess
}

func TestContactService_CategoryOperations(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepository()
	hhRepo := newMockHouseholdRepo()
	hhRepo.members["hh-1"] = map[string]household.HouseholdRole{
		"user-1": household.RoleAdmin,
		"user-2": household.RoleMember, // Doesn't have permission to modify categories
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := contact.NewService(repo, hhRepo, logger)

	// Create Category
	cat, err := svc.CreateCategory(ctx, "user-1", "hh-1", contact.CreateCategoryRequest{
		Name: "Plumbers",
		Icon: "wrench",
	})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if cat.Name != "Plumbers" {
		t.Errorf("expected Plumbers, got %s", cat.Name)
	}

	// Create Category Unauthorized
	_, err = svc.CreateCategory(ctx, "user-2", "hh-1", contact.CreateCategoryRequest{Name: "Electricians"})
	if err != household.ErrUnauthorizedHouseholdAccess {
		t.Errorf("expected ErrUnauthorizedHouseholdAccess, got: %v", err)
	}

	// Get Categories
	cats, err := svc.GetCategories(ctx, "user-2", "hh-1") // Member can read
	if err != nil {
		t.Fatalf("expected no error reading categories, got: %v", err)
	}
	if len(cats) != 1 {
		t.Errorf("expected 1 category, got %d", len(cats))
	}

	// Update Category
	updated, err := svc.UpdateCategory(ctx, "user-1", "hh-1", cat.ID, contact.CreateCategoryRequest{
		Name: "Plumbers Updated",
	})
	if err != nil {
		t.Fatalf("expected no error updating, got: %v", err)
	}
	if updated.Name != "Plumbers Updated" {
		t.Errorf("expected Plumbers Updated, got %s", updated.Name)
	}

	// Delete Category
	err = svc.DeleteCategory(ctx, "user-1", "hh-1", cat.ID)
	if err != nil {
		t.Fatalf("expected no error deleting, got: %v", err)
	}

	// Verify Deletion
	cats, _ = svc.GetCategories(ctx, "user-1", "hh-1")
	if len(cats) != 0 {
		t.Errorf("expected 0 categories, got %d", len(cats))
	}
}

func TestContactService_ContactOperations(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepository()
	hhRepo := newMockHouseholdRepo()
	hhRepo.members["hh-1"] = map[string]household.HouseholdRole{
		"user-1":     household.RoleAdmin,
		"user-guest": household.RoleGuest, // Guests cannot modify contacts
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := contact.NewService(repo, hhRepo, logger)

	// Create Contact
	c, err := svc.CreateContact(ctx, "user-1", "hh-1", contact.CreateContactRequest{
		Name:  "John Doe",
		Phone: "123-456-7890",
	})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if c.Name != "John Doe" {
		t.Errorf("expected John Doe, got %s", c.Name)
	}

	// Create Contact Unauthorized
	_, err = svc.CreateContact(ctx, "user-guest", "hh-1", contact.CreateContactRequest{Name: "Jane Doe"})
	if err != household.ErrUnauthorizedHouseholdAccess {
		t.Errorf("expected ErrUnauthorizedHouseholdAccess, got: %v", err)
	}

	// Get Contacts
	contacts, err := svc.GetContacts(ctx, "user-guest", "hh-1") // Guest can read
	if err != nil {
		t.Fatalf("expected no error reading contacts, got: %v", err)
	}
	if len(contacts) != 1 {
		t.Errorf("expected 1 contact, got %d", len(contacts))
	}

	// Update Contact
	updated, err := svc.UpdateContact(ctx, "user-1", "hh-1", c.ID, contact.CreateContactRequest{
		Name:  "John Smith",
		Phone: "098-765-4321",
	})
	if err != nil {
		t.Fatalf("expected no error updating, got: %v", err)
	}
	if updated.Name != "John Smith" {
		t.Errorf("expected John Smith, got %s", updated.Name)
	}

	// Delete Contact
	err = svc.DeleteContact(ctx, "user-1", "hh-1", c.ID)
	if err != nil {
		t.Fatalf("expected no error deleting, got: %v", err)
	}

	// Verify Deletion
	contacts, _ = svc.GetContacts(ctx, "user-1", "hh-1")
	if len(contacts) != 0 {
		t.Errorf("expected 0 contacts, got %d", len(contacts))
	}
}

func TestContactService_EdgeCases(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepository()
	hhRepo := newMockHouseholdRepo()
	hhRepo.members["hh-1"] = map[string]household.HouseholdRole{
		"user-1":      household.RoleOwner,
		"user-member": household.RoleMember,
		"user-guest":  household.RoleGuest,
	}
	hhRepo.members["hh-2"] = map[string]household.HouseholdRole{"user-1": household.RoleOwner}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := contact.NewService(repo, hhRepo, logger)

	t.Run("CreateCategory empty name error", func(t *testing.T) {
		_, err := svc.CreateCategory(ctx, "user-1", "hh-1", contact.CreateCategoryRequest{Name: ""})
		if err == nil {
			t.Fatal("expected error on empty category name")
		}
	})

	t.Run("UpdateCategory empty name or wrong household", func(t *testing.T) {
		cat, _ := svc.CreateCategory(ctx, "user-1", "hh-1", contact.CreateCategoryRequest{Name: "Cat1"})

		_, err := svc.UpdateCategory(ctx, "user-1", "hh-2", cat.ID, contact.CreateCategoryRequest{Name: "Cat1"})
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess, got %v", err)
		}

		_, err = svc.UpdateCategory(ctx, "user-1", "hh-1", cat.ID, contact.CreateCategoryRequest{Name: ""})
		if err == nil {
			t.Fatal("expected error on empty category name update")
		}
	})

	t.Run("DeleteCategory wrong household", func(t *testing.T) {
		cat, _ := svc.CreateCategory(ctx, "user-1", "hh-1", contact.CreateCategoryRequest{Name: "CatDel"})
		err := svc.DeleteCategory(ctx, "user-1", "hh-2", cat.ID)
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess, got %v", err)
		}
	})

	t.Run("CreateContact with category belonging to another household", func(t *testing.T) {
		cat, _ := svc.CreateCategory(ctx, "user-1", "hh-2", contact.CreateCategoryRequest{Name: "HH2 Cat"})
		catID := cat.ID

		_, err := svc.CreateContact(ctx, "user-1", "hh-1", contact.CreateContactRequest{
			Name:       "Test",
			CategoryID: &catID,
		})
		if err == nil {
			t.Fatal("expected error creating contact with category from another household")
		}
	})

	t.Run("CreateContact empty name", func(t *testing.T) {
		_, err := svc.CreateContact(ctx, "user-1", "hh-1", contact.CreateContactRequest{Name: ""})
		if err == nil {
			t.Fatal("expected error on empty contact name")
		}
	})

	t.Run("UpdateContact wrong household or category", func(t *testing.T) {
		c, _ := svc.CreateContact(ctx, "user-1", "hh-1", contact.CreateContactRequest{Name: "Contact1"})
		cat2, _ := svc.CreateCategory(ctx, "user-1", "hh-2", contact.CreateCategoryRequest{Name: "HH2 Cat"})
		cat2ID := cat2.ID

		_, err := svc.UpdateContact(ctx, "user-1", "hh-2", c.ID, contact.CreateContactRequest{Name: "Updated"})
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess, got %v", err)
		}

		_, err = svc.UpdateContact(ctx, "user-1", "hh-1", c.ID, contact.CreateContactRequest{Name: ""})
		if err == nil {
			t.Fatal("expected error on empty contact name update")
		}

		_, err = svc.UpdateContact(ctx, "user-1", "hh-1", c.ID, contact.CreateContactRequest{Name: "Valid", CategoryID: &cat2ID})
		if err == nil {
			t.Fatal("expected error updating contact with cross-tenant category")
		}
	})

	t.Run("DeleteContact wrong household", func(t *testing.T) {
		c, _ := svc.CreateContact(ctx, "user-1", "hh-1", contact.CreateContactRequest{Name: "ContactDel"})
		err := svc.DeleteContact(ctx, "user-1", "hh-2", c.ID)
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess, got %v", err)
		}
	})

	t.Run("Unauthorized role checks across service methods", func(t *testing.T) {
		// user-guest has RoleGuest
		// user-unauthorized is not in household
		_, err := svc.GetCategories(ctx, "user-unauthorized", "hh-1")
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess for GetCategories, got %v", err)
		}

		_, err = svc.GetContacts(ctx, "user-unauthorized", "hh-1")
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess for GetContacts, got %v", err)
		}

		// Member cannot create, update, or delete categories
		_, err = svc.CreateCategory(ctx, "user-member", "hh-1", contact.CreateCategoryRequest{Name: "Cat"})
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess for CreateCategory, got %v", err)
		}

		cat, _ := svc.CreateCategory(ctx, "user-1", "hh-1", contact.CreateCategoryRequest{Name: "CatTest"})
		_, err = svc.UpdateCategory(ctx, "user-member", "hh-1", cat.ID, contact.CreateCategoryRequest{Name: "Updated"})
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess for UpdateCategory, got %v", err)
		}

		err = svc.DeleteCategory(ctx, "user-member", "hh-1", cat.ID)
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess for DeleteCategory, got %v", err)
		}

		// Guest cannot create, update, or delete contacts
		_, err = svc.CreateContact(ctx, "user-guest", "hh-1", contact.CreateContactRequest{Name: "Cont"})
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess for CreateContact, got %v", err)
		}

		c, _ := svc.CreateContact(ctx, "user-1", "hh-1", contact.CreateContactRequest{Name: "ContTest"})
		_, err = svc.UpdateContact(ctx, "user-guest", "hh-1", c.ID, contact.CreateContactRequest{Name: "Updated"})
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess for UpdateContact, got %v", err)
		}

		err = svc.DeleteContact(ctx, "user-guest", "hh-1", c.ID)
		if err != household.ErrUnauthorizedHouseholdAccess {
			t.Errorf("expected ErrUnauthorizedHouseholdAccess for DeleteContact, got %v", err)
		}
	})
}
