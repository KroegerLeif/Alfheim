package backup

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"alfheim/installer/internal/features/updater"
	"alfheim/installer/internal/shared/assets"
	"alfheim/installer/internal/shared/runner"
)

// maxManifestSize bounds the manifest read from an untrusted archive.
const maxManifestSize = 16 << 20

// Prepared is an archive that was extracted into a staging directory and
// whose every file matched the checksum in its manifest.
type Prepared struct {
	Manifest Manifest
	dir      string
}

// Prepare extracts archive into a fresh staging directory below stageParent
// and verifies it against its manifest. Nothing outside the staging
// directory is touched. Callers must call Cleanup.
func Prepare(archive, stageParent string) (*Prepared, error) {
	f, err := os.Open(archive)
	if err != nil {
		return nil, fmt.Errorf("backup: open archive: %w", err)
	}
	defer func() { _ = f.Close() }()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return nil, fmt.Errorf("backup: %s is not a gzip archive: %w", archive, err)
	}
	defer func() { _ = gz.Close() }()

	if err := os.MkdirAll(stageParent, 0o755); err != nil {
		return nil, fmt.Errorf("backup: create %s: %w", stageParent, err)
	}
	dir, err := os.MkdirTemp(stageParent, ".alfheim-restore-*")
	if err != nil {
		return nil, fmt.Errorf("backup: create staging directory: %w", err)
	}
	p := &Prepared{dir: dir}
	m, err := extractAndVerify(tar.NewReader(gz), dir)
	if err != nil {
		_ = p.Cleanup()
		return nil, err
	}
	p.Manifest = m
	return p, nil
}

// Cleanup removes the staging directory.
func (p *Prepared) Cleanup() error { return os.RemoveAll(p.dir) }

func (p *Prepared) staged(name string) string {
	return filepath.Join(p.dir, filepath.FromSlash(name))
}

type stagedSum struct {
	size int64
	sha  string
}

func extractAndVerify(tr *tar.Reader, dir string) (Manifest, error) {
	sums := map[string]stagedSum{}
	var manifestData []byte
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return Manifest{}, fmt.Errorf("backup: read archive: %w", err)
		}
		name := strings.TrimSuffix(hdr.Name, "/")
		if err := validateEntryName(name); err != nil {
			return Manifest{}, err
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if !strings.HasPrefix(name, FilesPrefix) {
				return Manifest{}, fmt.Errorf("backup: unexpected directory entry %q", name)
			}
			continue
		case tar.TypeReg:
		default:
			return Manifest{}, fmt.Errorf("backup: entry %q has unsupported type %q", name, string(hdr.Typeflag))
		}
		if _, dup := sums[name]; dup || (name == ManifestEntry && manifestData != nil) {
			return Manifest{}, fmt.Errorf("backup: duplicate archive entry %q", name)
		}
		if name == ManifestEntry {
			if hdr.Size > maxManifestSize {
				return Manifest{}, fmt.Errorf("backup: %s is implausibly large", ManifestEntry)
			}
			manifestData, err = io.ReadAll(tr)
			if err != nil {
				return Manifest{}, fmt.Errorf("backup: read %s: %w", ManifestEntry, err)
			}
			continue
		}
		sum, err := stageFile(tr, filepath.Join(dir, filepath.FromSlash(name)))
		if err != nil {
			return Manifest{}, err
		}
		sums[name] = sum
	}
	if manifestData == nil {
		return Manifest{}, fmt.Errorf("backup: archive has no %s; it is incomplete or not an Alfheim backup", ManifestEntry)
	}
	m, err := parseManifest(manifestData)
	if err != nil {
		return Manifest{}, err
	}
	listed := 0
	for _, e := range m.Entries {
		if e.Type != TypeFile {
			continue
		}
		listed++
		got, ok := sums[e.Path]
		if !ok {
			return Manifest{}, fmt.Errorf("backup: %s is listed in the manifest but missing from the archive", e.Path)
		}
		if got.size != e.Size || got.sha != strings.ToLower(e.SHA256) {
			return Manifest{}, fmt.Errorf("backup: checksum mismatch for %s; the archive is corrupted or was modified", e.Path)
		}
	}
	if listed != len(sums) {
		return Manifest{}, fmt.Errorf("backup: the archive contains files the manifest does not list")
	}
	return m, nil
}

