package apps_test

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"alfheim/dashboard/internal/features/apps"
)

type mockRepository struct {
	preferences *apps.UserPreferences
	links       []*apps.UserLink
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		preferences: &apps.UserPreferences{
			UserID:       "user-1",
			HiddenAppIDs: []string{"todo"},
		},
		links: []*apps.UserLink{
			{
				ID:          "link-1",
				UserID:      "user-1",
				Title:       "Google Drive",
				URL:         "https://drive.google.com",
				Icon:        "cloud",
				Category:    "user",
				Description: "Personal Cloud Drive",
			},
		},
	}
}

func (m *mockRepository) GetUserPreferences(ctx context.Context, userID string) (*apps.UserPreferences, error) {
	if m.preferences != nil && m.preferences.UserID == userID {
		return m.preferences, nil
	}
	return &apps.UserPreferences{UserID: userID, HiddenAppIDs: []string{}}, nil
}

func (m *mockRepository) UpdateUserPreferences(ctx context.Context, userID string, hiddenAppIDs []string) (*apps.UserPreferences, error) {
	m.preferences = &apps.UserPreferences{UserID: userID, HiddenAppIDs: hiddenAppIDs}
	return m.preferences, nil
}

func (m *mockRepository) GetUserLinks(ctx context.Context, userID string) ([]*apps.UserLink, error) {
	var userLinks []*apps.UserLink
	for _, l := range m.links {
		if l.UserID == userID {
			userLinks = append(userLinks, l)
		}
	}
	return userLinks, nil
}

func (m *mockRepository) GetUserLinkByID(ctx context.Context, id string, userID string) (*apps.UserLink, error) {
	for _, l := range m.links {
		if l.ID == id && l.UserID == userID {
			return l, nil
		}
	}
	return nil, apps.ErrLinkNotFound
}

func (m *mockRepository) CreateUserLink(ctx context.Context, link *apps.UserLink) error {
	link.ID = "link-created-1"
	m.links = append(m.links, link)
	return nil
}

func (m *mockRepository) UpdateUserLink(ctx context.Context, link *apps.UserLink) error {
	for i, l := range m.links {
		if l.ID == link.ID && l.UserID == link.UserID {
			m.links[i] = link
			return nil
		}
	}
	return apps.ErrLinkNotFound
}

func (m *mockRepository) DeleteUserLink(ctx context.Context, id string, userID string) error {
	for i, l := range m.links {
		if l.ID == id && l.UserID == userID {
			m.links = append(m.links[:i], m.links[i+1:]...)
			return nil
		}
	}
	return apps.ErrLinkNotFound
}

type mockStackLoader struct {
	apps []apps.StackAppConfig
}

func (m *mockStackLoader) LoadStackApps() ([]apps.StackAppConfig, error) {
	return m.apps, nil
}

