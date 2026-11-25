package media

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"time"

	"github.com/google/uuid"

	"alfheim/dashboard/internal/features/plugins"
	"alfheim/go-shared/netguard"
)

// PluginAccess is the part of *plugins.Service the media feature needs.
type PluginAccess interface {
	IsEnabled(ctx context.Context, householdID uuid.UUID, pluginType string) (bool, error)
	EnabledInstance(ctx context.Context, householdID uuid.UUID, pluginType string) (plugins.Instance, error)
}

// SourceState reports how one enabled media server answered a now-playing request.
type SourceState struct {
	Source string `json:"source"`
	// Status is "ok" or a failure code such as "auth_failed" or "unreachable".
	Status string `json:"status"`
}

// NowPlaying is the body of GET /api/v1/integrations/media/now-playing.
type NowPlaying struct {
	Items   []Status      `json:"items"`
	Sources []SourceState `json:"sources"`
}

// Service reads now playing from, and sends control commands to, the
// household's enabled media server plugins.
type Service struct {
	access      PluginAccess
	sources     map[string]Source
	controllers map[string]Controller
	types       []string
	timeout     time.Duration
	log         *slog.Logger
}

// NewService returns the media service over every plugin of registry that
// implements Source. timeout bounds each upstream call (plugins.DefaultTimeout
// when zero).
func NewService(access PluginAccess, registry *plugins.Registry, timeout time.Duration, log *slog.Logger) *Service {
	if timeout <= 0 {
		timeout = plugins.DefaultTimeout
	}
	s := &Service{access: access, sources: map[string]Source{}, controllers: map[string]Controller{}, timeout: timeout, log: log}
	for _, t := range registry.Types() {
		src, ok := plugins.CapabilityOf[Source](registry, t)
		if !ok {
			continue
		}
		s.sources[t] = src
		s.types = append(s.types, t)
		if c, ok := plugins.CapabilityOf[Controller](registry, t); ok {
			s.controllers[t] = c
		}
	}
	return s
}

// NowPlaying collects the active sessions of every enabled media server of the
// household. A failing server is reported in Sources and does not hide the
// sessions of the others.
func (s *Service) NowPlaying(ctx context.Context, householdID uuid.UUID) (NowPlaying, error) {
	out := NowPlaying{Items: []Status{}, Sources: []SourceState{}}
	for _, t := range s.types {
		enabled, err := s.access.IsEnabled(ctx, householdID, t)
		if err != nil {
			return NowPlaying{}, err
		}
		if !enabled {
			continue
		}
		items, err := s.nowPlayingOf(ctx, householdID, t)
		if err != nil {
			s.log.Warn("media now playing failed", slog.String("source", t), slog.String("error", err.Error()))
			out.Sources = append(out.Sources, SourceState{Source: t, Status: failureCode(err)})
			continue
		}
		out.Items = append(out.Items, items...)
		out.Sources = append(out.Sources, SourceState{Source: t, Status: "ok"})
	}
	return out, nil
}

func (s *Service) nowPlayingOf(ctx context.Context, householdID uuid.UUID, t string) ([]Status, error) {
	inst, err := s.access.EnabledInstance(ctx, householdID, t)
	if err != nil {
		return nil, err
	}
	callCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	items, err := s.sources[t].NowPlaying(callCtx, inst.Config, inst.Credentials)
	if err != nil {
		return nil, err
	}
	_, controllable := s.controllers[t]
	for i := range items {
		items[i].Source = t
		items[i].CanControl = items[i].CanControl && controllable
	}
	return items, nil
}

// Control sends cmd to the session of the household's media server of type t.
func (s *Service) Control(ctx context.Context, householdID uuid.UUID, t, sessionID string, cmd Command) error {
	if _, ok := s.sources[t]; !ok {
		return ErrNotMediaType
	}
	ctrl, ok := s.controllers[t]
	if !ok {
		return ErrControlUnsupported
	}
	if !cmd.Valid() {
		return ErrInvalidCommand
	}
	if !sessionIDPattern.MatchString(sessionID) {
		return ErrInvalidSession
	}
	inst, err := s.access.EnabledInstance(ctx, householdID, t)
	if err != nil {
		return err
	}
	callCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	return ctrl.Control(callCtx, inst.Config, inst.Credentials, sessionID, cmd)
}

// failureCode maps an error of a media call to a stable code for the client.
func failureCode(err error) string {
	var netErr net.Error
	switch {
	case errors.Is(err, plugins.ErrHostNotAllowed), errors.Is(err, netguard.ErrBlocked):
		return "host_not_allowed"
	case errors.Is(err, plugins.ErrEncryptionUnavailable), errors.Is(err, plugins.ErrKeyMismatch),
		errors.Is(err, ErrMissingCredentials):
		return "credentials_unavailable"
	case errors.Is(err, ErrAuthFailed):
		return "auth_failed"
	case errors.Is(err, context.DeadlineExceeded), errors.As(err, &netErr) && netErr.Timeout():
		return "timeout"
	case errors.Is(err, ErrUpstream):
		return "invalid_response"
	case errors.As(err, &netErr):
		return "unreachable"
	default:
		return "error"
	}
}
