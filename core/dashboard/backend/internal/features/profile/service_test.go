package profile_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"alfheim/dashboard/internal/features/profile"
	"alfheim/dashboard/internal/shared/middleware"
)

type mockProfileRepository struct {
	profiles  map[string]*profile.Profile
	getErr    error
	upsertErr error
	updateErr error
}

func newMockProfileRepository() *mockProfileRepository {
	return &mockProfileRepository{
		profiles: make(map[string]*profile.Profile),
	}
}

func (m *mockProfileRepository) GetByID(ctx context.Context, id string) (*profile.Profile, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	p, ok := m.profiles[id]
	if !ok {
		return nil, profile.ErrProfileNotFound
	}
	// Return copy
	cp := *p
	return &cp, nil
}

func (m *mockProfileRepository) Upsert(ctx context.Context, p *profile.Profile) error {
	if m.upsertErr != nil {
		return m.upsertErr
	}
	now := time.Now()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	m.profiles[p.ID] = p
	return nil
}

func (m *mockProfileRepository) Update(ctx context.Context, p *profile.Profile) error {
	if m.updateErr != nil {
		return m.updateErr
	}
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
	svc := profile.NewService(repo, logger)
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

	// 3. Test Sync existing profile with updated claims
	updatedClaims := &middleware.UserClaims{
		Subject:           "user-sub-123",
		Email:             "new.email@example.com",
		PreferredUsername: "newusername",
		GivenName:         "Johnny",
		FamilyName:        "Doey",
	}
	synced, err := svc.SyncProfileFromClaims(ctx, updatedClaims)
	if err != nil {
		t.Fatalf("unexpected error syncing existing profile: %v", err)
	}
	if synced.Email != "new.email@example.com" || synced.Username != "newusername" || synced.FirstName != "Johnny" || synced.LastName != "Doey" {
		t.Errorf("expected updated fields in synced profile, got: %+v", synced)
	}

	// 4. Test Sync existing profile with no claim changes
	synced2, err := svc.SyncProfileFromClaims(ctx, updatedClaims)
	if err != nil {
		t.Fatalf("unexpected error syncing unchanged profile: %v", err)
	}
	if synced2.Email != "new.email@example.com" {
		t.Errorf("expected email new.email@example.com, got %s", synced2.Email)
	}

	// 5. Test Update Profile
	updateDTO := profile.UpdateDTO{
		FirstName: "JohnnyUpdated",
		LastName:  "DoeUpdated",
		AvatarURL: "https://example.com/avatar.png",
	}
	updated, err := svc.UpdateProfile(ctx, "user-sub-123", updateDTO)
	if err != nil {
		t.Fatalf("expected no error updating profile, got: %v", err)
	}
	if updated.FirstName != "JohnnyUpdated" {
		t.Errorf("expected updated first name 'JohnnyUpdated', got '%s'", updated.FirstName)
	}
	if updated.AvatarURL != "https://example.com/avatar.png" {
		t.Errorf("expected updated avatar url, got '%s'", updated.AvatarURL)
	}
}

func TestProfileService_SyncAndUpdateErrors(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx := context.Background()

	t.Run("GetByID unexpected error returns error", func(t *testing.T) {
		repo := newMockProfileRepository()
		repo.getErr = errors.New("db connection pool closed")
		svc := profile.NewService(repo, logger)

		claims := &middleware.UserClaims{Subject: "user-err"}
		_, err := svc.SyncProfileFromClaims(ctx, claims)
		if err == nil {
			t.Fatal("expected error from SyncProfileFromClaims when GetByID fails, got nil")
		}
	})

	t.Run("Upsert error on existing profile sync returns error", func(t *testing.T) {
		repo := newMockProfileRepository()
		repo.profiles["user-1"] = &profile.Profile{
			ID:    "user-1",
			Email: "old@example.com",
		}
		repo.upsertErr = errors.New("upsert failed")
		svc := profile.NewService(repo, logger)

		claims := &middleware.UserClaims{Subject: "user-1", Email: "new@example.com"}
		_, err := svc.SyncProfileFromClaims(ctx, claims)
		if err == nil {
			t.Fatal("expected error when Upsert fails during sync, got nil")
		}
	})

	t.Run("Upsert error on JIT provisioning returns error", func(t *testing.T) {
		repo := newMockProfileRepository()
		repo.upsertErr = errors.New("upsert failed")
		svc := profile.NewService(repo, logger)

		claims := &middleware.UserClaims{Subject: "user-jit-err"}
		_, err := svc.SyncProfileFromClaims(ctx, claims)
		if err == nil {
			t.Fatal("expected error when JIT Upsert fails, got nil")
		}
	})

	t.Run("UpdateProfile error when profile not found", func(t *testing.T) {
		repo := newMockProfileRepository()
		svc := profile.NewService(repo, logger)

		_, err := svc.UpdateProfile(ctx, "nonexistent", profile.UpdateDTO{FirstName: "A"})
		if !errors.Is(err, profile.ErrProfileNotFound) {
			t.Errorf("expected ErrProfileNotFound, got %v", err)
		}
	})

	t.Run("UpdateProfile error when db update fails", func(t *testing.T) {
		repo := newMockProfileRepository()
		repo.profiles["user-1"] = &profile.Profile{ID: "user-1"}
		repo.updateErr = errors.New("db update failed")
		svc := profile.NewService(repo, logger)

		_, err := svc.UpdateProfile(ctx, "user-1", profile.UpdateDTO{FirstName: "A"})
		if err == nil {
			t.Fatal("expected error when repo Update fails, got nil")
		}
	})

	t.Run("UpdateProfile succeeds and returns updated entity", func(t *testing.T) {
		repo := newMockProfileRepository()
		repo.profiles["user-ok"] = &profile.Profile{ID: "user-ok", FirstName: "Old", LastName: "Name"}
		svc := profile.NewService(repo, logger)

		updated, err := svc.UpdateProfile(ctx, "user-ok", profile.UpdateDTO{
			FirstName: "NewFirst",
			LastName:  "NewLast",
			AvatarURL: "https://avatar.example/test.png",
		})
		if err != nil {
			t.Fatalf("unexpected error updating profile: %v", err)
		}
		if updated.FirstName != "NewFirst" || updated.LastName != "NewLast" {
			t.Errorf("expected updated names, got %+v", updated)
		}
	})
}
