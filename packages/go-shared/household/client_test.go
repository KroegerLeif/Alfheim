package householdclient

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func (f *fakeClock) Now() time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.t
}

func (f *fakeClock) Advance(d time.Duration) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.t = f.t.Add(d)
}

type fakeServer struct {
	server *httptest.Server
	calls  atomic.Int32
}

func newFakeServer(t *testing.T, handler func(w http.ResponseWriter, r *http.Request)) *fakeServer {
	t.Helper()
	fs := &fakeServer{}
	fs.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fs.calls.Add(1)
		handler(w, r)
	}))
	t.Cleanup(fs.server.Close)
	return fs
}

func memberHandler(t *testing.T, hh uuid.UUID, sub, role string) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer internal-secret" {
			t.Errorf("unexpected Authorization header %q", got)
		}
		wantPath := "/internal/v1/memberships/" + hh.String() + "/" + sub
		if r.URL.Path != wantPath {
			t.Errorf("unexpected path %q, want %q", r.URL.Path, wantPath)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"household_id": hh.String(), "user_id": sub, "role": role})
	}
}

func TestCheckMembership_MemberIsCachedForPositiveTTL(t *testing.T) {
	hh := uuid.New()
	fs := newFakeServer(t, memberHandler(t, hh, "user-1", "ADMIN"))
	clock := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	c := New(fs.server.URL, "internal-secret", WithClock(clock.Now))

	m, err := c.CheckMembership(context.Background(), hh, "user-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.Role != RoleAdmin || m.HouseholdID != hh || m.UserID != "user-1" {
		t.Fatalf("unexpected membership %+v", m)
	}

	clock.Advance(PositiveTTL - time.Second)
	if _, err := c.CheckMembership(context.Background(), hh, "user-1"); err != nil {
		t.Fatalf("unexpected error from cache: %v", err)
	}
	if got := fs.calls.Load(); got != 1 {
		t.Fatalf("expected 1 upstream call within TTL, got %d", got)
	}

	clock.Advance(2 * time.Second)
	if _, err := c.CheckMembership(context.Background(), hh, "user-1"); err != nil {
		t.Fatalf("unexpected error after expiry: %v", err)
	}
	if got := fs.calls.Load(); got != 2 {
		t.Fatalf("expected refetch after positive TTL, got %d calls", got)
	}
}

func TestCheckMembership_NotMemberIsCachedForNegativeTTL(t *testing.T) {
	fs := newFakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	clock := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	c := New(fs.server.URL, "internal-secret", WithClock(clock.Now))
	hh := uuid.New()

	for range 3 {
		if _, err := c.CheckMembership(context.Background(), hh, "user-1"); !errors.Is(err, ErrNotMember) {
			t.Fatalf("expected ErrNotMember, got %v", err)
		}
	}
	if got := fs.calls.Load(); got != 1 {
		t.Fatalf("expected negative answer to be cached, got %d calls", got)
	}

	clock.Advance(NegativeTTL)
	if _, err := c.CheckMembership(context.Background(), hh, "user-1"); !errors.Is(err, ErrNotMember) {
		t.Fatalf("expected ErrNotMember, got %v", err)
	}
	if got := fs.calls.Load(); got != 2 {
		t.Fatalf("expected refetch after negative TTL, got %d calls", got)
	}
}

func TestCheckMembership_CacheIsKeyedByHouseholdAndUser(t *testing.T) {
	hh := uuid.New()
	fs := newFakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal/v1/memberships/"+hh.String()+"/user-1" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		memberHandler(t, hh, "user-1", "MEMBER")(w, r)
	})
	c := New(fs.server.URL, "internal-secret")

	if _, err := c.CheckMembership(context.Background(), hh, "user-1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := c.CheckMembership(context.Background(), hh, "user-2"); !errors.Is(err, ErrNotMember) {
		t.Fatalf("other user must not hit the first user's cache entry, got %v", err)
	}
	if _, err := c.CheckMembership(context.Background(), uuid.New(), "user-1"); !errors.Is(err, ErrNotMember) {
		t.Fatalf("other household must not hit the cache entry, got %v", err)
	}
}

