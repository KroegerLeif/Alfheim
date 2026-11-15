package zitadelauth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

var (
	testKeyOnce sync.Once
	testKey     *rsa.PrivateKey
)

// testRSAKey returns one RSA key shared by the package's tests.
func testRSAKey() *rsa.PrivateKey {
	testKeyOnce.Do(func() {
		key, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			panic(err)
		}
		testKey = key
	})
	return testKey
}

// keyJSON renders a Zitadel machine key file around the shared RSA key.
func keyJSON(t *testing.T, keyID string, pkcs8 bool) []byte {
	t.Helper()
	block := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(testRSAKey())}
	if pkcs8 {
		der, err := x509.MarshalPKCS8PrivateKey(testRSAKey())
		if err != nil {
			t.Fatal(err)
		}
		block = &pem.Block{Type: "PRIVATE KEY", Bytes: der}
	}
	return []byte(mustJSON(t, map[string]string{
		"type": "serviceaccount", "keyId": keyID, "key": string(pem.EncodeToMemory(block)), "userId": "user-1",
	}))
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestParseKeyAcceptsPKCS1AndPKCS8(t *testing.T) {
	for _, pkcs8 := range []bool{false, true} {
		key, err := ParseKey(keyJSON(t, "k1", pkcs8))
		if err != nil {
			t.Fatalf("ParseKey(pkcs8=%v) error = %v", pkcs8, err)
		}
		if key.KeyID != "k1" || key.UserID != "user-1" || key.private == nil {
			t.Errorf("ParseKey(pkcs8=%v) = %+v", pkcs8, key)
		}
	}
}

func TestParseKeyRejectsBrokenInput(t *testing.T) {
	ec, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	ecDER, err := x509.MarshalPKCS8PrivateKey(ec)
	if err != nil {
		t.Fatal(err)
	}
	ecPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: ecDER}))
	badPEM := string(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: []byte("garbage")}))
	cases := map[string]string{
		"not json":   "{",
		"incomplete": `{"keyId":"k1"}`,
		"no pem":     `{"keyId":"k1","userId":"u","key":"plain text"}`,
		// Built at run time so no PEM header literal sits in the source.
		"bad der": mustJSON(t, map[string]string{"keyId": "k1", "userId": "u", "key": badPEM}),
		"not rsa": mustJSON(t, map[string]string{"keyId": "k1", "userId": "u", "key": ecPEM}),
	}
	for name, input := range cases {
		if _, err := ParseKey([]byte(input)); err == nil {
			t.Errorf("%s: ParseKey() error = nil", name)
		}
	}
}

func TestLoadKey(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sub", "machine-key.json")

	if _, found, err := LoadKey(path); found || err != nil {
		t.Fatalf("LoadKey(missing) = %v, %v; want not found without error", found, err)
	}
	if err := WriteKey(path, keyJSON(t, "k1", false)); err != nil {
		t.Fatalf("WriteKey() error = %v", err)
	}
	if info, err := os.Stat(path); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("key file stat = %v, %v; want mode 0600", info, err)
	}
	if info, err := os.Stat(filepath.Dir(path)); err != nil || info.Mode().Perm() != 0o700 {
		t.Fatalf("key dir stat = %v, %v; want mode 0700", info, err)
	}
	key, found, err := LoadKey(path)
	if err != nil || !found || key.KeyID != "k1" {
		t.Fatalf("LoadKey() = %+v, %v, %v", key, found, err)
	}

	if err := os.Chmod(path, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, _, err := LoadKey(path); err == nil || !strings.Contains(err.Error(), "owner-only") {
		t.Errorf("LoadKey(0644) error = %v, want a permission refusal", err)
	}
	if err := os.Chmod(path, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, _, err := LoadKey(path); err == nil || !strings.Contains(err.Error(), path) {
		t.Errorf("LoadKey(corrupt) error = %v, want the path named", err)
	}
}

func TestLoadKeyReportsUnreadableFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "machine-key.json")
	// An owner-only directory passes the mode check but cannot be read.
	if err := os.Mkdir(path, 0o700); err != nil {
		t.Fatal(err)
	}
	if _, _, err := LoadKey(path); err == nil {
		t.Error("LoadKey(directory) error = nil")
	}
}

// TestWriteKeyRestrictsAnExistingDirectory covers a checkout or older install
// where the provisioner directory already exists with mode 0755: the key file
// is 0600 and the directory is tightened to 0700.
func TestWriteKeyRestrictsAnExistingDirectory(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "provisioner")
	if err := os.Mkdir(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "machine-key.json")
	if err := WriteKey(path, []byte("{}")); err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct {
		path string
		want os.FileMode
	}{{dir, 0o700}, {path, 0o600}} {
		info, err := os.Stat(c.path)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != c.want {
			t.Errorf("mode of %s = %o, want %o", c.path, got, c.want)
		}
	}
}

func TestWriteKeyFailsWhenDirectoryCannotBeCreated(t *testing.T) {
	blocker := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(blocker, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := WriteKey(filepath.Join(blocker, "machine-key.json"), []byte("{}")); err == nil {
		t.Error("WriteKey() under a regular file error = nil")
	}
}

func TestWriteKeyCleansUpWhenRenameFails(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "machine-key.json")
	// A non-empty directory at the target path makes the rename fail.
	if err := os.MkdirAll(filepath.Join(target, "child"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := WriteKey(target, []byte("{}")); err == nil {
		t.Fatal("WriteKey() error = nil")
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".key-") {
			t.Errorf("temporary file %s was left behind", e.Name())
		}
	}
}

func TestRemoveIfExists(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pat.txt")
	if err := RemoveIfExists(path); err != nil {
		t.Errorf("RemoveIfExists(missing) error = %v", err)
	}
	if err := os.WriteFile(path, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := RemoveIfExists(path); err != nil {
		t.Errorf("RemoveIfExists() error = %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}
