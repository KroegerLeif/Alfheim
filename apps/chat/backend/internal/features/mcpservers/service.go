package mcpservers

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"

	"alfheim/chat/internal/shared/mcp"
)

// Service defines domain logic for the MCP server registry.
type Service interface {
	// SeedFromEnv parses a CHAT_MCP_SERVERS spec ("pantry=http://pantry-backend:8000/mcp,chores=...")
	// and upserts one registry entry per entry. Safe to call on every startup. Once
	// called, ListEnabledServers only returns the apps named in spec: the installer
	// renders the spec from the enabled apps, so a registry row of a disabled app
	// stays stored but offers no tools.
	SeedFromEnv(ctx context.Context, spec string) error
	List(ctx context.Context) ([]ResponseDTO, error)
	SetEnabled(ctx context.Context, id string, enabled bool) (ResponseDTO, error)
	// ListEnabledServers returns the currently enabled servers as mcp.ServerRef values,
	// for the chat engine's tool-calling bridge to dial directly.
	ListEnabledServers(ctx context.Context) ([]mcp.ServerRef, error)
	// DiagnoseServers runs a connectivity ping and tool discovery audit across all
	// registered MCP servers, reporting latency, reachability, and active tools.
	DiagnoseServers(ctx context.Context, pool MCPClientPool) ([]ServerDiagnosticDTO, error)
}

// MCPClientPool abstracts the client pool to resolve ToolCaller instances by endpoint URL.
type MCPClientPool interface {
	Get(endpointURL string) mcp.ToolCaller
}

type service struct {
	repo Repository
	log  *slog.Logger

	mu sync.RWMutex
	// seeded holds the app slugs of the last applied spec; nil means no spec
	// was applied and every enabled registry row is used.
	seeded map[string]bool
}

// NewService creates an mcpservers service instance.
func NewService(repo Repository, log *slog.Logger) Service {
	return &service{repo: repo, log: log}
}

func (s *service) SeedFromEnv(ctx context.Context, spec string) error {
	seeded := map[string]bool{}
	defer func() {
		s.mu.Lock()
		s.seeded = seeded
		s.mu.Unlock()
	}()

	spec = strings.TrimSpace(spec)
	if spec == "" {
		s.log.Info("CHAT_MCP_SERVERS is empty: no app offers tools")
		return nil
	}

	for _, entry := range strings.Split(spec, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}

		appSlug, internalURL, ok := strings.Cut(entry, "=")
		appSlug = strings.TrimSpace(appSlug)
		internalURL = strings.TrimSpace(internalURL)
		if !ok || appSlug == "" || internalURL == "" {
			return fmt.Errorf("%w: %q", ErrInvalidSeedSpec, entry)
		}

		if err := s.repo.UpsertFromSeed(ctx, appSlug, internalURL); err != nil {
			return err
		}
		seeded[appSlug] = true
		s.log.Info("seeded mcp server registry entry", slog.String("app_slug", appSlug), slog.String("internal_url", internalURL))
	}

	return nil
}

func (s *service) List(ctx context.Context) ([]ResponseDTO, error) {
	servers, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ResponseDTO, 0, len(servers))
	for _, srv := range servers {
		out = append(out, ToResponse(srv))
	}
	return out, nil
}

func (s *service) SetEnabled(ctx context.Context, id string, enabled bool) (ResponseDTO, error) {
	if err := s.repo.SetEnabled(ctx, id, enabled); err != nil {
		return ResponseDTO{}, err
	}
	srv, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ResponseDTO{}, err
	}
	s.log.Info("updated mcp server enabled state", slog.String("id", id), slog.Bool("enabled", enabled))
	return ToResponse(srv), nil
}

func (s *service) ListEnabledServers(ctx context.Context) ([]mcp.ServerRef, error) {
	servers, err := s.repo.ListEnabled(ctx)
	if err != nil {
		return nil, err
	}
	s.mu.RLock()
	seeded := s.seeded
	s.mu.RUnlock()

	out := make([]mcp.ServerRef, 0, len(servers))
	for _, srv := range servers {
		if seeded != nil && !seeded[srv.AppSlug] {
			continue
		}
		out = append(out, mcp.ServerRef{ID: srv.ID, Slug: srv.AppSlug, EndpointURL: srv.InternalURL})
	}
	return out, nil
}

func (s *service) DiagnoseServers(ctx context.Context, pool MCPClientPool) ([]ServerDiagnosticDTO, error) {
	servers, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]ServerDiagnosticDTO, 0, len(servers))
	for _, srv := range servers {
		diag := ServerDiagnosticDTO{
			ID:          srv.ID,
			AppSlug:     srv.AppSlug,
			EndpointURL: srv.InternalURL,
			Enabled:     srv.Enabled,
		}

		if !srv.Enabled {
			diag.Reachable = false
			diag.Error = "server is disabled in registry"
			out = append(out, diag)
			continue
		}

		client := pool.Get(srv.InternalURL)
		pingResult := client.Ping(ctx)
		diag.Reachable = pingResult.Reachable
		diag.AuthRequired = pingResult.AuthRequired
		diag.LatencyMs = pingResult.LatencyMs
		diag.ToolsCount = pingResult.ToolsCount
		diag.Tools = pingResult.Tools
		diag.ProtocolVer = pingResult.ProtocolVer
		diag.Error = pingResult.Error

		out = append(out, diag)
	}

	return out, nil
}
