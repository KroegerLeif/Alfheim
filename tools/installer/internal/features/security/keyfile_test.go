package security

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// writeKey writes key as a PKCS #8 PEM file with mode and returns its path.
func writeKey(t *testing.T, key any, mode os.FileMode) (string, []byte) {
	t.Helper()
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	content := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})
	path := filepath.Join(t.TempDir(), "AuthKey_TEST.p8")
	if err := os.WriteFile(path, content, mode); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, mode); err != nil {
		t.Fatal(err)
	}
	return path, content
}

func ecKey(t *testing.T) *ecdsa.PrivateKey {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func TestReadPrivateKeyFileAcceptsOwnerOnlyECKey(t *testing.T) {
	for _, mode := range []os.FileMode{0o600, 0o400} {
		path, content := writeKey(t, ecKey(t), mode)
		got, err := ReadPrivateKeyFile(path)
		if err != nil {
			t.Fatalf("mode %04o: ReadPrivateKeyFile() error = %v", mode, err)
		}
		if string(got) != string(content) {
			t.Errorf("mode %04o: content differs", mode)
		}
	}
}

func TestReadPrivateKeyFileRejectsLoosePermissions(t *testing.T) {
	for _, mode := range []os.FileMode{0o644, 0o640, 0o604, 0o660} {
		path, content := writeKey(t, ecKey(t), mode)
		_, err := ReadPrivateKeyFile(path)
		if err == nil || !strings.Contains(err.Error(), "chmod 600") {
			t.Fatalf("mode %04o: error = %v, want a refusal naming chmod 600", mode, err)
		}
		if strings.Contains(err.Error(), string(content[30:60])) {
			t.Error("the error must not contain key material")
		}
	}
}

func TestReadPrivateKeyFileRejectsWrongContent(t *testing.T) {
	rsaKey, err := rsa.GenerateKey(rand.Reader, 1024) //nolint:gosec // test-only key size
	if err != nil {
		t.Fatal(err)
	}
	rsaPath, _ := writeKey(t, rsaKey, 0o600)

	dir := t.TempDir()
	notPEM := filepath.Join(dir, "plain.p8")
	if err := os.WriteFile(notPEM, []byte("not a key"), 0o600); err != nil {
		t.Fatal(err)
	}
	badDER := filepath.Join(dir, "bad.p8")
	if err := os.WriteFile(badDER, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: []byte("x")}), 0o600); err != nil {
		t.Fatal(err)
	}
	big := filepath.Join(dir, "big.p8")
	if err := os.WriteFile(big, make([]byte, maxPrivateKeyBytes+1), 0o600); err != nil {
		t.Fatal(err)
	}

	for name, tc := range map[string]struct{ path, want string }{
		"rsa":       {rsaPath, "not an EC key"},
		"not pem":   {notPEM, "no PEM"},
		"bad der":   {badDER, "not a valid PKCS #8"},
		"too large": {big, "larger than"},
		"missing":   {filepath.Join(dir, "missing.p8"), "no such file"},
		"directory": {dir, "not a regular file"},
	} {
		if _, err := ReadPrivateKeyFile(tc.path); err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: error = %v, want %q", name, err, tc.want)
		}
	}
}
