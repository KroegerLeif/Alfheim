package app

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"alfheim/installer/internal/features/security"
	"alfheim/installer/internal/shared/assets"
	"alfheim/installer/internal/shared/envfile"
)

// updateAssetContents is a fixed set of "new release" file bodies for the
// full assets.StackAssets list, keyed by release asset name.
func updateAssetContents(newTag string) map[string]string {
	return map[string]string{
		"compose.prod.yaml":    "services: {} # " + newTag + "\n",
		"otelcol-config.yaml":  "# otel " + newTag + "\n",
		"init-multiple-dbs.sh": "#!/bin/bash\n# init " + newTag + "\n",
		"vector.toml":          "# vector " + newTag + "\n",
		"verify-stack.sh":      "#!/bin/bash\nexit 0\n",
	}
}

// startAssetServer serves the SHA256SUMS + every StackAssets body an update
// run needs to download, exactly as a GitHub release does (flat, by
// basename).
func startAssetServer(t *testing.T, bodies map[string]string) *httptest.Server {
	t.Helper()
	var sums strings.Builder
	for name, body := range bodies {
		sum := sha256.Sum256([]byte(body))
		sums.WriteString(hex.EncodeToString(sum[:]) + "  " + name + "\n")
	}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == assets.SHA256SUMSName {
			_, _ = w.Write([]byte(sums.String()))
			return
		}
		body, ok := bodies[name]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, _ = w.Write([]byte(body))
	}))
}

// writeExistingInstall lays out a minimal but complete installed tree at
// dir: the Day-1 marker, an .env with every manifest secret already
// generated (so backfillSecrets has nothing to do), the onboarding keys
// HeadlessConfigFromEnv needs, and a pre-update compose.prod.yaml. It
// returns the initial secret map so tests can assert none of it changed.
func writeExistingInstall(t *testing.T, dir, previousTag string) map[string]string {
	t.Helper()
	secrets, err := security.GenerateAll(security.NewGenerator(), map[string]string{})
	if err != nil {
		t.Fatal(err)
	}

	env := map[string]string{
		"DOMAIN":                   "example.com",
		"ALFHEIM_HOST":             "alfheim.example.com",
		"ZITADEL_ADMIN_EMAIL":      "ops@example.com",
		"ZITADEL_EXTERNALSECURE":   "true",
		"ZITADEL_EXTERNALDOMAIN":   "auth.example.com",
		"ALFHEIM_BASE_URL":         "https://alfheim.example.com",
		"IMAGE_TAG":                previousTag,
		"ALFHEIM_CUSTOM_UNTOUCHED": "keep-me-exactly",
	}
	for k, v := range secrets {
		env[k] = v
	}

	var buf strings.Builder
	for _, k := range sortedKeys(env) {
		buf.WriteString(k + "=" + env[k] + "\n")
	}
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte(buf.String()), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".alfheim.installed"),
		[]byte("version="+previousTag+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "compose.prod.yaml"), []byte("services: {} # old\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	return env
}

func sortedKeys(m map[string]string) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j] < out[j-1]; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

func newTestUpdateApp(dir string, opts *UpdateOptions, srv *httptest.Server) (*UpdateApp, *bytes.Buffer, *bytes.Buffer) {
	var stdout, stderr bytes.Buffer
	return &UpdateApp{
		Options:     opts,
		Build:       BuildInfo{Version: "v1.0.0-test"},
		Runner:      healthyDocker(),
		Stdout:      &stdout,
		Stderr:      &stderr,
		Provisioner: &stubProvisioner{},
		BaseURL:     srv.URL,
		Now:         func() time.Time { return time.Date(2026, 9, 19, 12, 0, 0, 0, time.UTC) },
	}, &stdout, &stderr
}

