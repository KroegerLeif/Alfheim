package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

func TestExtractUserClaims_OperatorRole(t *testing.T) {
	granted := map[string]interface{}{"alfheim_operator": map[string]interface{}{"123": "auth.example.com"}}
	other := map[string]interface{}{"viewer": map[string]interface{}{"123": "auth.example.com"}}

	tests := []struct {
		name   string
		claims jwt.MapClaims
		want   bool
	}{
		{"generic roles claim", jwt.MapClaims{"sub": "u", "urn:zitadel:iam:org:project:roles": granted}, true},
		{"project scoped roles claim", jwt.MapClaims{"sub": "u", "urn:zitadel:iam:org:project:2831:roles": granted}, true},
		{"other role only", jwt.MapClaims{"sub": "u", "urn:zitadel:iam:org:project:roles": other}, false},
		{"claim absent", jwt.MapClaims{"sub": "u"}, false},
		{"claim is a string", jwt.MapClaims{"sub": "u", "urn:zitadel:iam:org:project:roles": "alfheim_operator"}, false},
		{"claim is a list", jwt.MapClaims{"sub": "u", "urn:zitadel:iam:org:project:roles": []interface{}{"alfheim_operator"}}, false},
		{"claim is null", jwt.MapClaims{"sub": "u", "urn:zitadel:iam:org:project:roles": nil}, false},
		{"role in unrelated claim", jwt.MapClaims{"sub": "u", "groups": granted}, false},
		{"role in claim with wrong suffix", jwt.MapClaims{"sub": "u", "urn:zitadel:iam:org:project:2831:other": granted}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := extractUserClaims(tt.claims).IsOperator; got != tt.want {
				t.Fatalf("IsOperator = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsOperator_NoClaimsInContext(t *testing.T) {
	if IsOperator(context.Background()) {
		t.Fatal("a context without claims must not be an operator")
	}
}

func TestRequireOperator(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })

	for _, tt := range []struct {
		name   string
		claims *UserClaims
		want   int
	}{
		{"operator", &UserClaims{Subject: "u", IsOperator: true}, http.StatusNoContent},
		{"regular user", &UserClaims{Subject: "u"}, http.StatusForbidden},
		{"no claims", nil, http.StatusForbidden},
	} {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.claims != nil {
				req = req.WithContext(context.WithValue(req.Context(), UserContextKey, tt.claims))
			}
			rec := httptest.NewRecorder()
			RequireOperator(next).ServeHTTP(rec, req)
			if rec.Code != tt.want {
				t.Fatalf("status = %d, want %d", rec.Code, tt.want)
			}
			if tt.want == http.StatusForbidden && rec.Body.String() != `{"error":"operator_required","message":"this action requires the alfheim_operator role"}` {
				t.Fatalf("unexpected body %s", rec.Body.String())
			}
		})
	}
}
