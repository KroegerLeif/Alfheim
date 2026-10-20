package backup

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

const validDump = "CREATE ROLE postgres;\n-- PostgreSQL database cluster dump complete\n"

// fakeDocker answers the docker commands backup and restore issue.
type fakeDocker struct {
	calls     []runner.Command
	dump      string
	dumpExit  int
	mediaTar  string
	stdins    map[string]string
	dropStmts map[string]string // SQL -> newline separated statements
	replayErr string
}

func (f *fakeDocker) LookPath(string) (string, error) { return "/usr/bin/docker", nil }

func (f *fakeDocker) Run(_ context.Context, cmd runner.Command) (runner.Result, error) {
	f.calls = append(f.calls, cmd)
	joined := cmd.String()
	if cmd.Stdin != nil {
		b, _ := io.ReadAll(cmd.Stdin)
		if f.stdins == nil {
			f.stdins = map[string]string{}
		}
		f.stdins[joined] = string(b)
	}
	switch {
	case strings.Contains(joined, "SHOW server_version"):
		return runner.Result{Stdout: "16.4\n"}, nil
	case strings.Contains(joined, "pg_dumpall"):
		_, _ = io.WriteString(cmd.Stdout, f.dump)
		return runner.Result{ExitCode: f.dumpExit, Stderr: "boom"}, nil
	case strings.Contains(joined, "tar cf -"):
		_, _ = io.WriteString(cmd.Stdout, f.mediaTar)
		return runner.Result{}, nil
	case strings.Contains(joined, "format('DROP DATABASE"):
		return runner.Result{Stdout: "DROP DATABASE \"alfheim_chat\" WITH (FORCE)\n"}, nil
	case strings.Contains(joined, "format('DROP OWNED"):
		return runner.Result{Stdout: "DROP OWNED BY \"chat_user\"; DROP ROLE \"chat_user\"\n"}, nil
	case cmd.Stdin != nil && strings.Contains(joined, "psql"):
		return runner.Result{Stderr: f.replayErr}, nil
	}
	return runner.Result{}, nil
}

func writeFile(t *testing.T, path, content string, mode os.FileMode) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), mode); err != nil {
		t.Fatal(err)
	}
}

func newInstall(t *testing.T) paths.Layout {
	t.Helper()
	root := t.TempDir()
	writeFile(t, filepath.Join(root, ".env"), "POSTGRES_USER=admin_pg\nIMAGE_TAG=v1.2.3\nZITADEL_MASTERKEY=abc\n", 0o600)
	writeFile(t, filepath.Join(root, ".alfheim.installed"), "version=v1.2.3\n", 0o644)
	writeFile(t, filepath.Join(root, "compose.prod.yaml"), "services: {}\n", 0o644)
	writeFile(t, filepath.Join(root, "infrastructure/zitadel/machinekey/pat.txt"), "PAT", 0o600)
	writeFile(t, filepath.Join(root, "infrastructure/ca/alfheim-root-ca.crt"), "CERT", 0o644)
	writeFile(t, filepath.Join(root, "infrastructure/caddy/pki/root.key"), "KEY", 0o600)
	writeFile(t, filepath.Join(root, "infrastructure/caddy/Caddyfile"), "example.com\n", 0o644)
	layout, err := paths.New(root)
	if err != nil {
		t.Fatal(err)
	}
	return layout
}

func newService(layout paths.Layout, f *fakeDocker, now time.Time) *Service {
	svc := New(f, layout, "v9.9.9", io.Discard)
	svc.Now = func() time.Time { return now }
	svc.Geteuid = func() int { return 1000 }
	return svc
}

var t0 = time.Date(2026, 10, 20, 3, 0, 0, 0, time.UTC)

func create(t *testing.T, svc *Service, out string, media bool) string {
	t.Helper()
	path, err := svc.Create(context.Background(), CreateOptions{OutputDir: out, Keep: 7, IncludeMedia: media})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	return path
}

