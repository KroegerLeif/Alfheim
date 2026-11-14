package auth

import (
	"context"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"

	"alfheim/go-shared/httpmw"
)

// TestNewAuthenticator_ExtraCA checks that the default client honours
// ALFHEIM_EXTRA_CA_FILE for discovery and the JWKS download alike.
func TestNewAuthenticator_ExtraCA(t *testing.T) {
	issuer := newFakeIssuer(t, true)
	issuer.addKey("k1", newRSAKey(t))
	cfg := Config{IssuerURL: issuer.server.URL, Audience: testAudience, Logger: discardLogger()}

	t.Run("fails without the extra CA", func(t *testing.T) {
		t.Setenv(httpmw.ExtraCAFileEnv, "")
		if _, err := NewAuthenticator(context.Background(), cfg); err == nil {
			t.Fatal("expected startup to fail without the extra CA")
		}
	})

	t.Run("succeeds with the extra CA", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "alfheim-root-ca.crt")
		block := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: issuer.server.Certificate().Raw})
		if err := os.WriteFile(path, block, 0o600); err != nil {
			t.Fatalf("write CA file: %v", err)
		}
		t.Setenv(httpmw.ExtraCAFileEnv, path)
		a, err := NewAuthenticator(context.Background(), cfg)
		if err != nil {
			t.Fatalf("expected startup to succeed with the extra CA, got %v", err)
		}
		a.Close()
	})

	t.Run("a broken extra CA file refuses to start", func(t *testing.T) {
		t.Setenv(httpmw.ExtraCAFileEnv, filepath.Join(t.TempDir(), "missing.crt"))
		if _, err := NewAuthenticator(context.Background(), cfg); err == nil {
			t.Fatal("expected NewAuthenticator to fail with a broken extra CA file")
		}
	})
}
