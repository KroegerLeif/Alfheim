package health

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

func probe(t *testing.T, check Check, path string, log *slog.Logger) (int, map[string]string) {
	t.Helper()
	r := chi.NewRouter()
	Register(r, "test-backend", check, log)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("%s body %q is not JSON: %v", path, rec.Body.String(), err)
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Errorf("%s must not be cached", path)
	}
	return rec.Code, body
}

func TestLivenessIgnoresTheDatabase(t *testing.T) {
	down := func(context.Context) error { return errors.New("db down") }
	code, body := probe(t, down, LivenessPath, nil)
	if code != http.StatusOK || body["status"] != "ok" || body["service"] != "test-backend" {
		t.Errorf("GET /healthz = %d %v", code, body)
	}
}

func TestReadiness(t *testing.T) {
	var logs bytes.Buffer
	log := slog.New(slog.NewTextHandler(&logs, nil))

	code, body := probe(t, func(context.Context) error { return nil }, ReadinessPath, log)
	if code != http.StatusOK || body["status"] != "ready" || body["database"] != "ok" {
		t.Errorf("healthy: GET /readyz = %d %v", code, body)
	}

	code, body = probe(t, func(context.Context) error { return errors.New("dial tcp: connection refused") }, ReadinessPath, log)
	if code != http.StatusServiceUnavailable || body["status"] != "unready" {
		t.Errorf("database down: GET /readyz = %d %v", code, body)
	}
	if strings.Contains(body["database"], "refused") {
		t.Errorf("the failure reason leaked into the response: %v", body)
	}
	if !strings.Contains(logs.String(), "connection refused") {
		t.Errorf("the failure reason was not logged: %s", logs.String())
	}

	// No logger and no check: still a clean 503.
	code, _ = probe(t, func(context.Context) error { return errors.New("x") }, ReadinessPath, nil)
	if code != http.StatusServiceUnavailable {
		t.Errorf("nil logger: GET /readyz = %d", code)
	}
	code, _ = probe(t, nil, ReadinessPath, nil)
	if code != http.StatusServiceUnavailable {
		t.Errorf("nil check: GET /readyz = %d, want fail closed", code)
	}
}

func TestReadinessBoundsTheCheck(t *testing.T) {
	var deadline time.Time
	check := func(ctx context.Context) error {
		deadline, _ = ctx.Deadline()
		return nil
	}
	start := time.Now()
	if code, _ := probe(t, check, ReadinessPath, nil); code != http.StatusOK {
		t.Fatalf("GET /readyz = %d", code)
	}
	if deadline.IsZero() || deadline.Sub(start) > CheckTimeout+time.Second {
		t.Errorf("check deadline = %v, want about %v from now", deadline, CheckTimeout)
	}
}

func TestIsProbe(t *testing.T) {
	for path, want := range map[string]bool{"/healthz": true, "/readyz": true, "/api/v1/apps": false, "/readyz/x": false} {
		if IsProbe(path) != want {
			t.Errorf("IsProbe(%q) = %v", path, !want)
		}
	}
}
