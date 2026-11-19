package zitadelauth

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// fakeZitadel is an in-memory Zitadel for the machine user's credentials. It
// implements both Admin (per token) and TokenExchanger.
type fakeZitadel struct {
	t        *testing.T
	keys     map[string]bool
	pats     map[string]bool
	tokens   map[string]bool // bearer tokens Zitadel accepts
	nextKey  int
	expires  []time.Time
	failures map[string]error // by operation name
	// rejectNewKeyTimes makes the exchange reject a key this many times
	// first, like a key that has not propagated yet.
	rejectNewKeyTimes int
}

func newFakeZitadel(t *testing.T) *fakeZitadel {
	return &fakeZitadel{
		t: t, keys: map[string]bool{}, pats: map[string]bool{"pat-1": true},
		tokens: map[string]bool{"the-pat": true}, failures: map[string]error{},
	}
}

func (f *fakeZitadel) Exchange(_ context.Context, key Key) (string, error) {
	if err := f.failures["exchange"]; err != nil {
		return "", err
	}
	if f.rejectNewKeyTimes > 0 {
		f.rejectNewKeyTimes--
		return "", fmt.Errorf("%w: not yet", ErrRejected)
	}
	if !f.keys[key.KeyID] {
		return "", fmt.Errorf("%w: unknown key", ErrRejected)
	}
	token := "token-" + key.KeyID
	f.tokens[token] = true
	return token, nil
}

func (f *fakeZitadel) admin(token string) Admin { return fakeAdmin{f: f, token: token} }

type fakeAdmin struct {
	f     *fakeZitadel
	token string
}

func (a fakeAdmin) check(op string) error {
	if err := a.f.failures[op]; err != nil {
		return err
	}
	if !a.f.tokens[a.token] {
		return errors.New("401 unauthorized")
	}
	return nil
}

func (a fakeAdmin) CurrentUserID(context.Context) (string, error) {
	return "user-1", a.check("me")
}

func (a fakeAdmin) AddMachineKey(_ context.Context, _ string, expires time.Time) (string, []byte, error) {
	if err := a.check("add"); err != nil {
		return "", nil, err
	}
	a.f.nextKey++
	id := fmt.Sprintf("k%d", a.f.nextKey)
	a.f.keys[id] = true
	a.f.expires = append(a.f.expires, expires)
	if a.f.failures["corrupt"] != nil {
		return id, []byte("{"), nil
	}
	return id, keyJSON(a.f.t, id, false), nil
}

func (a fakeAdmin) ListMachineKeys(context.Context, string) ([]string, error) {
	return ids(a.f.keys), a.check("listKeys")
}

func (a fakeAdmin) RemoveMachineKey(_ context.Context, _, id string) error {
	if err := a.check("removeKey"); err != nil {
		return err
	}
	delete(a.f.keys, id)
	return nil
}

func (a fakeAdmin) ListPersonalAccessTokens(context.Context, string) ([]string, error) {
	return ids(a.f.pats), a.check("listPATs")
}

func (a fakeAdmin) RemovePersonalAccessToken(_ context.Context, _, id string) error {
	if err := a.check("removePAT"); err != nil {
		return err
	}
	delete(a.f.pats, id)
	delete(a.f.tokens, "the-pat")
	return nil
}

func ids(set map[string]bool) []string {
	out := []string{}
	for id := range set {
		out = append(out, id)
	}
	return out
}

func newManager(t *testing.T, f *fakeZitadel) Manager {
	return Manager{
		KeyFile:   filepath.Join(t.TempDir(), "provisioner", "machine-key.json"),
		Exchanger: f,
		Admin:     f.admin,
		Now:       func() time.Time { return time.Unix(1_800_000_000, 0) },
		Sleep:     noSleep,
	}
}

func patBootstrap(context.Context) (string, error) { return "the-pat", nil }

func TestAcquireMigratesFromPATAndRevokesIt(t *testing.T) {
	f := newFakeZitadel(t)
	m := newManager(t, f)

	s, err := m.Acquire(context.Background(), patBootstrap)
	if err != nil {
		t.Fatalf("Acquire() error = %v", err)
	}
	if !s.UsedBootstrap || s.Token != "token-k1" || len(s.Warnings) != 0 {
		t.Errorf("session = %+v", s)
	}
	if len(f.pats) != 0 || f.tokens["the-pat"] {
		t.Errorf("PATs %v still held after migration", f.pats)
	}
	if want := time.Unix(1_800_000_000, 0).Add(DefaultKeyLifetime); !f.expires[0].Equal(want) {
		t.Errorf("key expiry = %v, want %v", f.expires[0], want)
	}
	if key, found, err := LoadKey(m.KeyFile); err != nil || !found || key.KeyID != "k1" {
		t.Errorf("stored key = %+v, %v, %v", key, found, err)
	}
}

