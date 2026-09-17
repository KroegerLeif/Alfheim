package middleware

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.opentelemetry.io/otel/trace"
)

// generateJWKSServer starts an httptest server that emulates a minimal OIDC
// provider: it serves an OIDC discovery document at
// /.well-known/openid-configuration and the matching JWKS at /jwks.
func generateJWKSServer(t *testing.T, keyID string) (*rsa.PrivateKey, *httptest.Server) {
	privateKey, jwks := newMutableJWKSServer(t)
	jwks.addKey(keyID, privateKey)
	return privateKey, jwks.server
}

// jwkKeyEntry describes a single JWK to expose from a mutableJWKS.
func rsaJWK(keyID string, privateKey *rsa.PrivateKey) map[string]interface{} {
	nStr := base64.RawURLEncoding.EncodeToString(privateKey.N.Bytes())
	eStr := base64.RawURLEncoding.EncodeToString(big.NewInt(int64(privateKey.E)).Bytes())
	return map[string]interface{}{
		"kty": "RSA",
		"alg": "RS256",
		"use": "sig",
		"kid": keyID,
		"n":   nStr,
		"e":   eStr,
	}
}

// mutableJWKS is an httptest-backed OIDC provider whose served JWKS can be
// updated after the server has started, so tests can simulate a key that
// appears only after the authenticator has already been constructed.
type mutableJWKS struct {
	mu     sync.Mutex
	keys   []map[string]interface{}
	server *httptest.Server
}

// newMutableJWKSServer starts a mutableJWKS with no keys yet, generates a
// first RSA key pair, and returns it alongside the server (without adding it
// to the served set) for callers that want to control when it's added.
func newMutableJWKSServer(t *testing.T) (*rsa.PrivateKey, *mutableJWKS) {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate rsa key: %v", err)
	}

	m := &mutableJWKS{}

	mux := http.NewServeMux()
	server := httptest.NewUnstartedServer(mux)
	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"issuer":   server.URL,
			"jwks_uri": server.URL + "/jwks",
		})
	})
	mux.HandleFunc("/jwks", func(w http.ResponseWriter, r *http.Request) {
		m.mu.Lock()
		keys := append([]map[string]interface{}{}, m.keys...)
		m.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"keys": keys})
	})
	server.Start()

	m.server = server
	return privateKey, m
}

// addKey adds an RSA key to the set served at /jwks.
func (m *mutableJWKS) addKey(keyID string, privateKey *rsa.PrivateKey) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.keys = append(m.keys, rsaJWK(keyID, privateKey))
}