// stageFile copies one tar entry to dst (0600) and returns its size and
// SHA-256.
func stageFile(r io.Reader, dst string) (stagedSum, error) {
	if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
		return stagedSum{}, fmt.Errorf("backup: stage %s: %w", dst, err)
	}
	f, err := os.OpenFile(dst, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return stagedSum{}, fmt.Errorf("backup: stage %s: %w", dst, err)
	}
	h := sha256.New()
	n, copyErr := io.Copy(io.MultiWriter(f, h), r)
	if closeErr := f.Close(); copyErr == nil {
		copyErr = closeErr
	}
	if copyErr != nil {
		return stagedSum{}, fmt.Errorf("backup: stage %s: %w", dst, copyErr)
	}
	return stagedSum{size: n, sha: hex.EncodeToString(h.Sum(nil))}, nil
}

func (s *Service) geteuid() int {
	if s.Geteuid != nil {
		return s.Geteuid()
	}
	return os.Geteuid()
}

func (s *Service) chown(path string, uid, gid int) error {
	if s.Chown != nil {
		return s.Chown(path, uid, gid)
	}
	return os.Chown(path, uid, gid)
}

// RestoreFiles puts the archived installation files back below the install
// root. Files that are about to be overwritten are first copied to a
// timestamped directory under .alfheim-backups, whose path is returned.
func (s *Service) RestoreFiles(p *Prepared) (safetyDir string, err error) {
	var existing []assets.Asset
	for _, e := range p.Manifest.Entries {
		if e.Type == TypeFile && strings.HasPrefix(e.Path, FilesPrefix) {
			rel := strings.TrimPrefix(e.Path, FilesPrefix)
			existing = append(existing, assets.Asset{Name: rel, Dest: rel})
		}
	}
	if err := os.MkdirAll(s.Layout.Root, 0o755); err != nil {
		return "", fmt.Errorf("backup: create %s: %w", s.Layout.Root, err)
	}
	safetyDir, err = updater.Backup(s.Layout.Root, existing, s.now())
	if err != nil {
		return "", fmt.Errorf("backup: save the files about to be overwritten: %w", err)
	}

	for _, e := range p.Manifest.Entries {
		if !strings.HasPrefix(e.Path, FilesPrefix) {
			continue
		}
		dest := filepath.Join(s.Layout.Root, filepath.FromSlash(strings.TrimPrefix(e.Path, FilesPrefix)))
		perm := os.FileMode(e.Mode).Perm()
		if e.Type == TypeDir {
			if err := os.MkdirAll(dest, perm); err != nil {
				return safetyDir, fmt.Errorf("backup: create %s: %w", dest, err)
			}
			if err := os.Chmod(dest, perm); err != nil {
				return safetyDir, fmt.Errorf("backup: chmod %s: %w", dest, err)
			}
		} else if err := copyStaged(p.staged(e.Path), dest, perm); err != nil {
			return safetyDir, err
		}
		if s.geteuid() == 0 {
			if err := s.chown(dest, e.UID, e.GID); err != nil {
				return safetyDir, fmt.Errorf("backup: restore ownership of %s: %w", dest, err)
			}
		}
	}
	return safetyDir, nil
}

// copyStaged copies src over dst in place, so the owner of an existing
// bind-mounted file or directory is not disturbed.
func copyStaged(src, dst string, perm os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return fmt.Errorf("backup: create %s: %w", filepath.Dir(dst), err)
	}
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("backup: open staged %s: %w", src, err)
	}
	defer func() { _ = in.Close() }()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, perm)
	if err != nil {
		return fmt.Errorf("backup: write %s: %w", dst, err)
	}
	_, copyErr := io.Copy(out, in)
	if closeErr := out.Close(); copyErr == nil {
		copyErr = closeErr
	}
	if copyErr != nil {
		return fmt.Errorf("backup: write %s: %w", dst, copyErr)
	}
	if err := os.Chmod(dst, perm); err != nil {
		return fmt.Errorf("backup: chmod %s: %w", dst, err)
	}
	return nil
}

// psql builds a psql invocation against the maintenance database.
func (s *Service) psql(user string, extra ...string) runner.Command {
	args := append([]string{"exec", "-T", postgresService, "psql", "-U", user, "-d", "postgres", "-X"}, extra...)
	return s.compose(args...)
}

// queryLines runs a SELECT returning one statement per row.
func (s *Service) queryLines(ctx context.Context, user, sql string) ([]string, error) {
	res, err := s.Runner.Run(ctx, s.psql(user, "-At", "-c", sql))
	if err != nil {
		return nil, fmt.Errorf("backup: query postgres: %w", err)
	}
	if res.ExitCode != 0 {
		return nil, fmt.Errorf("backup: query postgres failed: %s", trimTail(res.Stderr))
	}
	var out []string
	for _, line := range strings.Split(res.Stdout, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			out = append(out, line)
		}
	}
	return out, nil
}

