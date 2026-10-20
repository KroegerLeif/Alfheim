package capabilities_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"alfheim/dashboard/internal/features/capabilities"
	"alfheim/dashboard/internal/shared/middleware"
)

func authAs(claims *middleware.UserClaims) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func TestHandler_Get(t *testing.T) {
	for _, tc := range []struct {
		name   string
		claims *middleware.UserClaims
		want   bool
	}{
		{"operator", &middleware.UserClaims{Subject: "u1", IsOperator: true}, true},
		{"regular user", &middleware.UserClaims{Subject: "u1"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := chi.NewRouter()
			capabilities.NewHandler().RegisterRoutes(r, authAs(tc.claims))

			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/user/capabilities", nil))
			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", rec.Code)
			}
			var got capabilities.Response
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if got.Operator != tc.want {
				t.Fatalf("operator = %v, want %v", got.Operator, tc.want)
			}
		})
	}
}
