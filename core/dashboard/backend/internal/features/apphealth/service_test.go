package apphealth

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

type fakeProber struct {
	calls  atomic.Int32
	states map[string]State
	block  chan struct{}
}

func (f *fakeProber) Probe(_ context.Context, url string) (State, error) {
	f.calls.Add(1)
	if f.block != nil {
		<-f.block
	}
	if s, ok := f.states[url]; ok {
		if s != StateOnline {
			return s, errors.New("not online")
		}
		return s, nil
	}
	return StateOffline, errors.New("unknown")
}

func discard() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

var targets = []Target{{ID: "pantry", URL: "p"}, {ID: "chat", URL: "c"}}

func TestService_ProbesOncePerWindow(t *testing.T) {
	prober := &fakeProber{states: map[string]State{"p": StateOnline, "c": StateDegraded}}
	now := time.Unix(1000, 0)
	var mu sync.Mutex
	clock := func() time.Time { mu.Lock(); defer mu.Unlock(); return now }
	svc := NewService(targets, prober, 20*time.Second, discard(), WithClock(clock))

	snap := svc.Snapshot(context.Background())
	if snap.Apps["pantry"] != StateOnline || snap.Apps["chat"] != StateDegraded {
		t.Fatalf("unexpected snapshot %+v", snap)
	}
	svc.Snapshot(context.Background())
	if got := prober.calls.Load(); got != 2 {
		t.Fatalf("probes within the window = %d, want 2", got)
	}

	mu.Lock()
	now = now.Add(21 * time.Second)
	mu.Unlock()
	svc.Snapshot(context.Background())
	if got := prober.calls.Load(); got != 4 {
		t.Errorf("probes after expiry = %d, want 4", got)
	}
}

func TestService_ConcurrentCallersShareOneRound(t *testing.T) {
	prober := &fakeProber{states: map[string]State{"p": StateOnline, "c": StateOnline}, block: make(chan struct{})}
	svc := NewService(targets, prober, 0, discard())

	var wg sync.WaitGroup
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			svc.Snapshot(context.Background())
		}()
	}
	time.Sleep(50 * time.Millisecond)
	close(prober.block)
	wg.Wait()
	if got := prober.calls.Load(); got != 2 {
		t.Errorf("probes for 10 concurrent callers = %d, want 2", got)
	}
}

func TestService_CancelledCallerGetsEmptySnapshot(t *testing.T) {
	prober := &fakeProber{states: map[string]State{}, block: make(chan struct{})}
	defer close(prober.block)
	svc := NewService(targets, prober, 0, discard())
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if snap := svc.Snapshot(ctx); len(snap.Apps) != 0 {
		t.Errorf("expected an empty snapshot, got %+v", snap)
	}
}

func TestHandler_ServesSnapshot(t *testing.T) {
	prober := &fakeProber{states: map[string]State{"p": StateOnline}}
	h := NewHandler(NewService(targets, prober, 0, discard()))
	r := chi.NewRouter()
	h.RegisterRoutes(r, func(next http.Handler) http.Handler { return next })

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/apps/health", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	body := rec.Body.String()
	if want := `"pantry":"online"`; !strings.Contains(body, want) || !strings.Contains(body, `"chat":"offline"`) {
		t.Errorf("body %s", body)
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Error("missing Cache-Control: no-store")
	}
}