func TestCreateRunsExactCommandsWithoutTTY(t *testing.T) {
	layout := newInstall(t)
	f := &fakeDocker{dump: validDump, mediaTar: "MEDIA"}
	out := filepath.Join(t.TempDir(), "backups")
	path := create(t, newService(layout, f, t0), out, true)

	compose := "docker compose -f " + layout.ComposeFile()
	want := []string{
		compose + " exec -T postgres-core psql -U admin_pg -d postgres -X -At -c SHOW server_version",
		compose + " exec -T postgres-core pg_dumpall -U admin_pg",
		"docker run --rm --volumes-from alfheim_rustfs:ro alpine:3.20 tar cf - -C /data .",
	}
	for i, w := range want {
		if got := f.calls[i].String(); got != w {
			t.Errorf("call %d = %q, want %q", i, got, w)
		}
	}
	for _, c := range f.calls {
		for _, a := range c.Args {
			if a == "-t" || a == "-it" || a == "-ti" {
				t.Errorf("command %q allocates a TTY", c.String())
			}
		}
	}
	if !f.calls[1].StreamOnly || !f.calls[2].StreamOnly {
		t.Error("dump and media commands must stream without buffering")
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Errorf("archive mode = %o, want 0600", info.Mode().Perm())
	}
	dirInfo, _ := os.Stat(out)
	if dirInfo.Mode().Perm() != 0o700 {
		t.Errorf("output dir mode = %o, want 0700", dirInfo.Mode().Perm())
	}
	if filepath.Base(path) != "alfheim-backup-20261020T030000Z.tar.gz" {
		t.Errorf("archive name = %s", filepath.Base(path))
	}
	left, _ := os.ReadDir(out)
	if len(left) != 1 {
		t.Errorf("output dir has leftovers: %v", left)
	}
}

func TestCreateManifestAndRoundTrip(t *testing.T) {
	layout := newInstall(t)
	f := &fakeDocker{dump: validDump, mediaTar: "MEDIA"}
	path := create(t, newService(layout, f, t0), t.TempDir(), true)

	p, err := Prepare(path, t.TempDir())
	if err != nil {
		t.Fatalf("Prepare() error = %v", err)
	}
	defer func() { _ = p.Cleanup() }()
	m := p.Manifest
	if m.ImageTag != "v1.2.3" || m.PostgresUser != "admin_pg" || m.InstallerVersion != "v9.9.9" ||
		m.PostgresVersion != "16.4" || !m.IncludesMedia {
		t.Errorf("manifest = %+v", m)
	}
	names := map[string]bool{}
	for _, e := range m.Entries {
		names[e.Path] = true
	}
	for _, n := range []string{
		"database.sql", "rustfs-data.tar", "files/.env", "files/.alfheim.installed",
		"files/compose.prod.yaml", "files/infrastructure/zitadel/machinekey/pat.txt",
		"files/infrastructure/ca/alfheim-root-ca.crt", "files/infrastructure/caddy/pki/root.key",
		"files/infrastructure/caddy/Caddyfile",
	} {
		if !names[n] {
			t.Errorf("manifest lacks %s", n)
		}
	}
}

func TestCreateFailsOnIncompleteDumpAndLeavesNothing(t *testing.T) {
	layout := newInstall(t)
	f := &fakeDocker{dump: "CREATE ROLE postgres;\n"}
	out := t.TempDir()
	_, err := newService(layout, f, t0).Create(context.Background(), CreateOptions{OutputDir: out, Keep: 7})
	if err == nil || !strings.Contains(err.Error(), "incomplete") {
		t.Fatalf("Create() error = %v, want an incomplete-dump error", err)
	}
	if left, _ := os.ReadDir(out); len(left) != 0 {
		t.Errorf("failed backup left files behind: %v", left)
	}
}

