package apphealth

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// DefaultCacheTTL is how long a snapshot is served before the apps are
// probed again. With the dashboard polling every 15 s, a stopped backend
// shows as offline within 30 s plus one probe timeout.
const DefaultCacheTTL = 15 * time.Second

// Service returns the cached health of the enabled apps.
type Service interface {
	// Snapshot returns the current snapshot, probing the apps only when the
	// cached one has expired.
	Snapshot(ctx context.Context) Snapshot
}

type service struct {
	targets []Target
	prober  Prober
	ttl     time.Duration
	now     func() time.Time
	log     *slog.Logger

	group   singleflight.Group
	mu      sync.Mutex
	cached  Snapshot
	expires time.Time
}

// Option customizes a Service.
type Option func(*service)

// WithClock replaces time.Now, for tests.
func WithClock(now func() time.Time) Option { return func(s *service) { s.now = now } }

// NewService returns a service probing targets with prober and caching each
// snapshot for ttl (DefaultCacheTTL when ttl <= 0).
func NewService(targets []Target, prober Prober, ttl time.Duration, log *slog.Logger, opts ...Option) Service {
	if ttl <= 0 {
		ttl = DefaultCacheTTL
	}
	s := &service{targets: targets, prober: prober, ttl: ttl, now: time.Now, log: log}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (s *service) Snapshot(ctx context.Context) Snapshot {
	s.mu.Lock()
	if s.now().Before(s.expires) {
		snap := s.cached
		s.mu.Unlock()
		return snap
	}
	s.mu.Unlock()

	// Concurrent callers share one probe round, so the number of probes per
	// window does not grow with the number of open dashboards. The round runs
	// detached from the caller's context: one closed tab must not cancel the
	// probes the other callers wait for.
	ch := s.group.DoChan("probe", func() (any, error) {
		snap := s.probeAll(context.WithoutCancel(ctx))
		s.mu.Lock()
		s.cached = snap
		s.expires = s.now().Add(s.ttl)
		s.mu.Unlock()
		return snap, nil
	})
	select {
	case res := <-ch:
		return res.Val.(Snapshot)
	case <-ctx.Done():
		return Snapshot{Apps: map[string]State{}, CheckedAt: s.now()}
	}
}

func (s *service) probeAll(ctx context.Context) Snapshot {
	states := make(map[string]State, len(s.targets))
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, t := range s.targets {
		wg.Add(1)
		go func(t Target) {
			defer wg.Done()
			state, err := s.prober.Probe(ctx, t.URL)
			if err != nil {
				s.log.Debug("app health probe not online", slog.String("app", t.ID),
					slog.String("state", string(state)), slog.String("error", err.Error()))
			}
			mu.Lock()
			states[t.ID] = state
			mu.Unlock()
		}(t)
	}
	wg.Wait()
	return Snapshot{Apps: states, CheckedAt: s.now()}
}
