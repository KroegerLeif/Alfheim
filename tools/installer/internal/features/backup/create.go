package backup

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"alfheim/installer/internal/shared/assets"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

// Container and compose names from compose.prod.yaml.
const (
	postgresService   = "postgres-core"
	mediaContainer    = "alfheim_rustfs"
	mediaDataDir      = "/data"
	helperImage       = "alpine:3.24"
	dumpTrailer       = "PostgreSQL database cluster dump complete"
	defaultPGUser     = "postgres"
	maxCommandErrSize = 2000
)

// Service creates and restores backups of one installation.
type Service struct {
	Runner runner.Runner
	Layout paths.Layout
	// Log receives progress lines. May be nil.
	Log io.Writer
	// Version is the installer's build version, recorded in the manifest.
	Version string
	// Now supplies the archive timestamp. Defaults to time.Now.
	Now func() time.Time
	// Geteuid and Chown let restore re-apply file ownership when running as
	// root. Default to the os implementations.
	Geteuid func() int
	Chown   func(path string, uid, gid int) error
}

// New returns a Service for layout.
func New(r runner.Runner, l paths.Layout, version string, log io.Writer) *Service {
	return &Service{Runner: r, Layout: l, Version: version, Log: log}
}

// CreateOptions configure Create.
type CreateOptions struct {
	// OutputDir receives the archive. Created 0700 when missing.
	OutputDir string
	// Keep is how many of the newest archives to retain (at least 1).
	Keep int
	// IncludeMedia adds the RustFS data volume to the archive.
	IncludeMedia bool
}

func (s *Service) logf(format string, args ...any) {
	if s.Log != nil {
		fmt.Fprintf(s.Log, format+"\n", args...)
	}
}

func (s *Service) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

func (s *Service) compose(args ...string) runner.Command {
	return runner.Command{
		Name: "docker",
		Args: append([]string{"compose", "-f", s.Layout.ComposeFile()}, args...),
		Dir:  s.Layout.Root,
	}
}

// postgresUser reads POSTGRES_USER from an env map.
func postgresUser(env map[string]string) string {
	if u := strings.TrimSpace(env["POSTGRES_USER"]); u != "" {
		return u
	}
	return defaultPGUser
}

// Create writes a new archive into opts.OutputDir, prunes old ones and
// returns the archive path. A failure leaves no partial archive behind.
func (s *Service) Create(ctx context.Context, opts CreateOptions) (string, error) {
	if opts.Keep < 1 {
		return "", fmt.Errorf("backup: --keep must be at least 1, got %d", opts.Keep)
	}
	env, err := envfile.ParseFile(s.Layout.EnvFile())
	if err != nil {
		return "", fmt.Errorf("backup: read .env: %w", err)
	}
	user := postgresUser(env)

	if err := ensureOutputDir(opts.OutputDir, s.Log); err != nil {
		return "", err
	}
	stage, err := os.MkdirTemp(opts.OutputDir, ".stage-*")
	if err != nil {
		return "", fmt.Errorf("backup: create staging directory: %w", err)
	}
	defer func() { _ = os.RemoveAll(stage) }()

	pgVersion, err := s.postgresVersion(ctx, user)
	if err != nil {
		return "", err
	}

	s.logf("Dumping every database with pg_dumpall")
	dumpPath := filepath.Join(stage, DatabaseEntry)
	if err := s.dumpDatabase(ctx, user, dumpPath); err != nil {
		return "", err
	}
	mediaPath := ""
	if opts.IncludeMedia {
		s.logf("Archiving the RustFS data volume")
		mediaPath = filepath.Join(stage, MediaEntry)
		if err := s.archiveMedia(ctx, mediaPath); err != nil {
			return "", err
		}
	}

	now := s.now()
	final := filepath.Join(opts.OutputDir, ArchiveName(now))
	partial := final + ".partial"
	manifest := Manifest{
		Format:           FormatVersion,
		CreatedAt:        now.UTC(),
		InstallerVersion: s.Version,
		ImageTag:         env["IMAGE_TAG"],
		PostgresUser:     user,
		PostgresVersion:  pgVersion,
		IncludesMedia:    opts.IncludeMedia,
	}
	if err := s.writeArchive(partial, &manifest, dumpPath, mediaPath); err != nil {
		_ = os.Remove(partial)
		return "", err
	}
	if err := os.Rename(partial, final); err != nil {
		_ = os.Remove(partial)
		return "", fmt.Errorf("backup: finalize archive: %w", err)
	}

	removed, err := Prune(opts.OutputDir, opts.Keep, final)
	if err != nil {
		return final, fmt.Errorf("backup: archive written to %s but pruning old archives failed: %w", final, err)
	}
	for _, name := range removed {
		s.logf("Removed old backup %s", name)
	}
	return final, nil
}