func Test3TierAppService_GetDashboardApps(t *testing.T) {
	repo := newMockRepository()
	stackLoader := &mockStackLoader{
		apps: []apps.StackAppConfig{
			{
				ID:            "home-assistant",
				Title:         "Home Assistant",
				Slug:          "home-assistant",
				Description:   "Smart home control",
				Icon:          "home",
				URL:           "http://homeassistant.local",
				Category:      "external",
				RequiredRoles: []string{},
				Status:        "active",
			},
			{
				ID:            "plex",
				Title:         "Plex Media Server",
				Slug:          "plex",
				Description:   "Media server",
				Icon:          "movie",
				URL:           "http://plex.local",
				Category:      "external",
				RequiredRoles: []string{"admin"},
				Status:        "in_progress",
			},
		},
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := apps.NewService(repo, stackLoader, logger)
	ctx := context.Background()

	// 1. Query for standard user (roles: []) -> should get non-hidden Core apps (8), Stack apps (1: Home Assistant), User links (1)
	resUser, err := svc.GetDashboardApps(ctx, "user-1", []string{})
	if err != nil {
		t.Fatalf("expected no error querying dashboard apps, got: %v", err)
	}

	if len(resUser.Core) != 8 {
		t.Errorf("expected 8 visible Core apps (todo is hidden), got %d", len(resUser.Core))
	}
	if len(resUser.Stack) != 1 || resUser.Stack[0].ID != "home-assistant" {
		t.Errorf("expected 1 permitted stack app (home-assistant), got %v", resUser.Stack)
	}
	if len(resUser.User) != 1 || resUser.User[0].Title != "Google Drive" {
		t.Errorf("expected 1 user link (Google Drive), got %v", resUser.User)
	}

	// 2. Query for admin user (roles: ["admin"]) -> should also see Plex stack app
	resAdmin, err := svc.GetDashboardApps(ctx, "user-1", []string{"admin"})
	if err != nil {
		t.Fatalf("expected no error for admin query, got: %v", err)
	}

	if len(resAdmin.Stack) != 2 {
		t.Errorf("expected 2 permitted stack apps for admin, got %d", len(resAdmin.Stack))
	}
}

func Test3TierAppService_UserLinkCRUD(t *testing.T) {
	repo := newMockRepository()
	stackLoader := &mockStackLoader{apps: []apps.StackAppConfig{}}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := apps.NewService(repo, stackLoader, logger)
	ctx := context.Background()

	// Test link creation
	created, err := svc.CreateUserLink(ctx, "user-1", apps.CreateUserLinkRequest{
		Title: "GitHub Repo",
		URL:   "https://github.com",
		Icon:  "code",
	})
	if err != nil {
		t.Fatalf("expected no error creating link, got: %v", err)
	}
	if created.Title != "GitHub Repo" || created.Tier != apps.TierUser {
		t.Errorf("unexpected created link DTO: %+v", created)
	}

	// Test update link
	updated, err := svc.UpdateUserLink(ctx, "user-1", "link-1", apps.UpdateUserLinkRequest{
		Title:       "Google Drive Updated",
		URL:         "https://drive.google.com/updated",
		Icon:        "cloud-sync",
		Category:    "storage",
		Description: "Updated Cloud",
	})
	if err != nil {
		t.Fatalf("expected no error updating link, got: %v", err)
	}
	if updated.Title != "Google Drive Updated" {
		t.Errorf("expected Google Drive Updated, got %s", updated.Title)
	}

	// Test link deletion
	err = svc.DeleteUserLink(ctx, "user-1", "link-1")
	if err != nil {
		t.Fatalf("expected no error deleting link-1, got: %v", err)
	}
}

func Test3TierAppService_UserPreferences(t *testing.T) {
	repo := newMockRepository()
	stackLoader := &mockStackLoader{apps: []apps.StackAppConfig{}}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := apps.NewService(repo, stackLoader, logger)
	ctx := context.Background()

	// Get Preferences
	prefs, err := svc.GetUserPreferences(ctx, "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(prefs.HiddenAppIDs) != 1 || prefs.HiddenAppIDs[0] != "todo" {
		t.Errorf("expected [todo], got %v", prefs.HiddenAppIDs)
	}

	// Update Preferences
	updated, err := svc.UpdateUserPreferences(ctx, "user-1", []string{"shopping", "pantry"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(updated.HiddenAppIDs) != 2 || updated.HiddenAppIDs[0] != "shopping" {
		t.Errorf("expected [shopping, pantry], got %v", updated.HiddenAppIDs)
	}
}

func Test3TierAppService_PermissionsAndValidationEdgeCases(t *testing.T) {
	repo := newMockRepository()
	stackLoader := &mockStackLoader{
		apps: []apps.StackAppConfig{
			{
				ID:            "admin-tool",
				Title:         "Admin Tool",
				URL:           "http://admin.local",
				RequiredRoles: []string{"role_admin"},
			},
		},
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := apps.NewService(repo, stackLoader, logger)
	ctx := context.Background()

	t.Run("alfheim_admin sees all stack apps", func(t *testing.T) {
		resp, err := svc.GetDashboardApps(ctx, "user-admin", []string{"alfheim_admin"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		found := false
		for _, a := range resp.Stack {
			if a.ID == "admin-tool" {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected alfheim_admin to see admin-tool")
		}
	})

	t.Run("matching required role sees stack app", func(t *testing.T) {
		resp, err := svc.GetDashboardApps(ctx, "user-role", []string{"role_admin"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		found := false
		for _, a := range resp.Stack {
			if a.ID == "admin-tool" {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected user with role_admin to see admin-tool")
		}
	})

	t.Run("non-matching role does not see stack app", func(t *testing.T) {
		resp, err := svc.GetDashboardApps(ctx, "user-regular", []string{"viewer"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, a := range resp.Stack {
			if a.ID == "admin-tool" {
				t.Errorf("did not expect regular viewer to see admin-tool")
			}
		}
	})

	t.Run("CreateUserLink invalid inputs", func(t *testing.T) {
		_, err := svc.CreateUserLink(ctx, "user-1", apps.CreateUserLinkRequest{Title: "", URL: "http://example.com"})
		if err != apps.ErrInvalidLinkInputs {
			t.Errorf("expected ErrInvalidLinkInputs, got %v", err)
		}
		_, err = svc.CreateUserLink(ctx, "user-1", apps.CreateUserLinkRequest{Title: "Title", URL: ""})
		if err != apps.ErrInvalidLinkInputs {
			t.Errorf("expected ErrInvalidLinkInputs, got %v", err)
		}
	})

	t.Run("UpdateUserLink not found for nonexistent link", func(t *testing.T) {
		_, err := svc.UpdateUserLink(ctx, "user-1", "nonexistent-link", apps.UpdateUserLinkRequest{Title: "Title", URL: "http://example.com"})
		if err != apps.ErrLinkNotFound {
			t.Errorf("expected ErrLinkNotFound, got %v", err)
		}
	})
}
