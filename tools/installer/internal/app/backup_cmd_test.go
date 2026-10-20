package app

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"alfheim/installer/internal/features/backup"
	"alfheim/installer/internal/shared/runner"
)

func TestUpdateApp_TakesBackupBeforeAnythingChanges(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")
	srv := startAssetServer(t, updateAssetContents("v1.1.0"))
	defer srv.Close()

	app, stdout, stderr := newTestUpdateApp(dir, &UpdateOptions{
		InstallDir: dir, Version: "v1.1.0", Yes: true, Repo: defaultUpdateRepo,
	}, srv)
	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("Run() = %d; stderr=%s", code, stderr.String())
	}

	archives, _ := filepath.Glob(filepath.Join(dir, "backups", "alfheim-backup-*.tar.gz"))
	if len(archives) != 1 {
		t.Fatalf("expected one pre-update archive, got %v", archives)
	}
	if !strings.Contains(stdout.String(), archives[0]) {
		t.Errorf("stdout does not tell the operator where the backup is:\n%s", stdout.String())
	}

	calls := app.Runner.(interface{ CallStrings() []string }).CallStrings()
	dump, pull := -1, -1
	for i, c := range calls {
		if strings.Contains(c, "pg_dumpall") && dump < 0 {
			dump = i
		}
		if strings.HasSuffix(c, " pull") && pull < 0 {
			pull = i
		}
		if strings.Contains(c, "exec -T") && strings.Contains(c, " -t ") {
			t.Errorf("command allocates a TTY: %s", c)
		}
	}
	if dump < 0 || pull < 0 || dump > pull {
		t.Errorf("pg_dumpall (index %d) must run before pull (index %d): %v", dump, pull, calls)
	}
	for _, c := range calls {
		if strings.Contains(c, "tar cf -") {
			t.Errorf("update must not archive the media volume: %s", c)
		}
	}
}

func TestUpdateApp_AbortsWhenBackupFails(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")
	srv := startAssetServer(t, updateAssetContents("v1.1.0"))
	defer srv.Close()

	app, _, stderr := newTestUpdateApp(dir, &UpdateOptions{
		InstallDir: dir, Version: "v1.1.0", Yes: true, Repo: defaultUpdateRepo,
	}, srv)
	app.Runner.(*backupDocker).failDump = true

	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("Run() = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "--skip-backup") {
		t.Errorf("stderr = %q, want a hint about --skip-backup", stderr.String())
	}
	content, _ := os.ReadFile(filepath.Join(dir, "compose.prod.yaml"))
	if string(content) != "services: {} # old\n" {
		t.Errorf("compose.prod.yaml changed although the backup failed: %q", content)
	}
	for _, c := range app.Runner.(*backupDocker).CallStrings() {
		if strings.HasSuffix(c, " pull") || strings.Contains(c, "up -d") {
			t.Errorf("update continued after a failed backup: %s", c)
		}
	}
	if archives, _ := filepath.Glob(filepath.Join(dir, "backups", "*")); len(archives) != 0 {
		t.Errorf("failed backup left files: %v", archives)
	}
}

func TestUpdateApp_SkipBackup(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")
	srv := startAssetServer(t, updateAssetContents("v1.1.0"))
	defer srv.Close()

	app, stdout, stderr := newTestUpdateApp(dir, &UpdateOptions{
		InstallDir: dir, Version: "v1.1.0", Yes: true, Repo: defaultUpdateRepo, SkipBackup: true,
	}, srv)
	app.Runner.(*backupDocker).failDump = true // would abort if a backup were attempted

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("Run() = %d; stderr=%s", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), "--skip-backup") {
		t.Errorf("stdout = %q, want a warning that no backup was taken", stdout.String())
	}
	for _, c := range app.Runner.(*backupDocker).CallStrings() {
		if strings.Contains(c, "pg_dumpall") {
			t.Errorf("pg_dumpall ran despite --skip-backup: %s", c)
		}
	}
}

func TestParseUpdateOptions_SkipBackupFlag(t *testing.T) {
	opts, err := ParseUpdateOptions([]string{"--skip-backup", "--install-dir", "/x"}, &bytes.Buffer{})
	if err != nil || !opts.SkipBackup {
		t.Fatalf("opts=%+v err=%v", opts, err)
	}
}

func TestBackupCommandWritesArchiveAndPrunes(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")
	out := filepath.Join(t.TempDir(), "out")
	var stdout, stderr bytes.Buffer
	day := time.Date(2026, 10, 1, 3, 0, 0, 0, time.UTC)
	for i := 0; i < 3; i++ {
		opts, err := ParseBackupOptions([]string{"--install-dir", dir, "--output", out, "--keep", "2"}, &stderr)
		if err != nil {
			t.Fatal(err)
		}
		at := day.AddDate(0, 0, i)
		a := &BackupApp{Options: opts, Runner: newBackupDocker(), Stdout: &stdout, Stderr: &stderr,
			Now: func() time.Time { return at }}
		if code := a.Run(context.Background()); code != ExitOK {
			t.Fatalf("Run() = %d; stderr=%s", code, stderr.String())
		}
	}
	entries, _ := os.ReadDir(out)
	if len(entries) != 2 {
		t.Fatalf("entries = %v, want the 2 newest", entries)
	}
	if entries[0].Name() != backup.ArchiveName(day.AddDate(0, 0, 1)) {
		t.Errorf("oldest kept = %s", entries[0].Name())
	}
}