func TestUpdateApp_Succeeds(t *testing.T) {
	dir := t.TempDir()
	before := writeExistingInstall(t, dir, "v1.0.0")

	bodies := updateAssetContents("v1.1.0")
	srv := startAssetServer(t, bodies)
	defer srv.Close()

	app, stdout, stderr := newTestUpdateApp(dir, &UpdateOptions{
		InstallDir: dir, Version: "v1.1.0", Yes: true, Repo: defaultUpdateRepo,
	}, srv)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("Run() = %d, want %d; stderr=%s", code, ExitOK, stderr.String())
	}
	if !strings.Contains(stdout.String(), "updated to v1.1.0") {
		t.Errorf("stdout = %q, want a completion message naming the target version", stdout.String())
	}

	after, err := envfile.ParseFile(filepath.Join(dir, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if after["IMAGE_TAG"] != "v1.1.0" {
		t.Errorf("IMAGE_TAG = %q, want v1.1.0", after["IMAGE_TAG"])
	}
	if after["ALFHEIM_CUSTOM_UNTOUCHED"] != "keep-me-exactly" {
		t.Errorf("ALFHEIM_CUSTOM_UNTOUCHED = %q, want it untouched", after["ALFHEIM_CUSTOM_UNTOUCHED"])
	}
	// Every manifest secret must survive byte-identical: no rotation.
	for _, key := range security.Keys() {
		if before[key] == "" {
			continue
		}
		if after[key] != before[key] {
			t.Errorf("secret %s changed across update: before=%q after=%q", key, before[key], after[key])
		}
	}

	composeContent, err := os.ReadFile(filepath.Join(dir, "compose.prod.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if string(composeContent) != bodies["compose.prod.yaml"] {
		t.Errorf("compose.prod.yaml = %q, want the fetched v1.1.0 content", string(composeContent))
	}

	// A backup of the pre-update compose file exists.
	entries, err := os.ReadDir(filepath.Join(dir, ".alfheim-backups"))
	if err != nil || len(entries) != 1 {
		t.Fatalf("expected exactly one backup directory, got %v (err=%v)", entries, err)
	}
	backedUp, err := os.ReadFile(filepath.Join(dir, ".alfheim-backups", entries[0].Name(), "compose.prod.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if string(backedUp) != "services: {} # old\n" {
		t.Errorf("backup content = %q, want the pre-update file", string(backedUp))
	}

	info, err := os.Stat(filepath.Join(dir, "infrastructure", "postgres", "init-multiple-dbs.sh"))
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o755 {
		t.Errorf("init script mode = %o, want 0755", perm)
	}
}

func TestUpdateApp_UsesBuildVersionWhenFlagOmitted(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")

	bodies := updateAssetContents("v1.0.0-test")
	srv := startAssetServer(t, bodies)
	defer srv.Close()

	app, _, stderr := newTestUpdateApp(dir, &UpdateOptions{
		InstallDir: dir, Yes: true, Repo: defaultUpdateRepo,
	}, srv)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("Run() = %d, want %d; stderr=%s", code, ExitOK, stderr.String())
	}
	after, err := envfile.ParseFile(filepath.Join(dir, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if after["IMAGE_TAG"] != "v1.0.0-test" {
		t.Errorf("IMAGE_TAG = %q, want the binary's own build version", after["IMAGE_TAG"])
	}
}

func TestUpdateApp_RefusesWithoutExistingInstall(t *testing.T) {
	dir := t.TempDir()
	srv := startAssetServer(t, updateAssetContents("v1.1.0"))
	defer srv.Close()

	app, _, stderr := newTestUpdateApp(dir, &UpdateOptions{
		InstallDir: dir, Version: "v1.1.0", Yes: true, Repo: defaultUpdateRepo,
	}, srv)

	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("Run() = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "no existing installation") {
		t.Errorf("stderr = %q, want it to explain no install was found", stderr.String())
	}
}

func TestUpdateApp_RefusesWithoutTargetVersion(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")

	app := &UpdateApp{
		Options: &UpdateOptions{InstallDir: dir, Yes: true, Repo: defaultUpdateRepo},
		Build:   BuildInfo{}, // no injected version: a dev build
		Runner:  healthyDocker(),
		Stdout:  &bytes.Buffer{},
		Stderr:  &bytes.Buffer{},
	}
	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("Run() = %d, want %d", code, ExitFailure)
	}
}

func TestUpdateApp_NeverDefaultsToLatest(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")

	app := &UpdateApp{
		Options: &UpdateOptions{InstallDir: dir, Yes: true, Repo: defaultUpdateRepo},
		Build:   BuildInfo{Version: "dev"},
		Runner:  healthyDocker(),
		Stdout:  &bytes.Buffer{},
		Stderr:  &bytes.Buffer{},
	}
	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("Run() = %d, want %d for a dev build with no --version", code, ExitFailure)
	}
}

func TestUpdateApp_ChecksumMismatchLeavesFilesUntouched(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == assets.SHA256SUMSName {
			_, _ = w.Write([]byte("0000000000000000000000000000000000000000000000000000000000000000  compose.prod.yaml\n"))
			return
		}
		_, _ = w.Write([]byte("tampered\n"))
	}))
	defer srv.Close()

	app, _, stderr := newTestUpdateApp(dir, &UpdateOptions{
		InstallDir: dir, Version: "v1.1.0", Yes: true, Repo: defaultUpdateRepo,
	}, srv)

	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("Run() = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "checksum") {
		t.Errorf("stderr = %q, want it to mention the checksum failure", stderr.String())
	}

	content, err := os.ReadFile(filepath.Join(dir, "compose.prod.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "services: {} # old\n" {
		t.Errorf("compose.prod.yaml was modified despite the checksum failure: %q", string(content))
	}
	if _, err := os.Stat(filepath.Join(dir, ".alfheim-backups")); !os.IsNotExist(err) {
		t.Errorf("a backup directory was created despite never reaching the replace step: err=%v", err)
	}
}

func TestUpdateApp_AbortsWithoutConfirmation(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")

	srv := startAssetServer(t, updateAssetContents("v1.1.0"))
	defer srv.Close()

	app, stdout, stderr := newTestUpdateApp(dir, &UpdateOptions{
		InstallDir: dir, Version: "v1.1.0", Repo: defaultUpdateRepo,
	}, srv)
	app.Stdin = strings.NewReader("n\n")

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("Run() = %d, want %d; stderr=%s", code, ExitOK, stderr.String())
	}
	if !strings.Contains(stdout.String(), "Aborted") {
		t.Errorf("stdout = %q, want an abort message", stdout.String())
	}
	content, err := os.ReadFile(filepath.Join(dir, "compose.prod.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "services: {} # old\n" {
		t.Errorf("compose.prod.yaml was modified despite declining the prompt: %q", string(content))
	}
}
