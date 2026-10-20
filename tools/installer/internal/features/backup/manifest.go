// Package backup implements `alfheim-setup backup` and `alfheim-setup
// restore`: a single self-contained archive holding everything needed to
// rebuild an installation on a fresh host.
//
// The archive is a gzip-compressed tar with this layout:
//
//	database.sql      pg_dumpall of the whole postgres-core cluster
//	rustfs-data.tar   tar of the RustFS data volume (optional)
//	files/<path>      .env, Zitadel machinekey, root CA, Caddy PKI, stack files
//	manifest.json     format version, release, per-entry SHA-256 checksums
//
// manifest.json is written last so the checksums cover the final bytes of
// every other entry. The archive holds every secret of the installation in
// plaintext, so it is always created owner-only (0600).
package backup

import (
	"encoding/json"
	"fmt"
	"path"
	"regexp"
	"strings"
	"time"
)

// FormatVersion is the manifest schema version this package reads and writes.
const FormatVersion = 1

// Archive entry names with a fixed meaning.
const (
	ManifestEntry = "manifest.json"
	DatabaseEntry = "database.sql"
	MediaEntry    = "rustfs-data.tar"
	// FilesPrefix prefixes every installation file stored in the archive.
	FilesPrefix = "files/"
)

// Entry types recorded in the manifest.
const (
	TypeFile = "file"
	TypeDir  = "dir"
)

// DefaultKeep is how many of the newest archives are retained by default.
const DefaultKeep = 7

// archiveNamePattern matches the archives this package creates, and only
// those, so retention never deletes a file it did not write.
var archiveNamePattern = regexp.MustCompile(`^alfheim-backup-\d{8}T\d{6}Z\.tar\.gz$`)

// ArchiveName renders the file name of an archive created at t.
func ArchiveName(t time.Time) string {
	return "alfheim-backup-" + t.UTC().Format("20060102T150405Z") + ".tar.gz"
}

// Manifest describes the contents of an archive.
type Manifest struct {
	Format           int       `json:"format"`
	CreatedAt        time.Time `json:"created_at"`
	InstallerVersion string    `json:"installer_version"`
	// ImageTag is the IMAGE_TAG of the release the backup was taken from.
	ImageTag string `json:"image_tag"`
	// PostgresUser is POSTGRES_USER from the backed-up .env; restore uses it
	// to reach the cluster before the restored .env is applied elsewhere.
	PostgresUser    string `json:"postgres_user"`
	PostgresVersion string `json:"postgres_version"`
	// IncludesMedia reports whether rustfs-data.tar is part of the archive.
	IncludesMedia bool    `json:"includes_media"`
	Entries       []Entry `json:"entries"`
}

// Entry is one archived file or directory.
type Entry struct {
	// Path is the entry name inside the tar archive.
	Path string `json:"path"`
	Type string `json:"type"`
	// Mode is the permission bits (not the file type).
	Mode uint32 `json:"mode"`
	UID  int    `json:"uid"`
	GID  int    `json:"gid"`
	// Size and SHA256 are set for files only.
	Size   int64  `json:"size,omitempty"`
	SHA256 string `json:"sha256,omitempty"`
}

// parseManifest decodes and structurally validates manifest bytes. It checks
// every entry name, because the manifest comes out of an archive that may
// have been tampered with.
func parseManifest(data []byte) (Manifest, error) {
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return Manifest{}, fmt.Errorf("backup: decode %s: %w", ManifestEntry, err)
	}
	if m.Format != FormatVersion {
		return Manifest{}, fmt.Errorf("backup: unsupported manifest format %d (this binary understands %d)",
			m.Format, FormatVersion)
	}
	seen := map[string]bool{}
	for _, e := range m.Entries {
		if err := validateEntryName(e.Path); err != nil {
			return Manifest{}, err
		}
		if e.Path == ManifestEntry {
			return Manifest{}, fmt.Errorf("backup: manifest lists itself as an entry")
		}
		if seen[e.Path] {
			return Manifest{}, fmt.Errorf("backup: manifest lists %q twice", e.Path)
		}
		seen[e.Path] = true
		switch e.Type {
		case TypeFile:
			if e.SHA256 == "" {
				return Manifest{}, fmt.Errorf("backup: manifest entry %q has no checksum", e.Path)
			}
		case TypeDir:
			if !strings.HasPrefix(e.Path, FilesPrefix) {
				return Manifest{}, fmt.Errorf("backup: directory entry %q is outside %s", e.Path, FilesPrefix)
			}
		default:
			return Manifest{}, fmt.Errorf("backup: manifest entry %q has unknown type %q", e.Path, e.Type)
		}
	}
	if !seen[DatabaseEntry] {
		return Manifest{}, fmt.Errorf("backup: archive has no %s", DatabaseEntry)
	}
	if seen[MediaEntry] != m.IncludesMedia {
		return Manifest{}, fmt.Errorf("backup: manifest includes_media=%t disagrees with its entries", m.IncludesMedia)
	}
	if m.PostgresUser == "" {
		return Manifest{}, fmt.Errorf("backup: manifest has no postgres_user")
	}
	return m, nil
}

// validateEntryName accepts only the fixed entry names and clean relative
// paths below FilesPrefix. Anything else (absolute paths, "..", odd roots)
// is rejected so a hostile archive cannot write outside the install root.
func validateEntryName(name string) error {
	switch name {
	case DatabaseEntry, MediaEntry, ManifestEntry:
		return nil
	}
	if !strings.HasPrefix(name, FilesPrefix) {
		return fmt.Errorf("backup: unexpected archive entry %q", name)
	}
	rel := strings.TrimPrefix(name, FilesPrefix)
	if rel == "" || path.IsAbs(rel) || path.Clean(rel) != rel || rel == ".." || strings.HasPrefix(rel, "../") ||
		strings.ContainsRune(rel, 0) || strings.Contains(rel, `\`) {
		return fmt.Errorf("backup: unsafe archive entry path %q", name)
	}
	return nil
}
