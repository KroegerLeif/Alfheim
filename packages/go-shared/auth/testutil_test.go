package auth

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
	"sync"
	"testing"
)

const testAudience = "alfheim"

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// rsaJWK renders the public half of privateKey as a JWK with the given kid.
func rsaJWK(keyID string, privateKey *rsa.PrivateKey) map[string]interface{} {
	return map[string]interface{}{
		"kty": "RSA",
		"alg": "RS256",
		"use": "sig",
		"kid": keyID,
		"n":   base64.RawURLEncoding.EncodeToString(privateKey.N.Bytes()),
		"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(privateKey.E)).Bytes()),
	}
}

// fakeIssuer is an httptest OIDC provider: it serves a discovery document at
// /.well-known/openid-configuration and a JWKS at /jwks that tests can extend
// after the authenticator was constructed.
type fakeIssuer struct {
	mu     sync.Mutex
	keys   []map[string]interface{}
	server *httptest.Server
}

func newRSAKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate rsa key: %v", err)
	}
	return key
}

// newFakeIssuer starts a fakeIssuer serving no keys yet.
func newFakeIssuer(t *testing.T, tls bool) *fakeIssuer {
	t.Helper()
	f := &fakeIssuer{}
	mux := http.NewServeMux()
	server := httptest.NewUnstartedServer(mux)
	mux.HandleFunc(discoveryPath, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(oidcDiscoveryDocument{Issuer: server.URL, JWKSURI: server.URL + "/jwks"})
	})
	mux.HandleFunc("/jwks", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		keys := append([]map[string]interface{}{}, f.keys...)
		f.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"keys": keys})
	})
	if tls {
		server.StartTLS()
	} else {
		server.Start()
	}
	t.Cleanup(server.Close)
	f.server = server
	return f
}

// addKey adds an RSA key to the set served at /jwks.
func (f *fakeIssuer) addKey(keyID string, privateKey *rsa.PrivateKey) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.keys = append(f.keys, rsaJWK(keyID, privateKey))
}

// newTestAuthenticator builds an Authenticator for issuer and stops its refresh loop at test end.
func newTestAuthenticator(t *testing.T, issuer *fakeIssuer) *Authenticator {
	t.Helper()
	a, err := NewAuthenticator(context.Background(), Config{
		IssuerURL:  issuer.server.URL,
		Audience:   testAudience,
		HTTPClient: issuer.server.Client(),
		Logger:     discardLogger(),
	})
	if err != nil {
		t.Fatalf("failed to create authenticator: %v", err)
	}
	t.Cleanup(a.Close)
	return a
}
