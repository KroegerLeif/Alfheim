package apps_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"loeger-os/dashboard/internal/features/apps"
)

type mockAppRepository struct {
	items []*apps.AppItem
}

func newMockAppRepository() *mockAppRepository {
	return &mockAppRepository{
		items: []*apps.AppItem{
			{
				ID:           "app-1",
				Name:         "Pantry",
				Slug:         "pantry",
				Description:  "Pantry Inventory",
				IconURL:      "/icons/pantry.svg",
				AppURL:       "/pantry",
				Category:     apps.CategoryInternal,
				RequiredRole: apps.RoleMember,
				IsActive:     true,
				DisplayOrder: 1,
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			},
			{
				ID:           "app-2",
				Name:         "Home Assistant",
				Slug:         "home-assistant",
				Description:  "Smart Home Control",
				IconURL:      "/icons/ha.svg",
				AppURL:       "https://ha.loeger.local",
				Category:     apps.CategoryExternal,
				RequiredRole: apps.RoleAdmin,
				IsActive:     true,
				DisplayOrder: 2,
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			},
			{
				ID:           "app-3",
				Name:         "Admin Console",
				Slug:         "admin-console",
				Description:  "Household Admin Management",
				IconURL:      "/icons/admin.svg",
				AppURL:       "/admin",
				Category:     apps.CategoryInternal,
				RequiredRole: apps.RoleOwner,
				IsActive:     true,
				DisplayOrder: 3,
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			},
		},
	}
}

func (m *mockAppRepository) GetActiveApps(ctx context.Context) ([]*apps.AppItem, error) {
	return m.items, nil
}

func (m *mockAppRepository) SeedDefaultApps(ctx context.Context) error {
	return nil
}

func TestAppService_RoleFilteringAndGrouping(t *testing.T) {
	repo := newMockAppRepository()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := apps.NewService(repo, logger)
	ctx := context.Background()

	// 1. Test MEMBER role (should see only MEMBER apps)
	resMember, err := svc.GetPermittedApps(ctx, []string{}, "MEMBER")
	if err != nil {
		t.Fatalf("expected no error for member query, got: %v", err)
	}
	if resMember.Total != 1 {
		t.Errorf("expected 1 permitted app for MEMBER, got %d", resMember.Total)
	}
	if len(resMember.Internal) != 1 || resMember.Internal[0].Slug != "pantry" {
		t.Errorf("expected internal app 'pantry', got %v", resMember.Internal)
	}

	// 2. Test ADMIN role (should see MEMBER and ADMIN apps)
	resAdmin, err := svc.GetPermittedApps(ctx, []string{}, "ADMIN")
	if err != nil {
		t.Fatalf("expected no error for admin query, got: %v", err)
	}
	if resAdmin.Total != 2 {
		t.Errorf("expected 2 permitted apps for ADMIN, got %d", resAdmin.Total)
	}
	if len(resAdmin.External) != 1 || resAdmin.External[0].Slug != "home-assistant" {
		t.Errorf("expected external app 'home-assistant', got %v", resAdmin.External)
	}

	// 3. Test OWNER role (should see MEMBER, ADMIN, and OWNER apps)
	resOwner, err := svc.GetPermittedApps(ctx, []string{}, "OWNER")
	if err != nil {
		t.Fatalf("expected no error for owner query, got: %v", err)
	}
	if resOwner.Total != 3 {
		t.Errorf("expected 3 permitted apps for OWNER, got %d", resOwner.Total)
	}

	// 4. Test Realm Admin override
	resRealmAdmin, err := svc.GetPermittedApps(ctx, []string{"loeger_admin"}, "MEMBER")
	if err != nil {
		t.Fatalf("expected no error for realm admin query, got: %v", err)
	}
	if resRealmAdmin.Total != 3 {
		t.Errorf("expected realm admin bypass to permit all 3 apps, got %d", resRealmAdmin.Total)
	}
}
