package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// countingTransport records how many requests went through the injected client.
type countingTransport struct {
	calls atomic.Int32
	next  http.RoundTripper
}

func (c *countingTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	c.calls.Add(1)
	return c.next.RoundTrip(r)
}

func TestNewAuthenticator(t *testing.T) {
	issuer := newFakeIssuer(t, false)
	issuer.addKey("k1", newRSAKey(t))

	tests := []struct {
		name    string
		cfg     Config
		wantErr string
	}{
		{"missing issuer", Config{Audience: testAudience}, "issuer url is required"},
		{"missing audience", Config{IssuerURL: issuer.server.URL}, "audience is required"},
		{"unreachable issuer", Config{IssuerURL: "http://invalid.localhost.test:99999", Audience: testAudience}, "failed to discover"},
		{"discovery not found", Config{IssuerURL: issuer.server.URL + "/nope", Audience: testAudience}, "unexpected status 404"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.cfg.Logger = discardLogger()
			a, err := NewAuthenticator(context.Background(), tt.cfg)
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("expected error containing %q, got %v", tt.wantErr, err)
			}
			if a != nil {
				t.Fatalf("expected nil authenticator, got %v", a)
			}
		})
	}

	t.Run("discovers the JWKS through the injected client and trims the issuer", func(t *testing.T) {
		transport := &countingTransport{next: http.DefaultTransport}
		a, err := NewAuthenticator(context.Background(), Config{
			IssuerURL:  issuer.server.URL + "/",
			Audience:   testAudience,
			HTTPClient: &http.Client{Transport: transport},
		})
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		defer a.Close()
		if a.expectedIssuer != issuer.server.URL {
			t.Errorf("expected issuer %s, got %s", issuer.server.URL, a.expectedIssuer)
		}
		if a.expectedAudience != testAudience {
			t.Errorf("expected audience %s, got %s", testAudience, a.expectedAudience)
		}
		if got := transport.calls.Load(); got < 2 {
			t.Errorf("expected discovery and JWKS download through the injected client, got %d requests", got)
		}
	})
}

// tokenSpec describes a token a test case presents.
type tokenSpec struct {
	method jwt.SigningMethod
	kid    string
	claims jwt.MapClaims
	// key signs the token; nil uses the issuer's registered key.
	key interface{}
}

func TestAuthenticateMiddleware(t *testing.T) {
	issuer := newFakeIssuer(t, false)
	signingKey := newRSAKey(t)
	issuer.addKey("k1", signingKey)
	a := newTestAuthenticator(t, issuer)

	ecKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ec key: %v", err)
	}
	strangerKey := newRSAKey(t)

	iss := issuer.server.URL
	future := time.Now().Add(time.Hour).Unix()
	valid := func(extra jwt.MapClaims) jwt.MapClaims {
		c := jwt.MapClaims{"sub": "user-42", "iss": iss, "aud": testAudience, "exp": future}
		for k, v := range extra {
			if v == nil {
				delete(c, k)
				continue
			}
			c[k] = v
		}
		return c
	}

	tests := []struct {
		name       string
		header     string
		token      *tokenSpec
		host       string
		wantStatus int
		wantBody   string
	}{
		{name: "missing authorization header", wantStatus: http.StatusUnauthorized, wantBody: "missing authorization header"},
		{name: "not a bearer token", header: "Basic 123456", wantStatus: http.StatusUnauthorized, wantBody: "invalid authorization header format"},
		{name: "too many header parts", header: "Bearer token extra", wantStatus: http.StatusUnauthorized, wantBody: "invalid authorization header format"},
		{name: "malformed token", header: "Bearer invalid-jwt-token", wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token"},
		{
			name:       "wrong issuer",
			token:      &tokenSpec{claims: valid(jwt.MapClaims{"iss": "https://evil.example"})},
			wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token",
		},
		{
			name:       "wrong audience",
			token:      &tokenSpec{claims: valid(jwt.MapClaims{"aud": "some-other-service"})},
			wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token",
		},
		{
			name:       "missing audience",
			token:      &tokenSpec{claims: valid(jwt.MapClaims{"aud": nil})},
			wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token",
		},
		{
			name:       "expired token",
			token:      &tokenSpec{claims: valid(jwt.MapClaims{"exp": time.Now().Add(-time.Hour).Unix()})},
			wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token",
		},
		{
			name:       "missing expiry",
			token:      &tokenSpec{claims: valid(jwt.MapClaims{"exp": nil})},
			wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token",
		},
		{
			name:       "unknown kid",
			token:      &tokenSpec{kid: "not-in-jwks", key: strangerKey, claims: valid(nil)},
			wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token",
		},
		{
			name:       "known kid but foreign signature",
			token:      &tokenSpec{key: strangerKey, claims: valid(nil)},
			wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token",
		},
		{
			name:       "unsupported algorithm HS256",
			token:      &tokenSpec{method: jwt.SigningMethodHS256, key: []byte("shared-secret"), claims: valid(nil)},
			wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token",
		},
		{
			name:       "unsupported algorithm ES256",
			token:      &tokenSpec{method: jwt.SigningMethodES256, key: ecKey, claims: valid(nil)},
			wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token",
		},
		{
			name:       "unsupported algorithm none",
			token:      &tokenSpec{method: jwt.SigningMethodNone, key: jwt.UnsafeAllowNoneSignatureType, claims: valid(nil)},
			wantStatus: http.StatusUnauthorized, wantBody: "invalid or expired token",
		},
		{
			name:       "token without subject",
			token:      &tokenSpec{claims: valid(jwt.MapClaims{"sub": nil})},
			wantStatus: http.StatusUnauthorized, wantBody: "token has no subject",
		},
		{
			name: "valid token; household claims ignored, access token never serialized",
			token: &tokenSpec{claims: valid(jwt.MapClaims{
				"email": "user42@example.com", "household_id": "hh-100",
			})},
			wantStatus: http.StatusOK,
			wantBody:   `{"sub":"user-42","email":"user42@example.com","preferred_username":"","given_name":"","family_name":""}`,
		},
		{
			name:       "validation does not depend on the request host",
			token:      &tokenSpec{claims: valid(nil)},
			host:       "some-internal-container:8080",
			wantStatus: http.StatusOK, wantBody: `"sub":"user-42"`,
		},
	}

	handler := a.AuthenticateMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := GetUserClaims(r.Context())
		if err != nil {
			http.Error(w, "no claims", http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(claims)
	}))

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			header := tt.header
			if tt.token != nil {
				header = "Bearer " + signToken(t, tt.token, signingKey)
			}
			req := httptest.NewRequest(http.MethodGet, "/api/v1/protected", nil)
			if header != "" {
				req.Header.Set("Authorization", header)
			}
			req.Header.Set("X-Household-ID", "hh-header")
			if tt.host != "" {
				req.Host = tt.host
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("expected status %d, got %d (%s)", tt.wantStatus, rec.Code, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), tt.wantBody) {
				t.Errorf("expected body to contain %q, got %q", tt.wantBody, rec.Body.String())
			}
		})
	}
}