func TestGetUserClaims(t *testing.T) {
	t.Run("returns error when claims missing from context", func(t *testing.T) {
		claims, err := GetUserClaims(context.Background())
		if err == nil {
			t.Errorf("expected error, got nil")
		}
		if claims != nil {
			t.Errorf("expected nil claims, got %v", claims)
		}
	})

	t.Run("returns claims when present in context", func(t *testing.T) {
		expected := &UserClaims{Subject: "user-123", Email: "test@example.com"}
		ctx := context.WithValue(context.Background(), UserContextKey, expected)

		claims, err := GetUserClaims(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if claims.Subject != expected.Subject || claims.Email != expected.Email {
			t.Errorf("expected claims %v, got %v", expected, claims)
		}
	})
}

func TestNewAuthenticator(t *testing.T) {
	discardLog := slog.New(slog.NewTextHandler(io.Discard, nil))

	t.Run("returns error when issuer discovery is unreachable", func(t *testing.T) {
		auth, err := NewAuthenticator("http://invalid.localhost.test:99999", "alfheim", discardLog)
		if err == nil {
			t.Errorf("expected error initializing authenticator with unreachable issuer, got nil")
		}
		if auth != nil {
			t.Errorf("expected nil authenticator, got %v", auth)
		}
	})

	t.Run("successfully constructs authenticator via discovery", func(t *testing.T) {
		_, server := generateJWKSServer(t, "key-1")
		defer server.Close()

		auth, err := NewAuthenticator(server.URL+"/", "alfheim", discardLog)
		if err != nil {
			t.Fatalf("expected no error constructing authenticator, got %v", err)
		}
		if auth == nil {
			t.Fatalf("expected authenticator instance, got nil")
		}
		if auth.expectedIssuer != server.URL {
			t.Errorf("expected issuer %s (trailing slash trimmed), got %s", server.URL, auth.expectedIssuer)
		}
		if auth.expectedAudience != "alfheim" {
			t.Errorf("expected audience alfheim, got %s", auth.expectedAudience)
		}
	})
}

func TestAuthenticateMiddleware(t *testing.T) {
	keyID := "test-key-1"
	privKey, server := generateJWKSServer(t, keyID)
	defer server.Close()

	issuer := server.URL
	audience := "alfheim"
	discardLog := slog.New(slog.NewTextHandler(io.Discard, nil))

	auth, err := NewAuthenticator(server.URL, audience, discardLog)
	if err != nil {
		t.Fatalf("failed to create authenticator: %v", err)
	}

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := GetUserClaims(r.Context())
		if err != nil {
			http.Error(w, "no claims", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(claims)
	})

	authMiddleware := auth.AuthenticateMiddleware(testHandler)

	tests := []struct {
		name           string
		authHeader     string
		headerHH       string
		tokenClaims    jwt.MapClaims
		signKey        *rsa.PrivateKey
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "missing authorization header",
			authHeader:     "",
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "missing authorization header",
		},
		{
			name:           "invalid auth header format - no bearer",
			authHeader:     "Basic 123456",
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "invalid authorization header format",
		},
		{
			name:           "invalid token string",
			authHeader:     "Bearer invalid-jwt-token",
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "invalid or expired token",
		},
		{
			name:       "expired token",
			authHeader: "GENERATE",
			tokenClaims: jwt.MapClaims{
				"sub": "user-expired",
				"iss": issuer,
				"exp": time.Now().Add(-time.Hour).Unix(),
			},
			signKey:        privKey,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "invalid or expired token",
		},
		{
			name:       "rejects token with wrong audience",
			authHeader: "GENERATE",
			tokenClaims: jwt.MapClaims{
				"sub": "user-wrong-aud",
				"iss": issuer,
				"aud": "some-other-service",
				"exp": time.Now().Add(time.Hour).Unix(),
			},
			signKey:        privKey,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "invalid or expired token",
		},
		{
			name:       "valid token with sub, email, household_id, roles and issuer",
			authHeader: "GENERATE",
			tokenClaims: jwt.MapClaims{
				"sub":                "user-42",
				"email":              "user42@example.com",
				"preferred_username": "user42",
				"given_name":         "User",
				"family_name":        "FortyTwo",
				"iss":                issuer,
				"aud":                audience,
				"exp":                time.Now().Add(time.Hour).Unix(),
				"household_id":       "hh-100",
				"realm_access": map[string]interface{}{
					"roles": []interface{}{"user", "admin"},
				},
			},
			signKey:        privKey,
			expectedStatus: http.StatusOK,
			expectedSubstr: `"sub":"user-42"`,
		},
		{
			name:       "valid token with active_household_id fallback",
			authHeader: "GENERATE",
			tokenClaims: jwt.MapClaims{
				"sub":                 "user-active-hh",
				"iss":                 issuer,
				"aud":                 audience,
				"exp":                 time.Now().Add(time.Hour).Unix(),
				"active_household_id": "hh-active-200",
			},
			signKey:        privKey,
			expectedStatus: http.StatusOK,
			expectedSubstr: `"household_id":"hh-active-200"`,
		},
		{
			name:       "valid token with X-Household-ID header fallback",
			authHeader: "GENERATE",
			headerHH:   "hh-header-300",
			tokenClaims: jwt.MapClaims{
				"sub": "user-header-hh",
				"iss": issuer,
				"aud": audience,
				"exp": time.Now().Add(time.Hour).Unix(),
			},
			signKey:        privKey,
			expectedStatus: http.StatusOK,
			expectedSubstr: `"household_id":"hh-header-300"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authHeader := tt.authHeader
			if authHeader == "GENERATE" {
				token := jwt.NewWithClaims(jwt.SigningMethodRS256, tt.tokenClaims)
				token.Header["kid"] = keyID
				signedStr, err := token.SignedString(tt.signKey)
				if err != nil {
					t.Fatalf("failed to sign token: %v", err)
				}
				authHeader = "Bearer " + signedStr
			}

			req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/protected", nil)
			if authHeader != "" {
				req.Header.Set("Authorization", authHeader)
			}
			if tt.headerHH != "" {
				req.Header.Set("X-Household-ID", tt.headerHH)
			}
			rec := httptest.NewRecorder()

			authMiddleware.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected response body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

// TestAuthenticateMiddleware_SelfHealsOnUnknownKID reproduces the scenario from
// GitHub issue #461: a JWT is signed with a key that did not exist in the JWKS
// at authenticator-construction time. It must be accepted on first use, without
// recreating the Authenticator and without waiting for the hourly background
// refresh, because RefreshUnknownKID triggers an out-of-band refresh.
func TestAuthenticateMiddleware_SelfHealsOnUnknownKID(t *testing.T) {
	discardLog := slog.New(slog.NewTextHandler(io.Discard, nil))

	firstKeyID := "key-at-startup"
	firstKey, jwks := newMutableJWKSServer(t)
	jwks.addKey(firstKeyID, firstKey)
	defer jwks.server.Close()

	auth, err := NewAuthenticator(jwks.server.URL, "alfheim", discardLog)
	if err != nil {
		t.Fatalf("failed to create authenticator: %v", err)
	}

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	middleware := auth.AuthenticateMiddleware(testHandler)

	// A key minted after the authenticator was constructed (e.g. Zitadel
	// rotating/adding a signing key after backend startup) is not present in
	// the JWKS the authenticator originally fetched.
	newKeyID := "key-minted-after-startup"
	newKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate rsa key: %v", err)
	}
	jwks.addKey(newKeyID, newKey)

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": "user-new-key",
		"iss": jwks.server.URL,
		"aud": "alfheim",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	token.Header["kid"] = newKeyID
	signed, err := token.SignedString(newKey)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/protected", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()

	middleware.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected token signed with a post-startup key to be accepted without a restart, got status %d body %q", rec.Code, rec.Body.String())
	}
}

func TestRequestLoggerAndCORS(t *testing.T) {
	discardLog := slog.New(slog.NewTextHandler(io.Discard, nil))

	t.Run("RequestLogger logs request and calls next", func(t *testing.T) {
		loggerMw := RequestLogger(discardLog)
		called := false
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			called = true
			w.WriteHeader(http.StatusAccepted)
		})

		req := httptest.NewRequest(http.MethodGet, "/log-test", nil)
		rec := httptest.NewRecorder()

		loggerMw(next).ServeHTTP(rec, req)

		if !called {
			t.Errorf("expected next handler to be called")
		}
		if rec.Code != http.StatusAccepted {
			t.Errorf("expected status %d, got %d", http.StatusAccepted, rec.Code)
		}
	})

	t.Run("RequestLogger extracts traceparent header into context and log output", func(t *testing.T) {
		var buf bytes.Buffer
		jsonLog := slog.New(slog.NewJSONHandler(&buf, nil))
		loggerMw := RequestLogger(jsonLog)

		expectedTraceID := "4bf92f3577b34da6a3ce929d0e0e4736"
		expectedSpanID := "00f067aa0ba902b7"
		traceparentHeader := "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"

		var capturedSpanContext trace.SpanContext
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedSpanContext = trace.SpanContextFromContext(r.Context())
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest(http.MethodGet, "/trace-test", nil)
		req.Header.Set("traceparent", traceparentHeader)
		rec := httptest.NewRecorder()

		loggerMw(next).ServeHTTP(rec, req)

		if !capturedSpanContext.IsValid() {
			t.Fatalf("expected valid span context in downstream handler context")
		}
		if got := capturedSpanContext.TraceID().String(); got != expectedTraceID {
			t.Errorf("expected trace ID %s, got %s", expectedTraceID, got)
		}
		if got := capturedSpanContext.SpanID().String(); got != expectedSpanID {
			t.Errorf("expected span ID %s, got %s", expectedSpanID, got)
		}
	})

	t.Run("CORS sets headers and passes non-OPTIONS request to next", func(t *testing.T) {
		nextCalled := false
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			nextCalled = true
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest(http.MethodGet, "/cors-test", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rec := httptest.NewRecorder()

		CORSWithOrigins([]string{"http://localhost:3000"})(next).ServeHTTP(rec, req)

		if !nextCalled {
			t.Errorf("expected next handler to be called")
		}
		if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
			t.Errorf("expected CORS origin header set to request origin, got %q", rec.Header().Get("Access-Control-Allow-Origin"))
		}
	})

	t.Run("CORS handles OPTIONS preflight without calling next", func(t *testing.T) {
		nextCalled := false
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			nextCalled = true
		})

		req := httptest.NewRequest(http.MethodOptions, "/cors-test", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rec := httptest.NewRecorder()

		CORSWithOrigins([]string{"http://localhost:3000"})(next).ServeHTTP(rec, req)

		if nextCalled {
			t.Errorf("expected next handler NOT to be called on OPTIONS")
		}
		if rec.Code != http.StatusOK {
			t.Errorf("expected 200 OK for OPTIONS, got %d", rec.Code)
		}
	})
}