func TestCreateFailsWhenPgDumpallFails(t *testing.T) {
	layout := newInstall(t)
	f := &fakeDocker{dump: validDump, dumpExit: 1}
	out := t.TempDir()
	if _, err := newService(layout, f, t0).Create(context.Background(), CreateOptions{OutputDir: out, Keep: 7}); err == nil {
		t.Fatal("Create() succeeded despite pg_dumpall failing")
	}
	if left, _ := os.ReadDir(out); len(left) != 0 {
		t.Errorf("failed backup left files behind: %v", left)
	}
}

func TestCreateDefaultsPostgresUser(t *testing.T) {
	layout := newInstall(t)
	writeFile(t, layout.EnvFile(), "IMAGE_TAG=v1\n", 0o600)
	f := &fakeDocker{dump: validDump}
	create(t, newService(layout, f, t0), t.TempDir(), false)
	if !strings.Contains(f.calls[1].String(), "pg_dumpall -U postgres") {
		t.Errorf("dump command = %q, want the default user", f.calls[1].String())
	}
}

func TestCreateRejectsKeepBelowOne(t *testing.T) {
	layout := newInstall(t)
	_, err := newService(layout, &fakeDocker{}, t0).Create(context.Background(),
		CreateOptions{OutputDir: t.TempDir(), Keep: 0})
	if err == nil {
		t.Fatal("Create() accepted --keep 0")
	}
}

func TestRetentionKeepsNewest(t *testing.T) {
	layout := newInstall(t)
	out := t.TempDir()
	f := &fakeDocker{dump: validDump}
	for i := 0; i < 5; i++ {
		svc := newService(layout, f, t0.Add(time.Duration(i)*24*time.Hour))
		if _, err := svc.Create(context.Background(), CreateOptions{OutputDir: out, Keep: 3}); err != nil {
			t.Fatal(err)
		}
	}
	writeFile(t, filepath.Join(out, "notes.txt"), "mine", 0o600)
	writeFile(t, filepath.Join(out, "alfheim-backup-manual.tar.gz"), "mine", 0o600)

	svc := newService(layout, f, t0.Add(5*24*time.Hour))
	if _, err := svc.Create(context.Background(), CreateOptions{OutputDir: out, Keep: 3}); err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(out)
	var got []string
	for _, e := range entries {
		got = append(got, e.Name())
	}
	want := []string{
		"alfheim-backup-20261023T030000Z.tar.gz",
		"alfheim-backup-20261024T030000Z.tar.gz",
		"alfheim-backup-20261025T030000Z.tar.gz",
		"alfheim-backup-manual.tar.gz",
		"notes.txt",
	}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("remaining = %v, want %v", got, want)
	}
}

// rewrite copies an archive, letting mutate change or drop entries.
func rewrite(t *testing.T, src string, mutate func(hdr *tar.Header, body []byte) ([]byte, bool)) string {
	t.Helper()
	f, err := os.Open(src)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = f.Close() }()
	gz, err := gzip.NewReader(f)
	if err != nil {
		t.Fatal(err)
	}
	tr := tar.NewReader(gz)
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gw)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(tr)
		body, keep := mutate(hdr, body)
		if !keep {
			continue
		}
		hdr.Size = int64(len(body))
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatal(err)
		}
		_, _ = tw.Write(body)
	}
	_ = tw.Close()
	_ = gw.Close()
	dst := filepath.Join(t.TempDir(), "tampered.tar.gz")
	if err := os.WriteFile(dst, buf.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}
	return dst
}

