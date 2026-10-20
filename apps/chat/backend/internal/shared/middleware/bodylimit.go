package middleware

import (
	"encoding/json"
	"net/http"
)

// DefaultMaxBodyBytes is the request body cap applied to every route unless overridden.
const DefaultMaxBodyBytes int64 = 1 << 20 // 1 MiB

// MaxBodySize rejects request bodies larger than limit bytes.
//
// Requests that declare a Content-Length above the limit are answered with 413
// before any handler runs. Bodies of unknown length (chunked) or with a
// misleading Content-Length are capped by http.MaxBytesReader, so reading past
// the limit fails instead of buffering unbounded input.
//
// pathLimits overrides the limit for exact URL paths (for example the multipart
// upload route, which legitimately carries files larger than a JSON payload).
func MaxBodySize(limit int64, pathLimits map[string]int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			limit := limit
			if override, ok := pathLimits[r.URL.Path]; ok {
				limit = override
			}
			if r.ContentLength > limit {
				writeBodyTooLarge(w)
				return
			}
			if r.Body != nil && r.Body != http.NoBody {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}

func writeBodyTooLarge(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Connection", "close")
	w.WriteHeader(http.StatusRequestEntityTooLarge)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   "payload_too_large",
		"message": "request body exceeds the maximum allowed size",
	})
}
