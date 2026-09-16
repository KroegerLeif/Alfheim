package envfile

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUpdate_ReplacesExistingKeys(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	initial := "KEEP=untouched\nOIDC_AUDIENCE=__PROVISIONED__\n# a comment\nGRAFANA_OIDC_CLIENT_ID=__PROVISIONED__\n"
	if err := os.WriteFile(path, []byte(initial), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := Update(path, map[string]string{
		"OIDC_AUDIENCE":          "proj-123",
		"GRAFANA_OIDC_CLIENT_ID": "grafana-client",
	}); err != nil {
		t.Fatalf("Update() error = %v", err)
	}

	got, err := ParseFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if got["OIDC_AUDIENCE"] != "proj-123" {
		t.Errorf("OIDC_AUDIENCE = %q", got["OIDC_AUDIENCE"])
	}
	if got["GRAFANA_OIDC_CLIENT_ID"] != "grafana-client" {
		t.Errorf("GRAFANA_OIDC_CLIENT_ID = %q", got["GRAFANA_OIDC_CLIENT_ID"])
	}
	if got["KEEP"] != "untouched" {
		t.Errorf("KEEP = %q, want it left alone", got["KEEP"])
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "# a comment") {
		t.Error("Update() must preserve comment lines")
	}
}

func TestUpdate_AppendsMissingKeys(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	if err := os.WriteFile(path, []byte("EXISTING=1\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := Update(path, map[string]string{"NEW_KEY": "new-value"}); err != nil {
		t.Fatalf("Update() error = %v", err)
	}

	got, err := ParseFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if got["NEW_KEY"] != "new-value" {
		t.Errorf("NEW_KEY = %q", got["NEW_KEY"])
	}
	if got["EXISTING"] != "1" {
		t.Errorf("EXISTING = %q", got["EXISTING"])
	}
}

func TestUpdate_PreservesFileMode(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	if err := os.WriteFile(path, []byte("A=1\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := Update(path, map[string]string{"A": "2"}); err != nil {
		t.Fatal(err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Errorf("mode = %v, want 0600 preserved", info.Mode().Perm())
	}
}

func TestUpdate_NoopOnEmptyInput(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	if err := os.WriteFile(path, []byte("A=1\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := Update(path, nil); err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "A=1\n" {
		t.Errorf("file changed on an empty update: %q", got)
	}
}

func TestUpdate_MissingFileErrors(t *testing.T) {
	dir := t.TempDir()
	err := Update(filepath.Join(dir, "does-not-exist"), map[string]string{"A": "1"})
	if err == nil {
		t.Fatal("Update() error = nil, want a failure for a missing file")
	}
}

func TestUpdate_HandlesExportPrefixedKeys(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	if err := os.WriteFile(path, []byte("export FOO=bar\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := Update(path, map[string]string{"FOO": "baz"}); err != nil {
		t.Fatal(err)
	}
	got, err := ParseFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if got["FOO"] != "baz" {
		t.Errorf("FOO = %q", got["FOO"])
	}
}
