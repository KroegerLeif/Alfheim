package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"alfheim/installer/internal/shared/assets"
)

func sumOf(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

func TestParseChecksums(t *testing.T) {
	content := []byte("abc123  compose.prod.yaml\n" +
		"def456 *binary-mode-file\n" +
		"\n# a comment style line is not produced by sha256sum, ignore blanks above\n")
	sums := ParseChecksums(content)
	if sums["compose.prod.yaml"] != "abc123" {
		t.Errorf("compose.prod.yaml = %q", sums["compose.prod.yaml"])
	}
	if sums["binary-mode-file"] != "def456" {
		t.Errorf("binary-mode-file = %q, want the '*' prefix stripped", sums["binary-mode-file"])
	}
}

func TestVerify(t *testing.T) {
	content := []byte("hello world")
	sums := map[string]string{"file.txt": sumOf(content)}

	if err := Verify("file.txt", content, sums); err != nil {
		t.Fatalf("Verify() error = %v, want nil", err)
	}
	if err := Verify("file.txt", []byte("tampered"), sums); err == nil {
		t.Fatal("Verify() error = nil, want a checksum mismatch")
	}
	if err := Verify("missing.txt", content, sums); err == nil {
		t.Fatal("Verify() error = nil, want a refusal for an unlisted file")
	}
}

func TestFetchAssets(t *testing.T) {
	files := map[string][]byte{
		"compose.prod.yaml":   []byte("compose-content\n"),
		"otelcol-config.yaml": []byte("otel-content\n"),
	}
	list := []assets.Asset{
		{Name: "compose.prod.yaml", Dest: "compose.prod.yaml", Mode: 0o644},
		{Name: "otelcol-config.yaml", Dest: "infrastructure/telemetry/collector/config.yaml", Mode: 0o644},
	}

	var sums strings.Builder
	for name, content := range files {
		sums.WriteString(sumOf(content) + "  " + name + "\n")
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == assets.SHA256SUMSName {
			_, _ = w.Write([]byte(sums.String()))
			return
		}
		content, ok := files[name]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, _ = w.Write(content)
	}))
	defer srv.Close()

	out, err := FetchAssets(context.Background(), Fetcher{}.Get, srv.URL, list)
	if err != nil {
		t.Fatalf("FetchAssets() error = %v", err)
	}
	if string(out["compose.prod.yaml"]) != "compose-content\n" {
		t.Errorf("compose.prod.yaml content = %q", out["compose.prod.yaml"])
	}
	if string(out["infrastructure/telemetry/collector/config.yaml"]) != "otel-content\n" {
		t.Errorf("otel config content = %q", out["infrastructure/telemetry/collector/config.yaml"])
	}
}

func TestFetchAssetsRejectsBadChecksum(t *testing.T) {
	list := []assets.Asset{{Name: "compose.prod.yaml", Dest: "compose.prod.yaml", Mode: 0o644}}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == assets.SHA256SUMSName {
			_, _ = w.Write([]byte("0000000000000000000000000000000000000000000000000000000000000000  compose.prod.yaml\n"))
			return
		}
		_, _ = w.Write([]byte("compose-content\n"))
	}))
	defer srv.Close()

	if _, err := FetchAssets(context.Background(), Fetcher{}.Get, srv.URL, list); err == nil {
		t.Fatal("FetchAssets() error = nil, want a checksum mismatch")
	}
}

func TestFetchAssetsPropagatesGetError(t *testing.T) {
	boom := errors.New("boom")
	get := func(context.Context, string) ([]byte, error) { return nil, boom }
	if _, err := FetchAssets(context.Background(), get, "http://example.invalid", assets.StackAssets); err == nil {
		t.Fatal("FetchAssets() error = nil, want the Getter's error propagated")
	}
}

func TestBackupAndReplace(t *testing.T) {
	root := t.TempDir()
	list := []assets.Asset{
		{Name: "compose.prod.yaml", Dest: "compose.prod.yaml", Mode: 0o644},
		{Name: "init-multiple-dbs.sh", Dest: "infrastructure/postgres/init-multiple-dbs.sh", Mode: 0o755},
	}

	// Only compose.prod.yaml exists beforehand; the init script is a fresh
	// addition to the asset list for this installation.
	if err := os.WriteFile(filepath.Join(root, "compose.prod.yaml"), []byte("old-compose\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	now := time.Date(2026, 9, 19, 12, 0, 0, 0, time.UTC)
	backupDir, err := Backup(root, list, now)
	if err != nil {
		t.Fatalf("Backup() error = %v", err)
	}
	if !strings.Contains(backupDir, "20260919T120000Z") {
		t.Errorf("backupDir = %q, want it to contain the UTC timestamp", backupDir)
	}
	backedUp, err := os.ReadFile(filepath.Join(backupDir, "compose.prod.yaml"))
	if err != nil {
		t.Fatalf("read backup: %v", err)
	}
	if string(backedUp) != "old-compose\n" {
		t.Errorf("backup content = %q, want the pre-update file", string(backedUp))
	}
	if _, err := os.Stat(filepath.Join(backupDir, "infrastructure", "postgres", "init-multiple-dbs.sh")); !os.IsNotExist(err) {
		t.Errorf("backup of a file that never existed: err = %v, want IsNotExist", err)
	}

	content := map[string][]byte{
		"compose.prod.yaml":                            []byte("new-compose\n"),
		"infrastructure/postgres/init-multiple-dbs.sh": []byte("#!/bin/bash\necho hi\n"),
	}
	if err := Replace(root, list, content); err != nil {
		t.Fatalf("Replace() error = %v", err)
	}
	replaced, err := os.ReadFile(filepath.Join(root, "compose.prod.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if string(replaced) != "new-compose\n" {
		t.Errorf("compose.prod.yaml = %q, want the replaced content", string(replaced))
	}
	info, err := os.Stat(filepath.Join(root, "infrastructure", "postgres", "init-multiple-dbs.sh"))
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o755 {
		t.Errorf("init script mode = %o, want 0755", perm)
	}
}

func TestReplaceMissingContentFails(t *testing.T) {
	root := t.TempDir()
	list := []assets.Asset{{Name: "compose.prod.yaml", Dest: "compose.prod.yaml", Mode: 0o644}}
	if err := Replace(root, list, map[string][]byte{}); err == nil {
		t.Fatal("Replace() error = nil, want a failure for missing content")
	}
}
