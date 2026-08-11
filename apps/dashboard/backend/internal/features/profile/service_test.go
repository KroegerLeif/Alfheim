package profile_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"alfheim/dashboard/internal/features/profile"
	"alfheim/dashboard/internal/shared/middleware"
)

type mockProfileRepository struct {
	profiles map[string]*profile.Profile
}

func newMockProfileRepository() *mockProfileRepository {
	return &mockProfileRepository{
		profiles: make(map[string]*profile.Profile),
	}
}

func (m *mockProfileRepository) GetByID(ctx context.Context, id string) (*profile.Profile, error) {
	p, ok := m.profiles[id]
	if !ok {
		return nil, profile.ErrProfileNotFound
	}
	return p, nil
}

func (m *mockProfileRepository) Upsert(ctx context.Context, p *profile.Profile) error {
	now := time.Now()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	m.profiles[p.ID] = p
	return nil
}

func (m *mockProfileRepository) Update(ctx context.Context, p *profile.Profile) error {
	existing, ok := m.profiles[p.ID]
	if !ok {
		return profile.ErrProfileNotFound
	}
	existing.FirstName = p.FirstName
	existing.LastName = p.LastName
	existing.AvatarURL = p.AvatarURL
	existing.UpdatedAt = time.Now()
	return nil
}

func TestProfileService_JITProvisioningAndSync(t *testing.T) {
	repo := newMockProfileRepository()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := profile.NewService(repo, nil, logger)
	ctx := context.Background()

	claims := &middleware.UserClaims{
		Subject:           "user-sub-123",
		Email:             "john.doe@example.com",
		PreferredUsername: "johndoe",
		GivenName:         "John",
		FamilyName:        "Doe",
	}

	// 1. Test JIT Provisioning
	p1, err := svc.SyncProfileFromClaims(ctx, claims)
	if err != nil {
		t.Fatalf("expected no error during JIT provisioning, got: %v", err)
	}
	if p1.ID != "user-sub-123" {
		t.Errorf("expected ID 'user-sub-123', got '%s'", p1.ID)
	}
	if p1.FirstName != "John" || p1.LastName != "Doe" {
		t.Errorf("expected John Doe, got %s %s", p1.FirstName, p1.LastName)
	}

	// 2. Test Fetching Profile by ID
	fetched, err := svc.GetProfileByID(ctx, "user-sub-123")
	if err != nil {
		t.Fatalf("expected profile to be fetched, got: %v", err)
	}
	if fetched.Email != "john.doe@example.com" {
		t.Errorf("expected email john.doe@example.com, got %s", fetched.Email)
	}

	// 3. Test Updating Profile
	updateDTO := profile.UpdateDTO{
		FirstName: "Johnny",
		LastName:  "Doe",
		AvatarURL: "https://example.com/avatar.png",
	}

	updated, err := svc.UpdateProfile(ctx, "user-sub-123", updateDTO)
	if err != nil {
		t.Fatalf("expected no error updating profile, got: %v", err)
	}
	if updated.FirstName != "Johnny" {
		t.Errorf("expected updated first name 'Johnny', got '%s'", updated.FirstName)
	}
	if updated.AvatarURL != "https://example.com/avatar.png" {
		t.Errorf("expected updated avatar url, got '%s'", updated.AvatarURL)
	}
}