func TestParseBackupOptionsRejectsBadKeep(t *testing.T) {
	if _, err := ParseBackupOptions([]string{"--keep", "0", "--install-dir", "/x"}, &bytes.Buffer{}); err == nil {
		t.Fatal("--keep 0 accepted")
	}
}

func TestParseRestoreOptionsAcceptsFlagsAfterArchive(t *testing.T) {
	opts, err := ParseRestoreOptions([]string{"a.tar.gz", "--yes", "--install-dir", "/srv/alfheim"}, &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	if opts.Archive != "a.tar.gz" || !opts.Yes || opts.InstallDir != "/srv/alfheim" {
		t.Errorf("opts = %+v", opts)
	}
	if _, err := ParseRestoreOptions([]string{"--yes"}, &bytes.Buffer{}); err == nil {
		t.Error("missing archive accepted")
	}
}

// makeArchive backs up a fresh install and returns the archive path.
func makeArchive(t *testing.T, media bool) string {
	t.Helper()
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")
	out := t.TempDir()
	opts := &BackupOptions{InstallDir: dir, Output: out, Keep: 3, SkipMedia: !media}
	var stdout, stderr bytes.Buffer
	a := &BackupApp{Options: opts, Runner: newBackupDocker(), Stdout: &stdout, Stderr: &stderr}
	if code := a.Run(context.Background()); code != ExitOK {
		t.Fatalf("backup = %d; %s", code, stderr.String())
	}
	m, _ := filepath.Glob(filepath.Join(out, "*.tar.gz"))
	return m[0]
}

func TestRestoreApp_RestoresIntoFreshDirectory(t *testing.T) {
	archive := makeArchive(t, true)
	target := t.TempDir()
	var stdout, stderr bytes.Buffer
	rec := newBackupDocker()
	a := &RestoreApp{
		Options: &RestoreOptions{Archive: archive, InstallDir: target, Yes: true},
		Runner:  rec, Stdout: &stdout, Stderr: &stderr,
	}
	if code := a.Run(context.Background()); code != ExitOK {
		t.Fatalf("Run() = %d; stderr=%s\nstdout=%s", code, stderr.String(), stdout.String())
	}
	if _, err := os.Stat(filepath.Join(target, ".env")); err != nil {
		t.Errorf(".env not restored: %v", err)
	}
	calls := strings.Join(rec.CallStrings(), "\n")
	for _, want := range []string{"create rustfs", "--volumes-from alfheim_rustfs alpine:3.20", "up -d --remove-orphans"} {
		if !strings.Contains(calls, want) {
			t.Errorf("missing %q in calls:\n%s", want, calls)
		}
	}
	if left, _ := filepath.Glob(filepath.Join(target, ".alfheim-restore-*")); len(left) != 0 {
		t.Errorf("staging left behind: %v", left)
	}
}

func TestRestoreApp_RequiresConfirmation(t *testing.T) {
	archive := makeArchive(t, false)
	target := t.TempDir()
	var stdout bytes.Buffer
	rec := newBackupDocker()
	a := &RestoreApp{
		Options: &RestoreOptions{Archive: archive, InstallDir: target},
		Runner:  rec, Stdout: &stdout, Stderr: &bytes.Buffer{}, Stdin: strings.NewReader("n\n"),
	}
	if code := a.Run(context.Background()); code != ExitOK {
		t.Fatalf("Run() = %d", code)
	}
	if !strings.Contains(stdout.String(), "Aborted") {
		t.Errorf("stdout = %q", stdout.String())
	}
	if _, err := os.Stat(filepath.Join(target, ".env")); err == nil {
		t.Error("files restored although the prompt was declined")
	}
	if len(rec.Calls()) != 0 {
		t.Errorf("docker was invoked: %v", rec.CallStrings())
	}
}

func TestRestoreApp_RejectsCorruptArchiveBeforeTouchingAnything(t *testing.T) {
	archive := makeArchive(t, false)
	data, _ := os.ReadFile(archive)
	data[len(data)/2] ^= 0xff
	bad := filepath.Join(t.TempDir(), "bad.tar.gz")
	if err := os.WriteFile(bad, data, 0o600); err != nil {
		t.Fatal(err)
	}
	target := t.TempDir()
	rec := runner.NewRecording(nil)
	a := &RestoreApp{
		Options: &RestoreOptions{Archive: bad, InstallDir: target, Yes: true},
		Runner:  rec, Stdout: &bytes.Buffer{}, Stderr: &bytes.Buffer{},
	}
	if code := a.Run(context.Background()); code != ExitFailure {
		t.Fatalf("Run() = %d, want failure", code)
	}
	if len(rec.Calls()) != 0 {
		t.Errorf("docker was invoked for a corrupt archive: %v", rec.CallStrings())
	}
}