func TestPrepareRejectsTamperedAndMalformedArchives(t *testing.T) {
	layout := newInstall(t)
	good := create(t, newService(layout, &fakeDocker{dump: validDump}, t0), t.TempDir(), false)

	tests := []struct {
		name    string
		mutate  func(*tar.Header, []byte) ([]byte, bool)
		wantErr string
	}{
		{"modified payload", func(h *tar.Header, b []byte) ([]byte, bool) {
			if h.Name == "database.sql" {
				return append(b, []byte("DROP DATABASE x;")...), true
			}
			return b, true
		}, "checksum mismatch"},
		{"missing payload", func(h *tar.Header, b []byte) ([]byte, bool) {
			return b, h.Name != "files/.env"
		}, "missing from the archive"},
		{"missing manifest", func(h *tar.Header, b []byte) ([]byte, bool) {
			return b, h.Name != ManifestEntry
		}, "no manifest.json"},
		{"path traversal", func(h *tar.Header, b []byte) ([]byte, bool) {
			if h.Name == "files/.env" {
				h.Name = "files/../../etc/cron.d/evil"
			}
			return b, true
		}, "unsafe archive entry"},
		{"unexpected root", func(h *tar.Header, b []byte) ([]byte, bool) {
			if h.Name == "files/.env" {
				h.Name = "/etc/passwd"
			}
			return b, true
		}, "unexpected archive entry"},
		{"symlink", func(h *tar.Header, b []byte) ([]byte, bool) {
			if h.Name == "files/.env" {
				h.Typeflag, h.Linkname = tar.TypeSymlink, "/etc/shadow"
				return nil, true
			}
			return b, true
		}, "unsupported type"},
		{"unlisted file", func(h *tar.Header, b []byte) ([]byte, bool) {
			if h.Name == "files/.env" {
				h.Name = "files/.env2"
			}
			return b, true
		}, "missing from the archive"},
		{"unsupported format", func(h *tar.Header, b []byte) ([]byte, bool) {
			if h.Name == ManifestEntry {
				var m Manifest
				_ = json.Unmarshal(b, &m)
				m.Format = 99
				out, _ := json.Marshal(m)
				return out, true
			}
			return b, true
		}, "unsupported manifest format"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			stage := t.TempDir()
			_, err := Prepare(rewrite(t, good, tc.mutate), stage)
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("Prepare() error = %v, want it to contain %q", err, tc.wantErr)
			}
			if left, _ := os.ReadDir(stage); len(left) != 0 {
				t.Errorf("staging directory not cleaned up: %v", left)
			}
		})
	}
}

func TestPrepareRejectsNonArchive(t *testing.T) {
	bad := filepath.Join(t.TempDir(), "x.tar.gz")
	writeFile(t, bad, "not gzip", 0o600)
	if _, err := Prepare(bad, t.TempDir()); err == nil {
		t.Fatal("Prepare() accepted a non-gzip file")
	}
}

func TestRestoreFilesAndSafetyCopy(t *testing.T) {
	src := newInstall(t)
	archive := create(t, newService(src, &fakeDocker{dump: validDump}, t0), t.TempDir(), false)

	target := newInstall(t)
	writeFile(t, target.EnvFile(), "POSTGRES_USER=other\n", 0o600)
	var chowned []string
	svc := newService(target, &fakeDocker{}, t0)
	svc.Geteuid = func() int { return 0 }
	svc.Chown = func(p string, uid, gid int) error { chowned = append(chowned, p); return nil }

	p, err := Prepare(archive, target.Root)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = p.Cleanup() }()
	safety, err := svc.RestoreFiles(p)
	if err != nil {
		t.Fatalf("RestoreFiles() error = %v", err)
	}

	got, _ := os.ReadFile(target.EnvFile())
	if !strings.Contains(string(got), "POSTGRES_USER=admin_pg") {
		t.Errorf(".env = %q, want the archived one", got)
	}
	if info, _ := os.Stat(target.EnvFile()); info.Mode().Perm() != 0o600 {
		t.Errorf(".env mode = %o, want 0600", info.Mode().Perm())
	}
	old, err := os.ReadFile(filepath.Join(safety, ".env"))
	if err != nil || !strings.Contains(string(old), "POSTGRES_USER=other") {
		t.Errorf("safety copy of the previous .env missing: %q, %v", old, err)
	}
	if len(chowned) == 0 {
		t.Error("ownership was not restored when running as root")
	}
	pat, _ := os.ReadFile(filepath.Join(target.Root, "infrastructure/zitadel/machinekey/pat.txt"))
	if string(pat) != "PAT" {
		t.Errorf("machinekey PAT = %q", pat)
	}
}