// Statements that generate the DROP statements for everything except the
// maintenance database and the connecting superuser. format(%I) quotes the
// identifiers, so odd names cannot break out of the statement.
const (
	dropDatabasesSQL = `SELECT format('DROP DATABASE %I WITH (FORCE)', datname) FROM pg_database ` +
		`WHERE NOT datistemplate AND datname <> 'postgres'`
	dropRolesSQL = `SELECT format('DROP OWNED BY %I', rolname) || '; ' || format('DROP ROLE %I', rolname) ` +
		`FROM pg_roles WHERE rolname <> current_user AND rolname !~ '^pg_'`
)

// RestoreDatabase replaces the content of the running postgres-core cluster
// with the archived pg_dumpall: every non-template database and every role
// except the superuser is dropped first, then the dump is replayed.
func (s *Service) RestoreDatabase(ctx context.Context, p *Prepared) error {
	user := p.Manifest.PostgresUser
	s.logf("Dropping the current databases and roles")
	for _, sql := range []string{dropDatabasesSQL, dropRolesSQL} {
		stmts, err := s.queryLines(ctx, user, sql)
		if err != nil {
			return err
		}
		for _, stmt := range stmts {
			res, err := s.Runner.Run(ctx, s.psql(user, "-v", "ON_ERROR_STOP=1", "-c", stmt))
			if err != nil {
				return fmt.Errorf("backup: %s: %w", stmt, err)
			}
			if res.ExitCode != 0 {
				return fmt.Errorf("backup: %s failed: %s", stmt, trimTail(res.Stderr))
			}
		}
	}

	s.logf("Replaying the database dump")
	dump, err := os.Open(p.staged(DatabaseEntry))
	if err != nil {
		return fmt.Errorf("backup: open staged dump: %w", err)
	}
	defer func() { _ = dump.Close() }()
	cmd := s.psql(user, "-q")
	cmd.Stdin = dump
	res, err := s.Runner.Run(ctx, cmd)
	if err != nil {
		return fmt.Errorf("backup: replay dump: %w", err)
	}
	if bad := unexpectedPSQLErrors(res.Stderr, user); len(bad) > 0 || res.ExitCode != 0 {
		return fmt.Errorf("backup: replaying the dump failed (exit %d):\n%s", res.ExitCode, strings.Join(bad, "\n"))
	}
	return nil
}

// unexpectedPSQLErrors returns the ERROR lines of psql's stderr, minus the
// one error a replay onto an existing cluster always produces: the dump
// tries to CREATE the bootstrap superuser, which initdb already created.
func unexpectedPSQLErrors(stderr, user string) []string {
	benign := fmt.Sprintf("ERROR:  role %q already exists", user)
	var bad []string
	for _, line := range strings.Split(stderr, "\n") {
		if !strings.Contains(line, "ERROR:") || strings.Contains(line, benign) {
			continue
		}
		bad = append(bad, strings.TrimSpace(line))
		if len(bad) == 20 {
			break
		}
	}
	return bad
}

// RestoreMedia replaces the content of the RustFS data volume with the
// archived tarball. The RustFS container must exist (created, not running).
func (s *Service) RestoreMedia(ctx context.Context, p *Prepared) error {
	if !p.Manifest.IncludesMedia {
		return nil
	}
	s.logf("Restoring the RustFS data volume")
	res, err := s.Runner.Run(ctx, s.compose("create", "rustfs"))
	if err != nil {
		return fmt.Errorf("backup: create the rustfs container: %w", err)
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("backup: create the rustfs container failed: %s", trimTail(res.Stderr))
	}
	media, err := os.Open(p.staged(MediaEntry))
	if err != nil {
		return fmt.Errorf("backup: open staged media archive: %w", err)
	}
	defer func() { _ = media.Close() }()
	res, err = s.Runner.Run(ctx, runner.Command{
		Name: "docker",
		Args: []string{"run", "--rm", "-i", "--volumes-from", mediaContainer, helperImage,
			"sh", "-c", "find " + mediaDataDir + " -mindepth 1 -delete && tar xf - -C " + mediaDataDir},
		Stdin: media,
	})
	if err != nil {
		return fmt.Errorf("backup: restore RustFS data: %w", err)
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("backup: restoring RustFS data exited with code %d: %s", res.ExitCode, trimTail(res.Stderr))
	}
	return nil
}
