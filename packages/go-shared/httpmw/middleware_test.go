package httpmw

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.opentelemetry.io/otel/trace"
)

func TestRequestLogger(t *testing.T) {
	t.Run("logs the request and calls next", func(t *testing.T) {
		called := false
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			called = true
			w.WriteHeader(http.StatusAccepted)
		})
		rec := httptest.NewRecorder()
		RequestLogger(slog.New(slog.NewTextHandler(io.Discard, nil)))(next).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/log-test", nil))
		if !called || rec.Code != http.StatusAccepted {
			t.Fatalf("expected next to run with 202, got called=%v status=%d", called, rec.Code)
		}
	})

	t.Run("extracts the traceparent header into the context", func(t *testing.T) {
		var buf bytes.Buffer
		var captured trace.SpanContext
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			captured = trace.SpanContextFromContext(r.Context())
		})
		req := httptest.NewRequest(http.MethodGet, "/trace-test", nil)
		req.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
		RequestLogger(slog.New(slog.NewJSONHandler(&buf, nil)))(next).ServeHTTP(httptest.NewRecorder(), req)

		if !captured.IsValid() {
			t.Fatal("expected a valid span context in the downstream handler")
		}
		if got := captured.TraceID().String(); got != "4bf92f3577b34da6a3ce929d0e0e4736" {
			t.Errorf("unexpected trace id %s", got)
		}
		if got := captured.SpanID().String(); got != "00f067aa0ba902b7" {
			t.Errorf("unexpected span id %s", got)
		}
	})
}

func TestCORSWithOrigins(t *testing.T) {
	cfg := CORSConfig{
		AllowedOrigins: []string{"http://localhost:3000"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "X-Household-ID"},
	}
	tests := []struct {
		name           string
		method         string
		origin         string
		wantNext       bool
		wantAllowOrig  string
		wantCredential string
	}{
		{"allowed origin preflight", http.MethodOptions, "http://localhost:3000", false, "http://localhost:3000", "true"},
		{"allowed origin request", http.MethodGet, "http://localhost:3000", true, "http://localhost:3000", "true"},
		{"foreign origin is not reflected", http.MethodGet, "http://evil.example", true, "", ""},
		{"no origin header", http.MethodGet, "", true, "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			called := false
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called = true })
			req := httptest.NewRequest(tt.method, "/cors", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			rec := httptest.NewRecorder()
			CORSWithOrigins(cfg)(next).ServeHTTP(rec, req)

			if called != tt.wantNext {
				t.Errorf("next called = %v, want %v", called, tt.wantNext)
			}
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tt.wantAllowOrig {
				t.Errorf("Allow-Origin = %q, want %q", got, tt.wantAllowOrig)
			}
			if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != tt.wantCredential {
				t.Errorf("Allow-Credentials = %q, want %q", got, tt.wantCredential)
			}
			if got := rec.Header().Get("Access-Control-Allow-Methods"); got != "GET, POST, OPTIONS" {
				t.Errorf("Allow-Methods = %q", got)
			}
			if got := rec.Header().Get("Access-Control-Allow-Headers"); got != "Authorization, X-Household-ID" {
				t.Errorf("Allow-Headers = %q", got)
			}
		})
	}
}

func TestChain_RunsInListedOrder(t *testing.T) {
	var order []string
	mw := func(name string) func(http.Handler) http.Handler {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r)
			})
		}
	}
	final := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { order = append(order, "handler") })
	Chain(mw("first"), mw("second"))(final).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	if got := len(order); got != 3 || order[0] != "first" || order[1] != "second" || order[2] != "handler" {
		t.Fatalf("unexpected order %v", order)
	}
}
