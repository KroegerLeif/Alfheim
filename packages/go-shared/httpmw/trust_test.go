package httpmw

import (
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
	t.Setenv(ExtraCAFileEnv, "")
	rt, err := ExtraCATransport()
	if err != nil || rt != nil {
		t.Fatalf("expected nil transport and nil error, got %v, %v", rt, err)
	}
}

func TestExtraCATransport_TrustsTheExtraCA(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(server.Close)

	t.Run("fails without the extra CA", func(t *testing.T) {
		t.Setenv(ExtraCAFileEnv, "")
		rt, err := ExtraCATransport()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		resp, err := (&http.Client{Transport: rt}).Get(server.URL)
		if err == nil {
			_ = resp.Body.Close()
			t.Fatal("expected TLS verification failure without the extra CA")
		}
	})

	t.Run("succeeds with the extra CA", func(t *testing.T) {
		t.Setenv(ExtraCAFileEnv, writeServerCA(t, server))
		rt, err := ExtraCATransport()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		resp, err := (&http.Client{Transport: rt}).Get(server.URL)
		if err != nil {
			t.Fatalf("expected the request to succeed, got %v", err)
		}
		_ = resp.Body.Close()
	})
}

func TestExtraCATransport_InvalidConfigFailsLoudly(t *testing.T) {
	t.Run("missing file", func(t *testing.T) {
		t.Setenv(ExtraCAFileEnv, filepath.Join(t.TempDir(), "missing.crt"))
		if _, err := ExtraCATransport(); err == nil || !strings.Contains(err.Error(), "missing.crt") {
			t.Fatalf("expected error naming the missing file, got %v", err)
		}
	})

	t.Run("no certificates", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "garbage.crt")
		if err := os.WriteFile(path, []byte("not a certificate"), 0o600); err != nil {
			t.Fatalf("write file: %v", err)
		}
		t.Setenv(ExtraCAFileEnv, path)
		if _, err := ExtraCATransport(); err == nil || !strings.Contains(err.Error(), "no valid PEM") {
			t.Fatalf("expected invalid PEM error, got %v", err)
		}
	})
}
