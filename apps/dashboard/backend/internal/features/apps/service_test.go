package apps_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"alfheim/dashboard/internal/features/apps"
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
				Title:        "Pantry",
				Slug:         "pantry",
				Description:  "Pantry Inventory",
				IconURL:      "/icons/pantry.svg",
				Icon:         "/icons/pantry.svg",
				AppURL:       "/pantry",
				URL:          "/pantry",
				Category:     apps.CategoryInternal,
				RequiredRole: apps.RoleMember,
				IsActive:     true,
				IsExternal:   false,
				Status:       "active",
				IsDefault:    true,
				DisplayOrder: 1,
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			},
			{
				ID:           "app-2",
				Name:         "Home Assistant",
				Title:        "Home Assistant",
				Slug:         "home-assistant",
				Description:  "Smart Home Control",
				IconURL:      "/icons/ha.svg",
				Icon:         "/icons/ha.svg",
				AppURL:       "https://ha.alfheim.local",
				URL:          "https://ha.alfheim.local",
				Category:     apps.CategoryExternal,
				RequiredRole: apps.RoleAdmin,
				IsActive:     true,
				IsExternal:   true,
				Status:       "active",
				IsDefault:    true,
				DisplayOrder: 2,
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			},
			{
				ID:           "app-3",
				Name:         "Admin Console",
				Title:        "Admin Console",
				Slug:         "admin-console",
				Description:  "Household Admin Management",
				IconURL:      "/icons/admin.svg",
				Icon:         "/icons/admin.svg",
				AppURL:       "/admin",
				URL:          "/admin",
				Category:     apps.CategoryInternal,
				RequiredRole: apps.RoleOwner,
				IsActive:     true,
				IsExternal:   false,
				Status:       "active",
				IsDefault:    true,
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

func (m *mockAppRepository) GetAppByID(ctx context.Context, id string) (*apps.AppItem, error) {
	for _, item := range m.items {
		if item.ID == id {
			return item, nil
		}
	}
	return nil, apps.ErrAppNotFound
}

func (m *mockAppRepository) CreateApp(ctx context.Context, app *apps.AppItem) error {
	app.ID = "app-created-1"
	app.CreatedAt = time.Now()
	app.UpdatedAt = time.Now()
	m.items = append(m.items, app)
	return nil
}

func (m *mockAppRepository) UpdateApp(ctx context.Context, app *apps.AppItem) error {
	for i, item := range m.items {
		if item.ID == app.ID {
			m.items[i] = app
			return nil
		}
	}
	return apps.ErrAppNotFound
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
	resRealmAdmin, err := svc.GetPermittedApps(ctx, []string{"alfheim_admin"}, "MEMBER")
	if err != nil {
		t.Fatalf("expected no error for realm admin query, got: %v", err)
	}
	if resRealmAdmin.Total != 3 {
		t.Errorf("expected realm admin bypass to permit all 3 apps, got %d", resRealmAdmin.Total)
	}
}

func TestAppService_CreateApp(t *testing.T) {
	repo := newMockAppRepository()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := apps.NewService(repo, logger)
	ctx := context.Background()

	// Test invalid request (missing title)
	_, err := svc.CreateApp(ctx, apps.CreateAppRequest{URL: "http://example.com"})
	if err == nil {
		t.Error("expected error for missing title, got nil")
	}

	// Test valid creation
	created, err := svc.CreateApp(ctx, apps.CreateAppRequest{
		Title:       "Custom Service",
		Description: "Custom service description",
		Icon:        "star",
		URL:         "http://custom.local",
		IsExternal:  true,
	})
	if err != nil {
		t.Fatalf("expected no error creating app, got: %v", err)
	}

	if created.Title != "Custom Service" || !created.IsExternal || created.Category != "external" {
		t.Errorf("unexpected created DTO content: %+v", created)
	}
}

func TestAppService_UpdateApp(t *testing.T) {
	repo := newMockAppRepository()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := apps.NewService(repo, logger)
	ctx := context.Background()

	// Test non-existent app
	_, err := svc.UpdateApp(ctx, "app-non-existent", apps.UpdateAppRequest{Title: "Updated Title"})
	if err == nil {
		t.Error("expected error for non-existent app update, got nil")
	}

	// Test updating existing app
	updated, err := svc.UpdateApp(ctx, "app-1", apps.UpdateAppRequest{
		Title:       "Updated Pantry",
		Description: "Updated description",
		URL:         "/pantry-v2",
		Icon:        "kitchen",
		IsExternal:  false,
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("expected no error updating app-1, got: %v", err)
	}

	if updated.Title != "Updated Pantry" || updated.Description != "Updated description" || updated.URL != "/pantry-v2" {
		t.Errorf("unexpected updated DTO fields: %+v", updated)
	}
}