func TestCheckMembership_FailsClosed(t *testing.T) {
	hh := uuid.New()
	tests := []struct {
		name    string
		handler func(w http.ResponseWriter, r *http.Request)
		want    error
	}{
		{"400 is not a member", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusBadRequest) }, ErrNotMember},
		{"401 service token rejected", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusUnauthorized) }, ErrUnavailable},
		{"500", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusInternalServerError) }, ErrUnavailable},
		{"503", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusServiceUnavailable) }, ErrUnavailable},
		{"malformed json", func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte("{not json")) }, ErrUnavailable},
		{"unknown role", memberHandler(t, hh, "user-1", "SUPERUSER"), ErrUnavailable},
		{"mismatched household", func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]string{"household_id": uuid.NewString(), "user_id": "user-1", "role": "OWNER"})
		}, ErrUnavailable},
		{"mismatched user", func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]string{"household_id": hh.String(), "user_id": "someone-else", "role": "OWNER"})
		}, ErrUnavailable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fs := newFakeServer(t, tt.handler)
			c := New(fs.server.URL, "internal-secret")
			if _, err := c.CheckMembership(context.Background(), hh, "user-1"); !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func TestCheckMembership_ErrorsAreNotCached(t *testing.T) {
	hh := uuid.New()
	var fail atomic.Bool
	fail.Store(true)
	fs := newFakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		if fail.Load() {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		memberHandler(t, hh, "user-1", "OWNER")(w, r)
	})
	c := New(fs.server.URL, "internal-secret")

	if _, err := c.CheckMembership(context.Background(), hh, "user-1"); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("expected ErrUnavailable, got %v", err)
	}
	fail.Store(false)
	m, err := c.CheckMembership(context.Background(), hh, "user-1")
	if err != nil || m.Role != RoleOwner {
		t.Fatalf("expected recovery on next call, got %+v %v", m, err)
	}
}

func TestCheckMembership_UnreachableAndTimeout(t *testing.T) {
	t.Run("connection refused", func(t *testing.T) {
		srv := httptest.NewServer(http.NotFoundHandler())
		base := srv.URL
		srv.Close()
		c := New(base, "internal-secret")
		if _, err := c.CheckMembership(context.Background(), uuid.New(), "user-1"); !errors.Is(err, ErrUnavailable) {
			t.Fatalf("expected ErrUnavailable, got %v", err)
		}
	})

	t.Run("timeout", func(t *testing.T) {
		release := make(chan struct{})
		fs := newFakeServer(t, func(w http.ResponseWriter, r *http.Request) {
			select {
			case <-release:
			case <-r.Context().Done():
			}
		})
		defer close(release)
		c := New(fs.server.URL, "internal-secret", WithHTTPClient(&http.Client{Timeout: 50 * time.Millisecond}))
		if _, err := c.CheckMembership(context.Background(), uuid.New(), "user-1"); !errors.Is(err, ErrUnavailable) {
			t.Fatalf("expected ErrUnavailable, got %v", err)
		}
	})

	t.Run("canceled context", func(t *testing.T) {
		fs := newFakeServer(t, memberHandler(t, uuid.New(), "user-1", "OWNER"))
		c := New(fs.server.URL, "internal-secret")
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if _, err := c.CheckMembership(ctx, uuid.New(), "user-1"); !errors.Is(err, ErrUnavailable) {
			t.Fatalf("expected ErrUnavailable, got %v", err)
		}
	})
}

func TestCheckMembership_EscapesSubjectAndRejectsEmpty(t *testing.T) {
	hh := uuid.New()
	fs := newFakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.RawPath != "" && r.URL.RawPath != "/internal/v1/memberships/"+hh.String()+"/a%2Fb" {
			t.Errorf("unexpected raw path %q", r.URL.RawPath)
		}
		w.WriteHeader(http.StatusNotFound)
	})
	c := New(fs.server.URL, "internal-secret")
	if _, err := c.CheckMembership(context.Background(), hh, "a/b"); !errors.Is(err, ErrNotMember) {
		t.Fatalf("expected ErrNotMember, got %v", err)
	}
	if _, err := c.CheckMembership(context.Background(), hh, ""); !errors.Is(err, ErrNotMember) {
		t.Fatalf("expected ErrNotMember for empty subject, got %v", err)
	}
	if got := fs.calls.Load(); got != 1 {
		t.Fatalf("empty subject must not reach the service, got %d calls", got)
	}
}

func TestNew_DefaultsBaseURL(t *testing.T) {
	c := New("", "tok")
	if c.baseURL != DefaultBaseURL {
		t.Fatalf("expected default base url, got %q", c.baseURL)
	}
	c = New("http://x:1/", "tok")
	if c.baseURL != "http://x:1" {
		t.Fatalf("expected trailing slash trimmed, got %q", c.baseURL)
	}
}

func TestCacheIsBounded(t *testing.T) {
	c := New("http://unused", "tok")
	for i := range maxCacheEntries + 5 {
		c.store(uuid.NewString()+string(rune(i)), cacheEntry{member: true, expires: time.Now().Add(time.Hour)})
	}
	if len(c.cache) > maxCacheEntries {
		t.Fatalf("cache grew beyond bound: %d", len(c.cache))
	}
}
