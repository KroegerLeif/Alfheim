// Package httpjson writes JSON response bodies with the correct Content-Type.
//
// Every public household-app endpoint answers errors with
// {"error": "<code>", "message": "<human readable explanation>"}. Writing these
// bodies through http.Error would label them text/plain, which makes HTTP
// clients (ky in the frontend) treat the JSON as an opaque string.
package httpjson

import (
	"encoding/json"
	"net/http"
)

// ErrorBody is the error envelope returned by the public API.
type ErrorBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// Write encodes v as JSON with the given status code.
func Write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	// The status line is already sent; an encoding failure can only mean the
	// client went away, so there is nothing left to report to it.
	_ = json.NewEncoder(w).Encode(v)
}

// WriteError writes an {"error","message"} body with the given status code.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	Write(w, status, ErrorBody{Error: code, Message: message})
}

// WriteUnauthorized answers a request that reached a handler without verified user claims.
func WriteUnauthorized(w http.ResponseWriter) {
	WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
}
