package apps

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fakeApplier records the calls the service makes.
type fakeApplier struct {
	calls []string
	err   error
}

func (f *fakeApplier) Enable(_ context.Context, a App, s Set) error {
	f.calls = append(f.calls, "enable "+a.Name+" ["+s.String()+"]")
	return f.err
}

func (f *fakeApplier) Disable(_ context.Context, a App, s Set) error {
	f.calls = append(f.calls, "disable "+a.Name+" ["+s.String()+"]")
	return f.err
}

// newEnv writes a .env with content and returns a Store for it.
func newEnv(t *testing.T, content string) EnvFileStore {
	t.Helper()
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return EnvFileStore{Path: path}
}

func newService(store Store, ap Applier) (*Service, *bytes.Buffer) {
	var out bytes.Buffer
	return &Service{Store: store, Applier: ap, Out: &out}, &out
}

func TestServiceEnvRoundTrip(t *testing.T) {
	store := newEnv(t, "POSTGRES_PASSWORD=secret\n")
	ap := &fakeApplier{}
	svc, out := newService(store, ap)
	ctx := context.Background()

	// A missing key means all apps; disabling one writes the rest back.
	if err := svc.Disable(ctx, "budget"); err != nil {
		t.Fatal(err)
	}
	env, err := store.Load()
	if err != nil {
		t.Fatal(err)
	}
	if got := env[EnvKey]; got != "pantry,shopping,chores,library,workout,maintenance,chat,telemetry" {
		t.Errorf("%s = %q", EnvKey, got)
	}
	if _, ok := env[OTELEnabledKey]; ok {
		t.Error("OTEL_ENABLED written for a non-telemetry change")
	}
	if env["POSTGRES_PASSWORD"] != "secret" {
		t.Error("an unrelated key was changed")
	}
	if !strings.Contains(out.String(), "volumes and database were kept") {
		t.Errorf("disable output does not mention kept data: %q", out.String())
	}

	if err := svc.Disable(ctx, Telemetry); err != nil {
		t.Fatal(err)
	}
	env, _ = store.Load()
	if env[OTELEnabledKey] != "false" {
		t.Errorf("OTEL_ENABLED = %q after disabling telemetry", env[OTELEnabledKey])
	}
	if err := svc.Enable(ctx, Telemetry); err != nil {
		t.Fatal(err)
	}
	env, _ = store.Load()
	if env[OTELEnabledKey] != "true" {
		t.Errorf("OTEL_ENABLED = %q after enabling telemetry", env[OTELEnabledKey])
	}
	if len(ap.calls) != 3 {
		t.Errorf("applier calls = %v", ap.calls)
	}
}

func TestServiceIdempotentAndErrors(t *testing.T) {
	store := newEnv(t, EnvKey+"=pantry,shopping\n")
	ap := &fakeApplier{}
	svc, out := newService(store, ap)
	ctx := context.Background()

	if err := svc.Enable(ctx, "pantry"); err != nil {
		t.Fatal(err)
	}
	if err := svc.Disable(ctx, "chat"); err != nil {
		t.Fatal(err)
	}
	if len(ap.calls) != 0 {
		t.Errorf("no-op changes reached the applier: %v", ap.calls)
	}
	if !strings.Contains(out.String(), "already enabled") || !strings.Contains(out.String(), "already disabled") {
		t.Errorf("output = %q", out.String())
	}

	for _, tc := range []struct {
		op   func(context.Context, string) error
		name string
		want error
	}{
		{svc.Disable, "pantry", ErrDependency},
		{svc.Disable, "household", ErrCoreApp},
		{svc.Enable, "todo", ErrUnknownApp},
	} {
		if err := tc.op(ctx, tc.name); !errors.Is(err, tc.want) {
			t.Errorf("%s: err = %v, want %v", tc.name, err, tc.want)
		}
	}

	ap.err = errors.New("compose failed")
	if err := svc.Enable(ctx, "budget"); err == nil || !strings.Contains(err.Error(), "start budget") {
		t.Errorf("Enable error = %v", err)
	}
	if err := svc.Disable(ctx, "shopping"); err == nil || !strings.Contains(err.Error(), "stop shopping") {
		t.Errorf("Disable error = %v", err)
	}
}

func TestServiceList(t *testing.T) {
	svc, _ := newService(newEnv(t, EnvKey+"=\n"), &fakeApplier{})
	rows, err := svc.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != len(Catalog()) {
		t.Fatalf("List() returned %d rows", len(rows))
	}
	for _, r := range rows {
		if r.Enabled != (r.App.Tier == TierCore) {
			t.Errorf("%s enabled=%v on a Lean Core install", r.App.Name, r.Enabled)
		}
	}
}

// failingStore serves env and fails with the configured errors.
type failingStore struct {
	env                map[string]string
	loadErr, updateErr error
}

func (f failingStore) Load() (map[string]string, error) {
	if f.env == nil {
		return map[string]string{}, f.loadErr
	}
	return f.env, f.loadErr
}
func (f failingStore) Update(map[string]string) error { return f.updateErr }

func TestServiceStoreErrors(t *testing.T) {
	ctx := context.Background()
	svc, _ := newService(failingStore{loadErr: errors.New("boom")}, &fakeApplier{})
	if _, err := svc.List(); err == nil {
		t.Error("List ignored a load error")
	}
	if err := svc.Enable(ctx, "pantry"); err == nil {
		t.Error("Enable ignored a load error")
	}
	if err := svc.Disable(ctx, "pantry"); err == nil {
		t.Error("Disable ignored a load error")
	}

	svc, _ = newService(failingStore{updateErr: errors.New("disk full")}, &fakeApplier{})
	if err := svc.Disable(ctx, "chat"); err == nil {
		t.Error("Disable ignored an update error")
	}
	svc, _ = newService(failingStore{env: map[string]string{EnvKey: ""}, updateErr: errors.New("disk full")},
		&fakeApplier{})
	if err := svc.Enable(ctx, "chat"); err == nil {
		t.Error("Enable ignored an update error")
	}
	svc, _ = newService(failingStore{env: map[string]string{EnvKey: "shopping"}}, &fakeApplier{})
	if _, err := svc.List(); !errors.Is(err, ErrDependency) {
		t.Errorf("List of an invalid stored set: err = %v", err)
	}
}
