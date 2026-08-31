package profile_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Nerzal/gocloak/v13"

	"alfheim/dashboard/config"
	"alfheim/dashboard/internal/features/profile"
	"alfheim/dashboard/internal/shared/keycloak"
	"alfheim/dashboard/internal/shared/middleware"
)

type mockProfileRepository struct {
	profiles map[string]*profile.Profile
	getErr   error
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

func TestProfileService_SyncAndKeycloakErrors(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx := context.Background()

	t.Run("GetByID unexpected error returns error", func(t *testing.T) {
		repo := newMockProfileRepository()
		repo.getErr = errors.New("db connection pool closed")
		svc := profile.NewService(repo, nil, logger)

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
		svc := profile.NewService(repo, nil, logger)

		claims := &middleware.UserClaims{Subject: "user-1", Email: "new@example.com"}
		_, err := svc.SyncProfileFromClaims(ctx, claims)
		if err == nil {
			t.Fatal("expected error when Upsert fails during sync, got nil")
		}
	})

	t.Run("Upsert error on JIT provisioning returns error", func(t *testing.T) {
		repo := newMockProfileRepository()
		repo.upsertErr = errors.New("upsert failed")
		svc := profile.NewService(repo, nil, logger)

		claims := &middleware.UserClaims{Subject: "user-jit-err"}
		_, err := svc.SyncProfileFromClaims(ctx, claims)
		if err == nil {
			t.Fatal("expected error when JIT Upsert fails, got nil")
		}
	})

	t.Run("UpdateProfile error when profile not found", func(t *testing.T) {
		repo := newMockProfileRepository()
		svc := profile.NewService(repo, nil, logger)

		_, err := svc.UpdateProfile(ctx, "nonexistent", profile.UpdateDTO{FirstName: "A"})
		if !errors.Is(err, profile.ErrProfileNotFound) {
			t.Errorf("expected ErrProfileNotFound, got %v", err)
		}
	})

	t.Run("UpdateProfile error when db update fails", func(t *testing.T) {
		repo := newMockProfileRepository()
		repo.profiles["user-1"] = &profile.Profile{ID: "user-1"}
		repo.updateErr = errors.New("db update failed")
		svc := profile.NewService(repo, nil, logger)

		_, err := svc.UpdateProfile(ctx, "user-1", profile.UpdateDTO{FirstName: "A"})
		if err == nil {
			t.Fatal("expected error when repo Update fails, got nil")
		}
	})
}

func TestProfileService_WithKeycloakClient(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx := context.Background()

	// Setup fake Keycloak HTTP server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/realms/alfheim/protocol/openid-connect/token" {
			_ = json.NewEncoder(w).Encode(gocloak.JWT{
				AccessToken: "fake-access-token",
				ExpiresIn:   3600,
			})
			return
		}
		if r.URL.Path == "/admin/realms/alfheim/users/user-kc-123" {
			if r.Method == http.MethodGet {
				_ = json.NewEncoder(w).Encode(gocloak.User{
					ID:        gocloak.StringP("user-kc-123"),
					FirstName: gocloak.StringP("KeycloakFirst"),
					LastName:  gocloak.StringP("KeycloakLast"),
					Email:     gocloak.StringP("kc@example.com"),
				})
				return
			}
			if r.Method == http.MethodPut {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer ts.Close()

	kcClient := keycloak.NewClient(config.KeycloakConfig{
		BaseURL:      ts.URL,
		Realm:        "alfheim",
		ClientID:     "client",
		ClientSecret: "secret",
	}, logger)

	t.Run("JIT provisioning enriches profile from Keycloak API", func(t *testing.T) {
		repo := newMockProfileRepository()
		svc := profile.NewService(repo, kcClient, logger)

		claims := &middleware.UserClaims{
			Subject: "user-kc-123",
		}

		p, err := svc.SyncProfileFromClaims(ctx, claims)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if p.FirstName != "KeycloakFirst" || p.LastName != "KeycloakLast" || p.Email != "kc@example.com" {
			t.Errorf("expected Keycloak enriched fields, got: %+v", p)
		}
	})

	t.Run("UpdateProfile propagates change to Keycloak API", func(t *testing.T) {
		repo := newMockProfileRepository()
		repo.profiles["user-kc-123"] = &profile.Profile{
			ID:        "user-kc-123",
			FirstName: "Old",
			LastName:  "Name",
		}
		svc := profile.NewService(repo, kcClient, logger)

		updated, err := svc.UpdateProfile(ctx, "user-kc-123", profile.UpdateDTO{
			FirstName: "NewFirst",
			LastName:  "NewLast",
			AvatarURL: "https://avatar.com/test.png",
		})
		if err != nil {
			t.Fatalf("unexpected error updating profile: %v", err)
		}
		if updated.FirstName != "NewFirst" {
			t.Errorf("expected NewFirst, got %s", updated.FirstName)
		}
	})
}