// ensureOutputDir creates dir 0700, and warns when an existing directory is
// readable by others. It never changes the mode of an existing directory
// (the operator may have pointed --output at a shared location).
func ensureOutputDir(dir string, log io.Writer) error {
	info, err := os.Stat(dir)
	switch {
	case err == nil:
		if !info.IsDir() {
			return fmt.Errorf("backup: output path %s is not a directory", dir)
		}
		if info.Mode().Perm()&0o077 != 0 && log != nil {
			fmt.Fprintf(log, "Warning: %s is accessible to other users; archives are 0600 but consider chmod 700.\n", dir)
		}
		return nil
	case errors.Is(err, fs.ErrNotExist):
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return fmt.Errorf("backup: create output directory %s: %w", dir, err)
		}
		return nil
	default:
		return fmt.Errorf("backup: stat output directory %s: %w", dir, err)
	}
}

func trimTail(s string) string {
	s = strings.TrimSpace(s)
	if len(s) <= maxCommandErrSize {
		return s
	}
	return s[len(s)-maxCommandErrSize:]
}

func (s *Service) postgresVersion(ctx context.Context, user string) (string, error) {
	cmd := s.compose("exec", "-T", postgresService, "psql", "-U", user, "-d", "postgres", "-X", "-At",
		"-c", "SHOW server_version")
	res, err := s.Runner.Run(ctx, cmd)
	if err != nil {
		return "", fmt.Errorf("backup: query postgres version: %w", err)
	}
	if res.ExitCode != 0 {
		return "", fmt.Errorf("backup: cannot reach %s (is the stack running?): %s", postgresService, trimTail(res.Stderr+res.Stdout))
	}
	return strings.TrimSpace(res.Stdout), nil
}

// dumpDatabase streams pg_dumpall to path. No TTY (-T): a pseudo-terminal
// would translate newlines and corrupt the dump.
func (s *Service) dumpDatabase(ctx context.Context, user, path string) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("backup: create dump file: %w", err)
	}
	cmd := s.compose("exec", "-T", postgresService, "pg_dumpall", "-U", user)
	cmd.Stdout = f
	cmd.StreamOnly = true
	res, runErr := s.Runner.Run(ctx, cmd)
	if closeErr := f.Close(); runErr == nil {
		runErr = closeErr
	}
	if runErr != nil {
		return fmt.Errorf("backup: pg_dumpall: %w", runErr)
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("backup: pg_dumpall exited with code %d: %s", res.ExitCode, trimTail(res.Stderr))
	}
	return verifyDumpComplete(path)
}

// verifyDumpComplete checks for the trailer pg_dumpall writes last, which
// proves the stream was not cut short.
func verifyDumpComplete(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("backup: open dump: %w", err)
	}
	defer func() { _ = f.Close() }()
	info, err := f.Stat()
	if err != nil {
		return fmt.Errorf("backup: stat dump: %w", err)
	}
	const tail = 1024
	off := info.Size() - tail
	if off < 0 {
		off = 0
	}
	buf := make([]byte, info.Size()-off)
	if _, err := f.ReadAt(buf, off); err != nil && !errors.Is(err, io.EOF) {
		return fmt.Errorf("backup: read dump tail: %w", err)
	}
	if !bytes.Contains(buf, []byte(dumpTrailer)) {
		return fmt.Errorf("backup: the database dump is incomplete (no %q trailer)", dumpTrailer)
	}
	return nil
}