func TestAcquireRotatesAStoredKeyWithoutBootstrap(t *testing.T) {
	f := newFakeZitadel(t)
	m := newManager(t, f)
	m.KeyLifetime = time.Hour
	if _, err := m.Acquire(context.Background(), patBootstrap); err != nil {
		t.Fatal(err)
	}
	noPAT := func(context.Context) (string, error) { return "", errors.New("must not be called") }

	s, err := m.Acquire(context.Background(), noPAT)
	if err != nil {
		t.Fatalf("Acquire() error = %v", err)
	}
	if s.UsedBootstrap || s.Token != "token-k2" {
		t.Errorf("session = %+v", s)
	}
	if len(f.keys) != 1 || !f.keys["k2"] {
		t.Errorf("keys = %v, want only k2", f.keys)
	}
	if got := f.expires[1].Sub(time.Unix(1_800_000_000, 0)); got != time.Hour {
		t.Errorf("custom lifetime = %v", got)
	}
}

func TestAcquireFallsBackWhenTheStoredKeyIsRejected(t *testing.T) {
	f := newFakeZitadel(t)
	m := newManager(t, f)
	if err := WriteKey(m.KeyFile, keyJSON(t, "stale", false)); err != nil {
		t.Fatal(err)
	}
	s, err := m.Acquire(context.Background(), patBootstrap)
	if err != nil {
		t.Fatalf("Acquire() error = %v", err)
	}
	if !s.UsedBootstrap || len(s.Warnings) != 1 || !strings.Contains(s.Warnings[0], "rejected") {
		t.Errorf("session = %+v", s)
	}

	if err := WriteKey(m.KeyFile, keyJSON(t, "stale", false)); err != nil {
		t.Fatal(err)
	}
	noPAT := func(context.Context) (string, error) { return "", errors.New("no PAT anywhere") }
	if _, err := m.Acquire(context.Background(), noPAT); err == nil || !strings.Contains(err.Error(), "no PAT anywhere") {
		t.Errorf("Acquire() without PAT error = %v", err)
	}
}

func TestAcquirePropagatesSetupFailures(t *testing.T) {
	transient := errors.New("connection refused")
	cases := map[string]func(t *testing.T, f *fakeZitadel, m *Manager) BootstrapFunc{
		"bootstrap fails": func(*testing.T, *fakeZitadel, *Manager) BootstrapFunc {
			return func(context.Context) (string, error) { return "", transient }
		},
		"stored key exchange is transient": func(t *testing.T, f *fakeZitadel, m *Manager) BootstrapFunc {
			if err := WriteKey(m.KeyFile, keyJSON(t, "k9", false)); err != nil {
				t.Fatal(err)
			}
			f.failures["exchange"] = transient
			return patBootstrap
		},
		"key file is not owner-only": func(t *testing.T, _ *fakeZitadel, m *Manager) BootstrapFunc {
			if err := WriteKey(m.KeyFile, keyJSON(t, "k9", false)); err != nil {
				t.Fatal(err)
			}
			if err := os.Chmod(m.KeyFile, 0o640); err != nil {
				t.Fatal(err)
			}
			return patBootstrap
		},
		"user lookup fails": func(_ *testing.T, f *fakeZitadel, _ *Manager) BootstrapFunc {
			f.failures["me"] = transient
			return patBootstrap
		},
		"key creation fails": func(_ *testing.T, f *fakeZitadel, _ *Manager) BootstrapFunc {
			f.failures["add"] = transient
			return patBootstrap
		},
	}
	for name, setup := range cases {
		t.Run(name, func(t *testing.T) {
			f := newFakeZitadel(t)
			m := newManager(t, f)
			if _, err := m.Acquire(context.Background(), setup(t, f, &m)); err == nil {
				t.Fatal("Acquire() error = nil")
			}
		})
	}
}