// signToken signs spec; defaults are RS256, kid k1 and the issuer's key.
func signToken(t *testing.T, spec *tokenSpec, issuerKey interface{}) string {
	t.Helper()
	method := spec.method
	if method == nil {
		method = jwt.SigningMethodRS256
	}
	kid := spec.kid
	if kid == "" {
		kid = "k1"
	}
	key := spec.key
	if key == nil {
		key = issuerKey
	}
	token := jwt.NewWithClaims(method, spec.claims)
	token.Header["kid"] = kid
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return signed
}

func TestAuthenticateMiddleware_StoresAccessTokenForForwarding(t *testing.T) {
	issuer := newFakeIssuer(t, false)
	key := newRSAKey(t)
	issuer.addKey("k1", key)
	a := newTestAuthenticator(t, issuer)

	signed := signToken(t, &tokenSpec{claims: jwt.MapClaims{
		"sub": "user-1", "iss": issuer.server.URL, "aud": testAudience, "exp": time.Now().Add(time.Hour).Unix(),
	}}, key)

	var got string
	h := a.AuthenticateMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if claims, err := GetUserClaims(r.Context()); err == nil {
			got = claims.AccessToken
		}
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	h.ServeHTTP(httptest.NewRecorder(), req)
	if got != signed {
		t.Fatal("expected the raw access token in the claims for forwarding")
	}
}

// TestAuthenticateMiddleware_SelfHealsOnUnknownKID covers issue #461: a token
// signed with a key added to the JWKS after startup is accepted on first use,
// because RefreshUnknownKID triggers an out-of-band refresh.
func TestAuthenticateMiddleware_SelfHealsOnUnknownKID(t *testing.T) {
	issuer := newFakeIssuer(t, false)
	issuer.addKey("key-at-startup", newRSAKey(t))
	a := newTestAuthenticator(t, issuer)

	newKey := newRSAKey(t)
	issuer.addKey("key-minted-after-startup", newKey)
	signed := signToken(t, &tokenSpec{kid: "key-minted-after-startup", claims: jwt.MapClaims{
		"sub": "user-new-key", "iss": issuer.server.URL, "aud": testAudience, "exp": time.Now().Add(time.Hour).Unix(),
	}}, newKey)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/protected", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()
	a.AuthenticateMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected a post-startup key to be accepted without a restart, got %d %q", rec.Code, rec.Body.String())
	}
}

func TestGetUserClaims(t *testing.T) {
	if claims, err := GetUserClaims(context.Background()); err == nil || claims != nil {
		t.Fatalf("expected an error without claims, got %v, %v", claims, err)
	}
	want := &UserClaims{Subject: "user-123", Email: "test@example.com"}
	got, err := GetUserClaims(ContextWithUserClaims(context.Background(), want))
	if err != nil || got != want {
		t.Fatalf("expected stored claims, got %v, %v", got, err)
	}
}

func TestExtractUserClaims(t *testing.T) {
	t.Run("extracts identity, names and realm roles", func(t *testing.T) {
		uc := extractUserClaims(jwt.MapClaims{
			"sub":                 "user-sub",
			"email":               "user@test.com",
			"preferred_username":  "username1",
			"given_name":          "Given",
			"family_name":         "Family",
			"active_household_id": "active-hh-123",
			"realm_access":        map[string]interface{}{"roles": []interface{}{"admin", "user", 7}},
		})
		if uc.Subject != "user-sub" || uc.Email != "user@test.com" {
			t.Errorf("unexpected identity: %+v", uc)
		}
		if uc.GivenName != "Given" || uc.FamilyName != "Family" || uc.PreferredUsername != "username1" {
			t.Errorf("unexpected names: %+v", uc)
		}
		if len(uc.Roles) != 2 || uc.Roles[0] != "admin" || uc.Roles[1] != "user" {
			t.Errorf("unexpected roles: %+v", uc.Roles)
		}
	})

	t.Run("tolerates missing optional claims", func(t *testing.T) {
		uc := extractUserClaims(jwt.MapClaims{"sub": "user-sub-2"})
		if uc.Subject != "user-sub-2" || uc.Email != "" || len(uc.Roles) != 0 || uc.IsOperator {
			t.Errorf("unexpected claims: %+v", uc)
		}
	})
}
