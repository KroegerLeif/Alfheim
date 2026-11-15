// Package health serves the liveness and readiness probes every Alfheim Go
// backend exposes (#788): /healthz answers as long as the process serves
// HTTP, /readyz only while its dependencies (the database and its schema)
// are usable. Compose healthchecks and Caddy's active health checks probe
// /readyz, so a backend whose database is unreachable reports unhealthy.
package health

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

const (
	// LivenessPath is the liveness probe.
	LivenessPath = "/healthz"
	// ReadinessPath is the readiness probe.
	ReadinessPath = "/readyz"
	// CheckTimeout bounds one readiness check, well inside the 10 s timeout
	// of the compose healthchecks.
	CheckTimeout = 2 * time.Second
)

// Check reports whether a dependency is usable; nil means ready.
type Check func(ctx context.Context) error

// Router is the part of a chi router Register needs.
type Router interface {
	Get(pattern string, h http.HandlerFunc)
}

// Register mounts the liveness and readiness probes of service on r.
func Register(r Router, service string, check Check, log *slog.Logger) {
	r.Get(LivenessPath, Liveness(service))
	r.Get(ReadinessPath, Readiness(service, check, log))
}

// Liveness answers 200 while the process serves requests. It never touches a
// dependency, so a database outage does not get the container restarted.
func Liveness(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		writeStatus(w, http.StatusOK, map[string]string{"status": "ok", "service": service})
	}
}

// Readiness answers 200 when check passes within CheckTimeout and 503
// otherwise. A nil check is never ready. The failure reason is logged, not
// returned, so the probe leaks no internals.
func Readiness(service string, check Check, log *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), CheckTimeout)
		defer cancel()
		if check == nil {
			writeStatus(w, http.StatusServiceUnavailable,
				map[string]string{"status": "unready", "service": service, "database": "unavailable"})
			return
		}
		if err := check(ctx); err != nil {
			if log != nil {
				log.WarnContext(r.Context(), "readiness check failed",
					slog.String("service", service), slog.String("error", err.Error()))
			}
			writeStatus(w, http.StatusServiceUnavailable,
				map[string]string{"status": "unready", "service": service, "database": "unavailable"})
			return
		}
		writeStatus(w, http.StatusOK, map[string]string{"status": "ready", "service": service, "database": "ok"})
	}
}

// IsProbe reports whether path is one of the probes, which request logging
// keeps out of the INFO log.
func IsProbe(path string) bool {
	return path == LivenessPath || path == ReadinessPath
}

func writeStatus(w http.ResponseWriter, status int, body map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
