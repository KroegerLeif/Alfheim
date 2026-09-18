package middleware

import (
	"encoding/json"
	"encoding/pem"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func newTLSDiscoveryServer(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	var server *httptest.Server
	mux.HandleFunc(discoveryPath, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(oidcDiscoveryDocument{Issuer: server.URL, JWKSURI: server.URL + "/keys"})
	})
	mux.HandleFunc("/keys", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"keys":[]}`))
	})
	server = httptest.NewTLSServer(mux)
	t.Cleanup(server.Close)
	return server
}

func writeServerCA(t *testing.T, server *httptest.Server) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "alfheim-root-ca.crt")
	block := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw})
	if err := os.WriteFile(path, block, 0o600); err != nil {
		t.Fatalf("write CA file: %v", err)
	}
	return path
}

func TestExtraCATransport_UnsetKeepsDefaults(t *testing.T) {
	t.Setenv(extraCAFileEnv, "")
	rt, err := extraCATransport()
	if err != nil || rt != nil {
		t.Fatalf("expected nil transport and nil error, got %v, %v", rt, err)
	}
}

func TestDiscoverJWKSURI_ExtraCA(t *testing.T) {
	server := newTLSDiscoveryServer(t)

	t.Run("fails without the extra CA", func(t *testing.T) {
		t.Setenv(extraCAFileEnv, "")
		rt, err := extraCATransport()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, err := discoverJWKSURI(server.URL, rt); err == nil {
			t.Fatal("expected TLS verification failure without the extra CA")
		}
		if _, err := NewAuthenticator(server.URL, "alfheim", discardLogger()); err == nil {
			t.Fatal("expected authenticator startup to fail without the extra CA")
		}
	})

	t.Run("succeeds with the extra CA", func(t *testing.T) {
		t.Setenv(extraCAFileEnv, writeServerCA(t, server))
		rt, err := extraCATransport()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		jwksURI, err := discoverJWKSURI(server.URL, rt)
		if err != nil {
			t.Fatalf("expected discovery to succeed, got %v", err)
		}
		if jwksURI != server.URL+"/keys" {
			t.Fatalf("unexpected jwks_uri %q", jwksURI)
		}

		// The same trust must reach keyfunc's JWKS download.
		auth, err := NewAuthenticator(server.URL, "alfheim", discardLogger())
		if err != nil {
			t.Fatalf("expected authenticator to start with the extra CA, got %v", err)
		}
		auth.jwks.EndBackground()
	})
}

func TestExtraCATransport_InvalidConfigFailsLoudly(t *testing.T) {
	t.Run("missing file", func(t *testing.T) {
		t.Setenv(extraCAFileEnv, filepath.Join(t.TempDir(), "missing.crt"))
		if _, err := extraCATransport(); err == nil || !strings.Contains(err.Error(), "missing.crt") {
			t.Fatalf("expected error naming the missing file, got %v", err)
		}
	})

	t.Run("no certificates", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "garbage.crt")
		if err := os.WriteFile(path, []byte("not a certificate"), 0o600); err != nil {
			t.Fatalf("write file: %v", err)
		}
		t.Setenv(extraCAFileEnv, path)
		if _, err := extraCATransport(); err == nil || !strings.Contains(err.Error(), "no valid PEM") {
			t.Fatalf("expected invalid PEM error, got %v", err)
		}
	})

	t.Run("NewAuthenticator refuses to start", func(t *testing.T) {
		t.Setenv(extraCAFileEnv, filepath.Join(t.TempDir(), "missing.crt"))
		if _, err := NewAuthenticator("https://auth.example.test", "alfheim", discardLogger()); err == nil {
			t.Fatal("expected NewAuthenticator to fail with a broken extra CA file")
		}
	})
}
