package middleware

import (
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
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func generateJWKSServer(t *testing.T, keyID string) (*rsa.PrivateKey, *httptest.Server) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate rsa key: %v", err)
	}

	nBytes := privateKey.N.Bytes()
	eBytes := big.NewInt(int64(privateKey.E)).Bytes()

	nStr := base64.RawURLEncoding.EncodeToString(nBytes)
	eStr := base64.RawURLEncoding.EncodeToString(eBytes)

	jwksResponse := map[string]interface{}{
		"keys": []map[string]interface{}{
			{
				"kty": "RSA",
				"alg": "RS256",
				"use": "sig",
				"kid": keyID,
				"n":   nStr,
				"e":   eStr,
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(jwksResponse)
	}))

	return privateKey, server
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

	t.Run("returns error on invalid jwks url", func(t *testing.T) {
		auth, err := NewAuthenticator("http://invalid.localhost.test:99999/jwks", "test-issuer", "test-audience", discardLog)
		if err == nil {
			t.Errorf("expected error initializing authenticator with invalid url, got nil")
		}
		if auth != nil {
			t.Errorf("expected nil authenticator, got %v", auth)
		}
	})

	t.Run("successfully constructs authenticator", func(t *testing.T) {
		_, server := generateJWKSServer(t, "key-1")
		defer server.Close()

		auth, err := NewAuthenticator(server.URL, "", "", discardLog)
		if err != nil {
			t.Fatalf("expected no error constructing authenticator, got %v", err)
		}
		if auth == nil {
			t.Fatalf("expected authenticator instance, got nil")
		}
		if auth.expectedIssuer != "http://api.alfheim.loegien.localhost/auth/realms/alfheim" {
			t.Errorf("expected default issuer, got %s", auth.expectedIssuer)
		}
	})
}

func TestAuthenticateMiddleware(t *testing.T) {
	keyID := "test-key-1"
	privKey, server := generateJWKSServer(t, keyID)
	defer server.Close()

	issuer := "http://test-issuer.local"
	audience := "chat-backend"
	discardLog := slog.New(slog.NewTextHandler(io.Discard, nil))

	auth, err := NewAuthenticator(server.URL, issuer, audience, discardLog)
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
				"aud": audience,
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
				"aud": "some-other-client",
				"exp": time.Now().Add(time.Hour).Unix(),
			},
			signKey:        privKey,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "invalid or expired token",
		},
		{
			name:       "valid token with sub, email, household_id, roles and matching audience",
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

	t.Run("CORS sets headers and passes non-OPTIONS request to next", func(t *testing.T) {
		nextCalled := false
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			nextCalled = true
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest(http.MethodGet, "/cors-test", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rec := httptest.NewRecorder()

		CORS(next).ServeHTTP(rec, req)

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

		CORS(next).ServeHTTP(rec, req)

		if nextCalled {
			t.Errorf("expected next handler NOT to be called on OPTIONS")
		}
		if rec.Code != http.StatusOK {
			t.Errorf("expected 200 OK for OPTIONS, got %d", rec.Code)
		}
	})
}