func TestRestoreDatabaseDropsThenReplaysAsManifestUser(t *testing.T) {
	src := newInstall(t)
	archive := create(t, newService(src, &fakeDocker{dump: validDump}, t0), t.TempDir(), false)
	target := newInstall(t)
	f := &fakeDocker{}
	svc := newService(target, f, t0)
	p, err := Prepare(archive, target.Root)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = p.Cleanup() }()
	if err := svc.RestoreDatabase(context.Background(), p); err != nil {
		t.Fatalf("RestoreDatabase() error = %v", err)
	}
	var joined []string
	for _, c := range f.calls {
		joined = append(joined, c.String())
		if !strings.Contains(c.String(), "-U admin_pg") {
			t.Errorf("command %q does not use the manifest's postgres user", c.String())
		}
		for _, a := range c.Args {
			if a == "-t" {
				t.Errorf("command %q allocates a TTY", c.String())
			}
		}
	}
	all := strings.Join(joined, "\n")
	for _, w := range []string{
		`DROP DATABASE "alfheim_chat" WITH (FORCE)`,
		`DROP OWNED BY "chat_user"; DROP ROLE "chat_user"`,
	} {
		if !strings.Contains(all, w) {
			t.Errorf("missing statement %q in:\n%s", w, all)
		}
	}
	last := f.calls[len(f.calls)-1]
	if f.stdins[last.String()] != validDump {
		t.Errorf("replayed dump = %q, want the archived dump", f.stdins[last.String()])
	}
}

func TestRestoreDatabaseReportsRealErrorsButToleratesBootstrapRole(t *testing.T) {
	src := newInstall(t)
	archive := create(t, newService(src, &fakeDocker{dump: validDump}, t0), t.TempDir(), false)
	target := newInstall(t)

	p, err := Prepare(archive, target.Root)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = p.Cleanup() }()

	benign := &fakeDocker{replayErr: "psql:<stdin>:1: ERROR:  role \"admin_pg\" already exists\n"}
	if err := newService(target, benign, t0).RestoreDatabase(context.Background(), p); err != nil {
		t.Errorf("bootstrap-role error should be tolerated: %v", err)
	}
	real := &fakeDocker{replayErr: "psql:<stdin>:9: ERROR:  syntax error at or near \"x\"\n"}
	err = newService(target, real, t0).RestoreDatabase(context.Background(), p)
	if err == nil || !strings.Contains(err.Error(), "syntax error") {
		t.Errorf("RestoreDatabase() error = %v, want the psql error", err)
	}
}

func TestRestoreMediaStreamsTarIntoVolume(t *testing.T) {
	src := newInstall(t)
	archive := create(t, newService(src, &fakeDocker{dump: validDump, mediaTar: "MEDIA"}, t0), t.TempDir(), true)
	target := newInstall(t)
	f := &fakeDocker{}
	p, err := Prepare(archive, target.Root)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = p.Cleanup() }()
	if err := newService(target, f, t0).RestoreMedia(context.Background(), p); err != nil {
		t.Fatal(err)
	}
	if got := f.calls[0].String(); got != "docker compose -f "+target.ComposeFile()+" create rustfs" {
		t.Errorf("first call = %q", got)
	}
	run := f.calls[1]
	if !strings.HasPrefix(run.String(), "docker run --rm -i --volumes-from alfheim_rustfs alpine:3.20 sh -c") {
		t.Errorf("run call = %q", run.String())
	}
	if f.stdins[run.String()] != "MEDIA" {
		t.Errorf("media stdin = %q", f.stdins[run.String()])
	}
}