// archiveMedia tars the RustFS data volume through a throwaway container
// that mounts the volumes of the RustFS container read-only, so no volume
// name has to be derived from the Compose project name.
func (s *Service) archiveMedia(ctx context.Context, path string) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("backup: create media file: %w", err)
	}
	res, runErr := s.Runner.Run(ctx, runner.Command{
		Name: "docker",
		Args: []string{"run", "--rm", "--volumes-from", mediaContainer + ":ro", helperImage,
			"tar", "cf", "-", "-C", mediaDataDir, "."},
		Stdout:     f,
		StreamOnly: true,
	})
	if closeErr := f.Close(); runErr == nil {
		runErr = closeErr
	}
	if runErr != nil {
		return fmt.Errorf("backup: archive RustFS data: %w", runErr)
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("backup: archiving RustFS data exited with code %d: %s", res.ExitCode, trimTail(res.Stderr))
	}
	return nil
}

// filePaths lists the installation files and directories included in every
// archive, relative to the install root. Missing ones are skipped.
func filePaths() []string {
	list := []string{
		".env",
		paths.MarkerName,
		"infrastructure/zitadel/machinekey",
		"infrastructure/ca",
		"infrastructure/caddy/pki",
		"data/caddy/certs",
	}
	for _, a := range assets.StackAssets {
		list = append(list, a.Dest)
	}
	for _, a := range assets.GeneratedAssets {
		list = append(list, a.Dest)
	}
	return list
}

// archiveWriter appends entries to the tar stream while collecting the
// manifest entries.
type archiveWriter struct {
	tw      *tar.Writer
	entries []Entry
}

// addStream writes a regular file entry whose bytes come from r.
func (a *archiveWriter) addStream(name string, info fs.FileInfo, uid, gid int, r io.Reader) error {
	hdr := &tar.Header{
		Name: name, Typeflag: tar.TypeReg, Mode: int64(info.Mode().Perm()), Size: info.Size(),
		ModTime: info.ModTime(), Uid: uid, Gid: gid,
	}
	if err := a.tw.WriteHeader(hdr); err != nil {
		return fmt.Errorf("backup: write header for %s: %w", name, err)
	}
	h := sha256.New()
	n, err := io.Copy(io.MultiWriter(a.tw, h), r)
	if err != nil {
		return fmt.Errorf("backup: archive %s: %w", name, err)
	}
	if n != info.Size() {
		return fmt.Errorf("backup: %s changed while being archived (%d of %d bytes)", name, n, info.Size())
	}
	a.entries = append(a.entries, Entry{
		Path: name, Type: TypeFile, Mode: uint32(info.Mode().Perm()), UID: uid, GID: gid,
		Size: n, SHA256: hex.EncodeToString(h.Sum(nil)),
	})
	return nil
}

func (a *archiveWriter) addDir(name string, info fs.FileInfo, uid, gid int) error {
	hdr := &tar.Header{
		Name: name + "/", Typeflag: tar.TypeDir, Mode: int64(info.Mode().Perm()),
		ModTime: info.ModTime(), Uid: uid, Gid: gid,
	}
	if err := a.tw.WriteHeader(hdr); err != nil {
		return fmt.Errorf("backup: write header for %s: %w", name, err)
	}
	a.entries = append(a.entries, Entry{
		Path: name, Type: TypeDir, Mode: uint32(info.Mode().Perm()), UID: uid, GID: gid,
	})
	return nil
}

// addDiskFile archives a staged payload file under its fixed entry name.
func (a *archiveWriter) addDiskFile(name, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("backup: open %s: %w", path, err)
	}
	defer func() { _ = f.Close() }()
	info, err := f.Stat()
	if err != nil {
		return fmt.Errorf("backup: stat %s: %w", path, err)
	}
	return a.addStream(name, info, 0, 0, f)
}