// TestAcquireDeletesANewKeyThatCannotBeUsed leaves no orphaned valid key in
// Zitadel and keeps the previous key file when the new key fails.
func TestAcquireDeletesANewKeyThatCannotBeUsed(t *testing.T) {
	t.Run("never accepted", func(t *testing.T) {
		f := newFakeZitadel(t)
		m := newManager(t, f)
		f.rejectNewKeyTimes = 99
		if _, err := m.Acquire(context.Background(), patBootstrap); err == nil {
			t.Fatal("Acquire() error = nil")
		}
		if len(f.keys) != 0 || !f.pats["pat-1"] {
			t.Errorf("keys %v, PATs %v: want the new key removed and the PAT kept", f.keys, f.pats)
		}
	})
	t.Run("corrupt key details, cleanup also fails", func(t *testing.T) {
		f := newFakeZitadel(t)
		m := newManager(t, f)
		f.failures["corrupt"] = errors.New("x")
		f.failures["removeKey"] = errors.New("remove failed")
		_, err := m.Acquire(context.Background(), patBootstrap)
		if err == nil || !strings.Contains(err.Error(), "remove failed") {
			t.Fatalf("Acquire() error = %v, want both failures", err)
		}
	})
	t.Run("transient verify error", func(t *testing.T) {
		f := newFakeZitadel(t)
		m := newManager(t, f)
		m.Exchanger = failingExchanger{}
		if _, err := m.Acquire(context.Background(), patBootstrap); err == nil {
			t.Fatal("Acquire() error = nil")
		}
	})
	t.Run("key file cannot be written", func(t *testing.T) {
		f := newFakeZitadel(t)
		m := newManager(t, f)
		blocker := filepath.Join(t.TempDir(), "file")
		if err := os.WriteFile(blocker, nil, 0o600); err != nil {
			t.Fatal(err)
		}
		m.KeyFile = filepath.Join(blocker, "machine-key.json")
		if _, err := m.Acquire(context.Background(), patBootstrap); err == nil || len(f.keys) != 0 {
			t.Fatalf("Acquire() error = %v, keys = %v", err, f.keys)
		}
	})
}

type failingExchanger struct{}

func (failingExchanger) Exchange(context.Context, Key) (string, error) {
	return "", errors.New("connection reset")
}

func TestAcquireWaitsForANewKeyToPropagate(t *testing.T) {
	f := newFakeZitadel(t)
	m := newManager(t, f)
	f.rejectNewKeyTimes = 2
	if _, err := m.Acquire(context.Background(), patBootstrap); err != nil {
		t.Fatalf("Acquire() error = %v", err)
	}

	f2 := newFakeZitadel(t)
	m2 := newManager(t, f2)
	f2.rejectNewKeyTimes = 1
	sleepErr := errors.New("cancelled")
	m2.Sleep = func(context.Context, time.Duration) error { return sleepErr }
	if _, err := m2.Acquire(context.Background(), patBootstrap); !errors.Is(err, sleepErr) {
		t.Fatalf("Acquire() error = %v, want the sleep error", err)
	}
}

// TestAcquireReportsCleanupFailuresAsWarnings keeps the run going: the new
// key is stored, and the next run retries the deletion.
func TestAcquireReportsCleanupFailuresAsWarnings(t *testing.T) {
	for _, op := range []string{"listKeys", "listPATs", "removePAT"} {
		t.Run(op, func(t *testing.T) {
			f := newFakeZitadel(t)
			m := newManager(t, f)
			f.failures[op] = errors.New(op + " failed")
			s, err := m.Acquire(context.Background(), patBootstrap)
			if err != nil {
				t.Fatalf("Acquire() error = %v", err)
			}
			if len(s.Warnings) == 0 || !strings.Contains(strings.Join(s.Warnings, " "), op+" failed") {
				t.Errorf("warnings = %v", s.Warnings)
			}
		})
	}
	t.Run("removeKey", func(t *testing.T) {
		f := newFakeZitadel(t)
		m := newManager(t, f)
		if _, err := m.Acquire(context.Background(), patBootstrap); err != nil {
			t.Fatal(err)
		}
		f.failures["removeKey"] = errors.New("removeKey failed")
		s, err := m.Acquire(context.Background(), patBootstrap)
		if err != nil || len(s.Warnings) != 1 || !strings.Contains(s.Warnings[0], "machine key k1") {
			t.Fatalf("Acquire() = %+v, %v", s, err)
		}
	})
}

func TestManagerDefaults(t *testing.T) {
	m := Manager{}
	if m.keyLifetime() != DefaultKeyLifetime {
		t.Errorf("keyLifetime() = %v", m.keyLifetime())
	}
	if time.Since(m.now()) > time.Minute {
		t.Errorf("now() = %v", m.now())
	}
	if err := m.sleep(context.Background(), time.Millisecond); err != nil {
		t.Errorf("sleep() error = %v", err)
	}
	e := Exchanger{}
	if time.Since(e.now()) > time.Minute {
		t.Errorf("Exchanger.now() = %v", e.now())
	}
	if err := e.sleep(context.Background(), time.Millisecond); err != nil {
		t.Errorf("Exchanger.sleep() error = %v", err)
	}
}
