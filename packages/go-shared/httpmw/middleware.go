// Package httpmw holds the HTTP building blocks every Alfheim Go backend shares:
// request logging with W3C trace propagation, an allowlist CORS middleware, the
// request body cap, middleware composition and the extra-CA transport for
// outbound TLS.
package httpmw

import (
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"go.opentelemetry.io/otel/propagation"
)

// RequestLogger creates a middleware for structured request logging and W3C trace propagation.
func RequestLogger(log *slog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := propagation.TraceContext{}.Extract(r.Context(), propagation.HeaderCarrier(r.Header))
			r = r.WithContext(ctx)

			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			t1 := time.Now()

			defer func() {
				log.InfoContext(r.Context(), "http request",
					slog.String("method", r.Method),
					slog.String("path", r.URL.Path),
					slog.Int("status", ww.Status()),
					slog.Int("bytes", ww.BytesWritten()),
					slog.Duration("duration", time.Since(t1)),
					slog.String("remote_addr", r.RemoteAddr),
				)
			}()

			next.ServeHTTP(ww, r)
		})
	}
}

// CORSConfig configures CORSWithOrigins. Each backend states the methods and
// request headers its API accepts; there is no allow-everything default.
type CORSConfig struct {
	// AllowedOrigins is the exact-match allowlist of request origins.
	AllowedOrigins []string
	// AllowedMethods is sent as Access-Control-Allow-Methods.
	AllowedMethods []string
	// AllowedHeaders is sent as Access-Control-Allow-Headers.
	AllowedHeaders []string
}

// CORSWithOrigins returns a cross-origin resource sharing middleware that
// reflects the request origin only when it is on the allowlist. Preflight
// (OPTIONS) requests are answered with 200 and never reach the next handler.
func CORSWithOrigins(cfg CORSConfig) func(next http.Handler) http.Handler {
	methods := strings.Join(cfg.AllowedMethods, ", ")
	headers := strings.Join(cfg.AllowedHeaders, ", ")
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if origin := r.Header.Get("Origin"); origin != "" && slices.Contains(cfg.AllowedOrigins, origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}

			w.Header().Set("Access-Control-Allow-Methods", methods)
			w.Header().Set("Access-Control-Allow-Headers", headers)

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Chain composes middlewares so that the first one listed runs first.
func Chain(mws ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		for i := len(mws) - 1; i >= 0; i-- {
			next = mws[i](next)
		}
		return next
	}
}