// addTree archives rel (a file or directory under root) recursively.
func (a *archiveWriter) addTree(root, rel string) error {
	start := filepath.Join(root, filepath.FromSlash(rel))
	if _, err := os.Lstat(start); errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return filepath.WalkDir(start, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return fmt.Errorf("backup: walk %s: %w", p, err)
		}
		info, err := d.Info()
		if err != nil {
			return fmt.Errorf("backup: stat %s: %w", p, err)
		}
		sub, err := filepath.Rel(root, p)
		if err != nil {
			return fmt.Errorf("backup: relate %s: %w", p, err)
		}
		name := FilesPrefix + filepath.ToSlash(sub)
		uid, gid := ownerOf(info)
		switch {
		case info.IsDir():
			return a.addDir(name, info, uid, gid)
		case info.Mode().IsRegular():
			f, err := os.Open(p)
			if err != nil {
				return fmt.Errorf("backup: open %s: %w", p, err)
			}
			defer func() { _ = f.Close() }()
			return a.addStream(name, info, uid, gid, f)
		default:
			return fmt.Errorf("backup: %s is neither a regular file nor a directory (symlinks are not supported)", p)
		}
	})
}

// writeArchive builds the complete archive at path (mode 0600).
func (s *Service) writeArchive(path string, m *Manifest, dumpPath, mediaPath string) (err error) {
	out, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("backup: create archive: %w", err)
	}
	defer func() {
		if closeErr := out.Close(); err == nil && closeErr != nil {
			err = fmt.Errorf("backup: close archive: %w", closeErr)
		}
	}()
	gz := gzip.NewWriter(out)
	tw := tar.NewWriter(gz)
	aw := &archiveWriter{tw: tw}

	s.logf("Writing the archive")
	if err := aw.addDiskFile(DatabaseEntry, dumpPath); err != nil {
		return err
	}
	if mediaPath != "" {
		if err := aw.addDiskFile(MediaEntry, mediaPath); err != nil {
			return err
		}
	}
	if _, statErr := os.Stat(s.Layout.EnvFile()); statErr != nil {
		return fmt.Errorf("backup: .env: %w", statErr)
	}
	seen := map[string]bool{}
	for _, rel := range filePaths() {
		if seen[rel] {
			continue
		}
		seen[rel] = true
		if err := aw.addTree(s.Layout.Root, rel); err != nil {
			return err
		}
	}
	m.Entries = aw.entries

	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return fmt.Errorf("backup: encode manifest: %w", err)
	}
	hdr := &tar.Header{
		Name: ManifestEntry, Typeflag: tar.TypeReg, Mode: 0o600, Size: int64(len(data)), ModTime: m.CreatedAt,
	}
	if err := tw.WriteHeader(hdr); err != nil {
		return fmt.Errorf("backup: write manifest header: %w", err)
	}
	if _, err := tw.Write(data); err != nil {
		return fmt.Errorf("backup: write manifest: %w", err)
	}
	if err := tw.Close(); err != nil {
		return fmt.Errorf("backup: finish tar: %w", err)
	}
	if err := gz.Close(); err != nil {
		return fmt.Errorf("backup: finish gzip: %w", err)
	}
	if err := out.Sync(); err != nil {
		return fmt.Errorf("backup: sync archive: %w", err)
	}
	return nil
}

// Prune deletes all but the keep newest archives in dir and returns the
// names it removed. Only files matching ArchiveName's pattern are
// considered, and protect (the archive just written) is never removed.
func Prune(dir string, keep int, protect string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("backup: list %s: %w", dir, err)
	}
	var names []string
	for _, e := range entries {
		if e.Type().IsRegular() && archiveNamePattern.MatchString(e.Name()) {
			names = append(names, e.Name())
		}
	}
	// Timestamps are fixed-width UTC, so lexical order is chronological.
	sort.Strings(names)
	if len(names) <= keep {
		return nil, nil
	}
	var removed []string
	for _, name := range names[:len(names)-keep] {
		full := filepath.Join(dir, name)
		if full == protect {
			continue
		}
		if err := os.Remove(full); err != nil {
			return removed, fmt.Errorf("backup: remove %s: %w", full, err)
		}
		removed = append(removed, name)
	}
	return removed, nil
}
