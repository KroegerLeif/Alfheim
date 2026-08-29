package mcpservers_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"alfheim/chat/internal/features/mcpservers"
)

// fakeRepository is an in-memory Repository double for unit-testing the service
// layer without a real Postgres instance.
type fakeRepository struct {
	servers map[string]*mcpservers.Server
	bySlug  map[string]string // app_slug -> id
}

func newFakeRepository() *fakeRepository {
	return &fakeRepository{
		servers: make(map[string]*mcpservers.Server),
		bySlug:  make(map[string]string),
	}
}

func (f *fakeRepository) UpsertFromSeed(ctx context.Context, appSlug, internalURL string) error {
	if id, ok := f.bySlug[appSlug]; ok {
		f.servers[id].InternalURL = internalURL
		f.servers[id].UpdatedAt = time.Now()
		return nil
	}

	id := "srv-" + appSlug
	f.bySlug[appSlug] = id
	f.servers[id] = &mcpservers.Server{
		ID:          id,
		AppSlug:     appSlug,
		InternalURL: internalURL,
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	return nil
}

func (f *fakeRepository) List(ctx context.Context) ([]*mcpservers.Server, error) {
	var out []*mcpservers.Server
	for _, s := range f.servers {
		out = append(out, s)
	}
	return out, nil
}

func (f *fakeRepository) ListEnabled(ctx context.Context) ([]*mcpservers.Server, error) {
	var out []*mcpservers.Server
	for _, s := range f.servers {
		if s.Enabled {
			out = append(out, s)
		}
	}
	return out, nil
}

func (f *fakeRepository) GetByID(ctx context.Context, id string) (*mcpservers.Server, error) {
	s, ok := f.servers[id]
	if !ok {
		return nil, mcpservers.ErrNotFound
	}
	return s, nil
}

func (f *fakeRepository) SetEnabled(ctx context.Context, id string, enabled bool) error {
	s, ok := f.servers[id]
	if !ok {
		return mcpservers.ErrNotFound
	}
	s.Enabled = enabled
	return nil
}

func newTestService(repo mcpservers.Repository) mcpservers.Service {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return mcpservers.NewService(repo, log)
}

func TestService_SeedFromEnv(t *testing.T) {
	ctx := context.Background()

	t.Run("parses and upserts each app_slug=url pair", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo)

		spec := "pantry=http://pantry-backend:8000/mcp, chores=http://chores-backend:8000/mcp"
		if err := svc.SeedFromEnv(ctx, spec); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		list, err := svc.List(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(list) != 2 {
			t.Fatalf("expected 2 seeded servers, got %d", len(list))
		}
	})

	t.Run("does nothing for an empty spec", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo)

		if err := svc.SeedFromEnv(ctx, ""); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		list, _ := svc.List(ctx)
		if len(list) != 0 {
			t.Errorf("expected no servers seeded from an empty spec, got %d", len(list))
		}
	})

	t.Run("rejects a malformed entry", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo)

		if err := svc.SeedFromEnv(ctx, "pantry-no-equals-sign"); err == nil {
			t.Errorf("expected an error for a malformed CHAT_MCP_SERVERS entry")
		}
	})

	t.Run("re-seeding updates the url but does not reset a disabled server", func(t *testing.T) {
		repo := newFakeRepository()
		svc := newTestService(repo)

		if err := svc.SeedFromEnv(ctx, "pantry=http://old-host:8000/mcp"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		list, _ := svc.List(ctx)
		if _, err := svc.SetEnabled(ctx, list[0].ID, false); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if err := svc.SeedFromEnv(ctx, "pantry=http://new-host:8000/mcp"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		updated, err := svc.List(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(updated) != 1 {
			t.Fatalf("expected exactly 1 server (re-seeded, not duplicated), got %d", len(updated))
		}
		if updated[0].InternalURL != "http://new-host:8000/mcp" {
			t.Errorf("expected internal_url to be updated, got %s", updated[0].InternalURL)
		}
		if updated[0].Enabled {
			t.Errorf("expected the admin's disabled choice to survive re-seeding")
		}
	})
}

func TestService_ListEnabledServers(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepository()
	svc := newTestService(repo)

	if err := svc.SeedFromEnv(ctx, "pantry=http://pantry-backend:8000/mcp,chores=http://chores-backend:8000/mcp"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	list, _ := svc.List(ctx)
	var choresID string
	for _, s := range list {
		if s.AppSlug == "chores" {
			choresID = s.ID
		}
	}
	if _, err := svc.SetEnabled(ctx, choresID, false); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	refs, err := svc.ListEnabledServers(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(refs) != 1 || refs[0].Slug != "pantry" {
		t.Errorf("expected only pantry to be enabled, got %+v", refs)
	}
}

func TestService_SetEnabled_NotFound(t *testing.T) {
	repo := newFakeRepository()
	svc := newTestService(repo)

	if _, err := svc.SetEnabled(context.Background(), "does-not-exist", true); err != mcpservers.ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}
